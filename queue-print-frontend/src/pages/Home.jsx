import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Printer, ArrowRight, Zap } from 'lucide-react';
import { socket } from '../socket';

export default function Home() {
  const navigate = useNavigate();

  const startSession = () => {
    // Navigate to dashboard
    navigate('/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen relative overflow-hidden">
      {/* Ambient Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="z-10 text-center space-y-8 max-w-2xl px-6"
      >
        <div className="inline-flex items-center justify-center p-4 bg-surface border border-border rounded-2xl shadow-2xl mb-4">
          <Printer className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-6xl md:text-7xl font-bold tracking-tighter text-white">
          Queue<span className="text-primary">Print</span>
        </h1>
        
        <p className="text-zinc-400 text-xl font-light">
          The instant batch printing system for high-traffic environments.
          <br /> One QR code. Infinite uploads.
        </p>

        <div className="pt-8">
            <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={startSession}
            className="group relative inline-flex items-center gap-3 px-10 py-4 bg-white text-black font-bold rounded-full text-lg shadow-[0_0_40px_-10px_rgba(255,255,255,0.3)] hover:shadow-[0_0_60px_-15px_rgba(255,255,255,0.5)] transition-all"
            >
            Start Session
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
        </div>
      </motion.div>
      
      {/* Footer Branding */}
      <div className="absolute bottom-8 text-zinc-600 text-sm font-mono flex items-center gap-2">
        <Zap className="w-3 h-3" /> POWERED BY SOCKET.IO
      </div>
    </div>
  );
}