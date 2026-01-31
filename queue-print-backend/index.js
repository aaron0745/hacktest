const express = require('express');
require('dotenv').config();
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const qrcode = require('qrcode');
const cors = require('cors');
const Docker = require('dockerode');
const tar = require('tar-fs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in this example
        methods: ["GET", "POST"]
    }
});
const port = 3001;

// Initialize Docker
const docker = new Docker({ socketPath: process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock' });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Global variables for session management
let activeSessionId = null;
let sessionFiles = {}; // { sessionId: [{ id, filename, originalname, size, timestamp, path, ticketNumber }] }
let container = null; // Docker container for the current session
let fileUploadDir = null; // Dynamic upload directory for the current session

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fileUploadDir) {
            return cb(new Error('No active session or upload directory not set.'), false);
        }
        const sessionUploadsPath = path.join(__dirname, fileUploadDir);
        fs.mkdirSync(sessionUploadsPath, { recursive: true });
        cb(null, sessionUploadsPath);
    },
    filename: (req, file, cb) => {
        cb(null, `${uuidv4()}-${file.originalname}`);
    }
});
const upload = multer({ storage: storage });

// Helper to remove files and directory after session ends
const cleanupSessionFiles = async (sessionId, directory) => {
    if (directory && fs.existsSync(directory)) {
        console.log(`Cleaning up session directory: ${directory}`);
        fs.readdirSync(directory).forEach(file => {
            fs.unlinkSync(path.join(directory, file));
        });
        fs.rmdirSync(directory);
    }
    delete sessionFiles[sessionId];
    console.log(`Session ${sessionId} files cleaned up.`);
};

// Docker functions
const createAndStartContainer = async (sessionId) => {
    try {
        // Create a temporary Dockerfile for this session
        const dockerfileContent = `
            FROM ubuntu:latest
            RUN apt-get update && apt-get install -y cups cups-client cups-bsd
            RUN usermod -a -G lpadmin root
            ENV CUPS_SERVER=localhost
            ENV CUPS_DEBUG=1
            WORKDIR /app
            EXPOSE 631
            CMD ["/usr/sbin/cupsd", "-f"]
        `;
        const tempDirPath = path.join(__dirname, `docker_session_${sessionId}`);
        fs.mkdirSync(tempDirPath, { recursive: true });
        fs.writeFileSync(path.join(tempDirPath, 'Dockerfile'), dockerfileContent);

        // Build the Docker image
        const buildStream = await docker.buildImage(
            tar.pack(tempDirPath),
            { t: `safe-print-session-${sessionId}` }
        );

        await new Promise((resolve, reject) => {
            docker.modem.followProgress(buildStream, (err, res) => err ? reject(err) : resolve(res));
        });
        console.log(`Docker image safe-print-session-${sessionId} built.`);

        container = await docker.createContainer({
            Image: `safe-print-session-${sessionId}`,
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            OpenStdin: false,
            StdinOnce: false,
            HostConfig: {
                AutoRemove: true,
                PublishAllPorts: true
            },
            name: `safe-print-session-${sessionId}`
        });

        await container.start();
        const containerInfo = await container.inspect();
        console.log(`Container ${container.id} started.`);
        console.log('Container info:', containerInfo.NetworkSettings.Ports);

        // Remove the temporary Dockerfile directory
        fs.unlinkSync(path.join(tempDirPath, 'Dockerfile'));
        fs.rmdirSync(tempDirPath);

        return container;
    } catch (error) {
        console.error('Error creating or starting Docker container:', error);
        throw error;
    }
};

const stopAndRemoveContainer = async (containerInstance) => {
    if (containerInstance) {
        try {
            await containerInstance.stop();
            await containerInstance.remove();
            console.log(`Container ${containerInstance.id} stopped and removed.`);
        } catch (error) {
            console.error('Error stopping or removing Docker container:', error);
        }
    }
};

// API Endpoints

// Start a new print session
app.post('/start-session', async (req, res) => {
    if (activeSessionId) {
        return res.status(400).json({ message: 'A session is already active. Please end the current session first.' });
    }

    const sessionId = uuidv4();
    activeSessionId = sessionId;
    sessionFiles[sessionId] = [];
    fileUploadDir = `uploads/session_${sessionId}`; // Set dynamic upload directory

    try {
        // Start Docker container for the session
        await createAndStartContainer(sessionId);

        // Point QR code to the Frontend URL
        const qrCodeData = `http://${process.env.DEVICE_IP}:5173/upload?sessionId=${sessionId}`; 
        const qrCodeImage = await qrcode.toDataURL(qrCodeData);

        io.emit('session-started', { sessionId, qrCodeImage, uploadUrl: qrCodeData });
        console.log(`Session ${sessionId} started. QR Code generated for: ${qrCodeData}`);
        res.status(200).json({ sessionId, qrCodeImage, uploadUrl: qrCodeData });
    } catch (error) {
        console.error('Failed to start session:', error);
        activeSessionId = null;
        fileUploadDir = null;
        stopAndRemoveContainer(container); // Clean up container if creation failed
        container = null;
        res.status(500).json({ message: 'Failed to start session', error: error.message });
    }
});

