import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AdminDashboard from './pages/AdminDashboard';
import QRDisplay from './pages/QRDisplay';
import UserUpload from './pages/UserUpload';

function App() {
  return (
    <div className="min-h-screen selection:bg-primary/30">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<AdminDashboard />} />
        <Route path="/qr" element={<QRDisplay />} />
        <Route path="/upload" element={<UserUpload />} />
      </Routes>
    </div>
  );
}

export default App;