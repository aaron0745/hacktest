# Safe-Print 🖨️

Safe-Print is a real-time, session-based secure printing queue system designed for print shops and shared environments. It simplifies the document submission process by allowing users to scan a dynamic QR code and upload files directly from their mobile devices without needing to transfer files via USB or email.

## 🚀 Features

- **Instant QR Code Sessions:** Admins can start a session which generates a unique QR code for users to scan and join.
- **Real-Time Queue Management:** Files appear instantly on the admin dashboard as they are uploaded using WebSockets.
- **PDF Page Counting:** Automatically analyzes uploaded PDF files to display page counts for billing convenience.
- **Docker-Powered Isolation:** Each session creates a dedicated environment (using Docker and CUPS) for secure print management.
- **Automated Cleanup:** To maintain security and storage, uploaded files have a built-in TTL (Time-To-Live) and session resources are purged upon completion.
- **Zero Configuration Discovery:** Automatically detects the server's local IP address to ensure the QR code works seamlessly within the local network.

---

## 🛠️ Tech Stack

### Frontend
- **React.js** (Vite)
- **Socket.io-client** for real-time updates
- **Tailwind CSS** for responsive design
- **Lucide React** for iconography

### Backend
- **Node.js & Express**
- **Socket.io** for bi-directional communication
- **Dockerode** for managing session-based Docker containers
- **Multer** for handling file uploads
- **PDF-Parse** for document analysis
- **QRCode** for dynamic generation

### Infrastructure
- **Docker:** Utilizes a custom Ubuntu-based image with CUPS (Common Unix Printing System) for print job handling.

---

## 📦 Project Structure

```text
/
├── queue-print-backend/   # Express server, Docker management, and Socket.io
└── queue-print-frontend/  # React application (Admin Dashboard & User Upload)
```

---

## ⚙️ Getting Started

### Prerequisites
- **Node.js** (v18+ recommended)
- **Docker** installed and running on the host machine
- **npm** or **yarn**

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd safe-print
   ```

2. **Environment Configuration:**
   Create a `.env` file in both `queue-print-backend` and `queue-print-frontend` directories.
   
   **Backend (`queue-print-backend/.env`):**
   ```env
   DEVICE_IP=your_local_ip
   ```
   
   **Frontend (`queue-print-frontend/.env`):**
   ```env
   VITE_DEVICE_IP=your_local_ip
   ```

3. **Setup Backend:**
   ```bash
   cd queue-print-backend
   npm install
   ```

3. **Setup Frontend:**
   ```bash
   cd ../queue-print-frontend
   npm install
   ```

### Running the Application

1. **Start the Backend:**
   ```bash
   cd queue-print-backend
   npm start
   ```
   *The server will detect your LAN IP and start on port 3001.*

2. **Start the Frontend (Development):**
   ```bash
   cd queue-print-frontend
   npm run dev
   ```
   *The dashboard will be available at `http://localhost:5173`.*

---

## 🛠️ Usage Flow

1. **Admin Dashboard:** The shopkeeper opens the dashboard and clicks "Start Session".
2. **QR Generation:** A QR code is displayed on the screen.
3. **User Upload:** Customers scan the QR code, which opens a simple upload interface on their phone.
4. **Queue Update:** As users upload files (PDFs, Images), they appear in real-time on the Admin Dashboard with metadata like filename, size, and page count.
5. **Session End:** Once printing is complete, the admin ends the session, which automatically stops the Docker container and wipes all temporary files.

---

## 🛡️ Security

- **Isolation:** Uploaded files are scoped to specific sessions.
- **Volatility:** Files are automatically deleted after 2 minutes or when the session ends.
- **Containerization:** CUPS services are isolated within Docker to prevent host system exposure.

---

## 📄 License

This project is licensed under the ISC License.