// Upload endpoint for customers
app.post('/upload', upload.single('file'), (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId || sessionId !== activeSessionId) {
        return res.status(400).json({ message: 'Invalid or inactive session ID.' });
    }

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const ticketNumber = sessionFiles[sessionId].length + 1; // Simple incrementing ticket number
    const newFile = {
        id: uuidv4(),
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        timestamp: new Date(),
        path: req.file.path,
        ticketNumber: `#${String(ticketNumber).padStart(3, '0')}`
    };

    sessionFiles[sessionId].push(newFile);
    io.emit('file-uploaded', { sessionId, file: newFile }); // Notify dashboard

    // Set a TTL for the file
    setTimeout(() => {
        if (sessionFiles[sessionId]) {
            const index = sessionFiles[sessionId].findIndex(f => f.id === newFile.id);
            if (index > -1) {
                console.log(`File ${newFile.originalname} (Ticket ${newFile.ticketNumber}) auto-deleted due to TTL.`);
                fs.unlink(newFile.path, (err) => {
                    if (err) console.error('Error deleting file after TTL:', err);
                });
                sessionFiles[sessionId].splice(index, 1);
                io.emit('file-deleted', { sessionId, fileId: newFile.id });
            }
        }
    }, 2 * 60 * 1000); // 2 minutes TTL

    res.status(200).json({
        message: 'File uploaded successfully!',
        ticketNumber: newFile.ticketNumber
    });
});

// Endpoint to get session files (for dashboard)
app.get('/session-files', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || sessionId !== activeSessionId) {
        return res.status(400).json({ message: 'Invalid or inactive session ID.' });
    }
    res.status(200).json(sessionFiles[sessionId] || []);
});

// Print a specific file
app.post('/print/:fileId', async (req, res) => {
    const { fileId } = req.params;
    const { sessionId } = req.body;

    if (!sessionId || sessionId !== activeSessionId) {
        return res.status(400).json({ message: 'Invalid or inactive session ID.' });
    }

    const fileToPrint = sessionFiles[sessionId].find(f => f.id === fileId);

    if (!fileToPrint) {
        return res.status(404).json({ message: 'File not found or already printed/deleted.' });
    }

    if (!container) {
        return res.status(500).json({ message: 'No active print container.' });
    }

    try {
        const containerPath = `/app/${fileToPrint.filename}`; // Path inside the container

        // Copy file to container
        const fileContent = fs.readFileSync(fileToPrint.path);
        await container.putArchive(tar.pack(path.dirname(fileToPrint.path), {
            entries: [path.basename(fileToPrint.path)]
        }), {
            path: '/app'
        });

        // Use `lp` command inside the container to print
        const exec = await container.exec({
            Cmd: ['lp', containerPath],
            AttachStdout: true,
            AttachStderr: true
        });

        const stream = await exec.start({});

        let stdout = '';
        let stderr = '';

        stream.on('data', chunk => stdout += chunk.toString());
        stream.on('end', () => {
            console.log(`Print command stdout for ${fileToPrint.originalname}:`, stdout);
            console.log(`Print command stderr for ${fileToPrint.originalname}:`, stderr);
        });

        await new Promise(resolve => stream.on('end', resolve));

        // Assuming print command is successful, remove file from queue and local storage
        const index = sessionFiles[sessionId].findIndex(f => f.id === fileToPrint.id);
        if (index > -1) {
            sessionFiles[sessionId].splice(index, 1);
            fs.unlink(fileToPrint.path, (err) => {
                if (err) console.error('Error deleting file after printing:', err);
            });
            io.emit('file-deleted', { sessionId, fileId: fileToPrint.id }); // Notify dashboard
        }

        res.status(200).json({ message: `File ${fileToPrint.originalname} sent to printer.` });
    } catch (error) {
        console.error('Error printing file:', error);
        res.status(500).json({ message: 'Failed to print file', error: error.message });
    }
});


// End the current print session
app.post('/end-session', async (req, res) => {
    if (!activeSessionId) {
        return res.status(400).json({ message: 'No active session to end.' });
    }

    const sessionIdToEnd = activeSessionId;
    const directoryToClean = fileUploadDir;

    activeSessionId = null;
    fileUploadDir = null;

    try {
        await stopAndRemoveContainer(container);
        container = null; // Clear container reference

        await cleanupSessionFiles(sessionIdToEnd, directoryToClean);
        io.emit('session-ended', { sessionId: sessionIdToEnd });
        console.log(`Session ${sessionIdToEnd} ended and resources cleaned up.`);
        res.status(200).json({ message: `Session ${sessionIdToEnd} ended.` });
    } catch (error) {
        console.error('Failed to end session:', error);
        res.status(500).json({ message: 'Failed to end session', error: error.message });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    // Optionally send current session info to new connections
    if (activeSessionId) {
        socket.emit('current-session-status', {
            active: true,
            sessionId: activeSessionId,
            files: sessionFiles[activeSessionId] || []
        });
    }
});

// Start the server
server.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port} (0.0.0.0)`);
    console.log(`For QR display, navigate to http://${process.env.DEVICE_IP}:${port}/qr-display (placeholder, implement frontend route)`);
    console.log(`For customer upload, navigate to http://${process.env.DEVICE_IP}:${port}/upload?sessionId=<active_session_id>`);
});
