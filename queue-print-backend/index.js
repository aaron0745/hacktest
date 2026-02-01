const express = require('express');
require('dotenv').config();
const http = require('http');
const { exec } = require('child_process');
const socketIo = require('socket.io');
const multer = require('multer');
const qrcode = require('qrcode');
const cors = require('cors');
const Docker = require('dockerode');
const tar = require('tar-fs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*", 
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

// Global variables
let activeSessionId = null;
let sessionFiles = {}; 
let container = null; 
let fileUploadDir = null; 

// IP Detection
const getLocalExternalIp = () => {
    const interfaces = os.networkInterfaces();
    let candidateIp = 'localhost';

    // Prioritize interfaces that look like real hardware (en*, eth*, wl*)
    // Skip docker*, br-*, veth*
    for (const name of Object.keys(interfaces)) {
        if (name.startsWith('docker') || name.startsWith('br-') || name.startsWith('veth')) continue;

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                // If we found a likely candidate, return it immediately
                // Assuming the first non-internal, non-docker IPv4 is the LAN IP
                return iface.address;
            }
        }
    }
    
    // Fallback loop if no "nice" interface name matched (e.g. if names are weird)
    for (const name of Object.keys(interfaces)) {
         for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                candidateIp = iface.address;
            }
        }
    }

    return candidateIp; 
};

const SERVER_IP = getLocalExternalIp();
console.log(`Detected Server IP: ${SERVER_IP}`);

// Multer storage
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

// Docker Optimization
const BASE_IMAGE_NAME = 'queue-print-base';

const ensureBaseImage = async () => {
    try {
        const images = await docker.listImages();
        const exists = images.some(img => img.RepoTags && img.RepoTags.includes(`${BASE_IMAGE_NAME}:latest`));

        if (exists) {
            console.log(`Base image '${BASE_IMAGE_NAME}' already exists. Skipping build.`);
            return;
        }

        console.log(`Base image '${BASE_IMAGE_NAME}' not found. Building... (This may take a minute)`);
        
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
        
        const tempDirPath = path.join(__dirname, 'docker_base_build');
        if (!fs.existsSync(tempDirPath)) fs.mkdirSync(tempDirPath);
        fs.writeFileSync(path.join(tempDirPath, 'Dockerfile'), dockerfileContent);

        const buildStream = await docker.buildImage(
            tar.pack(tempDirPath),
            { t: BASE_IMAGE_NAME }
        );

        await new Promise((resolve, reject) => {
            docker.modem.followProgress(buildStream, (err, res) => err ? reject(err) : resolve(res));
        });

        // Cleanup temp dir
        fs.unlinkSync(path.join(tempDirPath, 'Dockerfile'));
        fs.rmdirSync(tempDirPath);

        console.log(`Base image '${BASE_IMAGE_NAME}' built successfully.`);

    } catch (error) {
        console.error('Error ensuring base image:', error);
        throw error;
    }
};

const createAndStartContainer = async (sessionId) => {
    try {
        await ensureBaseImage();

        const containerName = `session-${sessionId}`;
        
        container = await docker.createContainer({
            Image: BASE_IMAGE_NAME,
            AttachStdin: false,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
            HostConfig: {
                AutoRemove: true,
                PublishAllPorts: true
            },
            name: containerName
        });

        await container.start();
        const containerInfo = await container.inspect();
        console.log(`Container ${containerName} started.`);
        
        return container;
    } catch (error) {
        console.error('Error creating/starting container:', error);
        throw error;
    }
};

const stopAndRemoveContainer = async (containerInstance) => {
    if (containerInstance) {
        try {
            await containerInstance.stop();
            // AutoRemove is on, but explicitly removing just in case
            // await containerInstance.remove(); 
            console.log(`Container ${containerInstance.id} stopped.`);
        } catch (error) {
            // Ignore if already gone
            console.error('Error stopping container:', error.message);
        }
    }
};

// API Endpoints

app.post('/start-session', async (req, res) => {
    if (activeSessionId) {
        return res.status(400).json({ message: 'Session active.' });
    }

    const sessionId = uuidv4();
    activeSessionId = sessionId;
    sessionFiles[sessionId] = [];
    fileUploadDir = `uploads/session_${sessionId}`; 

    try {
        await createAndStartContainer(sessionId);

        // Use dynamically detected IP for QR Code
        const qrCodeData = `http://${SERVER_IP}:5173/upload?sessionId=${sessionId}`; 
        const qrCodeImage = await qrcode.toDataURL(qrCodeData);

        io.emit('session-started', { sessionId, qrCodeImage, uploadUrl: qrCodeData });
        console.log(`Session ${sessionId} started. Upload URL: ${qrCodeData}`);
        res.status(200).json({ sessionId, qrCodeImage, uploadUrl: qrCodeData });
    } catch (error) {
        console.error('Failed to start session:', error);
        activeSessionId = null;
        fileUploadDir = null;
        if (container) stopAndRemoveContainer(container);
        container = null;
        res.status(500).json({ message: 'Failed to start session', error: error.message });
    }
});

