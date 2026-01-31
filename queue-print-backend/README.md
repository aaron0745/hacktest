# Safe-Print Backend

This is the backend for the Safe-Print application. It is built with Node.js, Express, Socket.io, and Docker.

## Setup and Running

### Prerequisites

*   [Node.js](https://nodejs.org/) installed
*   [Docker](https://www.docker.com/products/docker-desktop) installed and running

### 1. Install Dependencies

Dependencies are already defined in `package.json`. If you haven't installed them yet, run:

```bash
npm install
```

### 2. Configure IP Address

In `index.js`, you need to replace the hardcoded IP address with the local IP address of the machine running the server. This is so that the QR code points to the correct address.

Find this line in `index.js`:

```javascript
const ip = '192.168.1.5'; // Replace with your local IP
```

Replace `192.168.1.5` with your machine's local IP address.

### 3. Start the Backend Server

To start the backend server, run:

```bash
npm start
```

The server will start on port 3000.

### 4. Build and Serve the Frontend

The backend is configured to serve the frontend from the `../queue-print-frontend/dist` directory. You will need to build the React frontend first.

To do this, navigate to the `queue-print-frontend` directory and run:

```bash
npm install
npm run build
```

Once the frontend is built, the backend server will automatically serve it.

## How it Works

1.  **Start a Session:** When the shopkeeper starts a session, a new Docker container is created to store the uploaded files for that session. A unique session ID is generated, and a QR code is created that contains the upload URL with the session ID.
2.  **File Upload:** When a user scans the QR code and uploads a file, the file is stored in the Docker container for the current session.
3.  **Real-time Updates:** The shopkeeper's dashboard is updated in real-time with the details of the uploaded files using Socket.io.
4.  **Printing:** The shopkeeper can view the uploaded files and print them. The files are served directly from the Docker container.
5.  **End Session:** When the shopkeeper ends the session, the Docker container is stopped and removed, and all the files from that session are deleted.