app.post('/upload', upload.single('file'), (req, res) => {
    const { sessionId } = req.query;

    if (!sessionId || sessionId !== activeSessionId) {
        return res.status(400).json({ message: 'Invalid session.' });
    }
    if (!req.file) {
        return res.status(400).json({ message: 'No file.' });
    }

    const ticketNumber = sessionFiles[sessionId].length + 1; 
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
    io.emit('file-uploaded', { sessionId, file: newFile }); 

    setTimeout(() => {
        if (sessionFiles[sessionId]) {
            const index = sessionFiles[sessionId].findIndex(f => f.id === newFile.id);
            if (index > -1) {
                console.log(`TTL: Deleting ${newFile.originalname}`);
                fs.unlink(newFile.path, (e) => { if(e) console.error(e); });
                sessionFiles[sessionId].splice(index, 1);
                io.emit('file-deleted', { sessionId, fileId: newFile.id });
            }
        }
    }, 2 * 60 * 1000); 

    res.status(200).json({
        message: 'Uploaded!',
        ticketNumber: newFile.ticketNumber
    });
});

app.get('/session-files', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId || sessionId !== activeSessionId) return res.status(400).json({ message: 'Invalid session.' });
    res.status(200).json(sessionFiles[sessionId] || []);
});

app.get('/printers', (req, res) => {
    exec('lpstat -a', (error, stdout, stderr) => {
        const printers = [];
        if (stdout) {
            const lines = stdout.split('\n').filter(line => line.trim() !== '');
            lines.forEach(line => {
                const parts = line.split(' ');
                if (parts[0] && parts[0] !== 'lpstat:') {
                    printers.push({ name: parts[0], status: 'Ready' });
                }
            });
        }
        printers.push({ name: 'Secure_Virtual_Printer', status: 'Ready (Simulation)' });
        res.status(200).json(printers);
    });
});

app.post('/print-job', async (req, res) => {
    const { fileId, printerName, sessionId } = req.body;
    if (!sessionId || sessionId !== activeSessionId) return res.status(400).json({ message: 'Invalid session.' });

    const fileToPrint = sessionFiles[sessionId]?.find(f => f.id === fileId);
    if (!fileToPrint) return res.status(404).json({ message: 'File not found.' });

    if (printerName === 'Secure_Virtual_Printer') {
        console.log(`[MOCK] Printing ${fileToPrint.originalname}`);
        setTimeout(() => {
            const index = sessionFiles[sessionId].findIndex(f => f.id === fileToPrint.id);
            if (index > -1) {
                sessionFiles[sessionId].splice(index, 1);
                fs.unlink(fileToPrint.path, (e) => { if(e) console.error(e); });
                io.emit('file-deleted', { sessionId, fileId: fileToPrint.id }); 
            }
        }, 2000);
        return res.status(200).json({ message: 'Sent to Secure Virtual Printer' });
    }

    const command = `lp -d ${printerName} "${fileToPrint.path}"`;
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`Print error: ${error}`);
            return res.status(500).json({ message: 'Print failed', error: error.message });
        }
        
        const index = sessionFiles[sessionId].findIndex(f => f.id === fileToPrint.id);
        if (index > -1) {
            sessionFiles[sessionId].splice(index, 1);
            fs.unlink(fileToPrint.path, (e) => { if(e) console.error(e); });
            io.emit('file-deleted', { sessionId, fileId: fileToPrint.id });
        }
        res.status(200).json({ message: `Sent to printer ${printerName}` });
    });
});

app.post('/end-session', async (req, res) => {
    if (!activeSessionId) return res.status(400).json({ message: 'No session.' });

    const sessionIdToEnd = activeSessionId;
    const directoryToClean = fileUploadDir;

    activeSessionId = null;
    fileUploadDir = null;

    try {
        await stopAndRemoveContainer(container);
        container = null;
        await cleanupSessionFiles(sessionIdToEnd, directoryToClean);
        io.emit('session-ended', { sessionId: sessionIdToEnd });
        console.log(`Session ${sessionIdToEnd} ended.`);
        res.status(200).json({ message: `Session ended.` });
    } catch (error) {
        console.error('End session error:', error);
        res.status(500).json({ message: 'Error ending session' });
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    if (activeSessionId) {
        socket.emit('current-session-status', {
            active: true,
            sessionId: activeSessionId,
            files: sessionFiles[activeSessionId] || []
        });
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Server running at http://${SERVER_IP}:${port}`);
});
