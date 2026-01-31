import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Printer, Smartphone, LogOut, Clock } from 'lucide-react';
import { socket, API_URL } from '../socket';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Listen for incoming files
    socket.on('new-file-received', (file) => {
      setFiles((prev) => [file, ...prev]);
    });

    socket.on('session-reset', () => setFiles([]));

    return () => {
      socket.off('new-file-received');
      socket.off('session-reset');
    };
  }, []);

  const handleEndSession = async () => {
    if (confirm("Are you sure? This will NUKE all files.")) {
      try {
        await fetch(`${API_URL}/nuke`, { method: 'POST' });
        navigate('/');
      } catch (e) {
        alert("Error ending session");
      }
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-10 pb-24 relative">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-10 border-b border-border pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-white">Dashboard</h2>
          <div className="flex items-center gap-2 text-zinc-500 mt-1 text-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live Session Active
          </div>
        </div>
        
        <button 
          onClick={() => window.open('/qr', '_blank')} 
          className="flex items-center gap-2 text-sm font-medium bg-surface hover:bg-zinc-800 text-zinc-200 px-5 py-2.5 rounded-lg border border-border transition-all"
        >
          <Smartphone className="w-4 h-4" />
          View QR
        </button>
      </header>

      {/* Empty State */}
      {files.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
            <Clock className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">Waiting for scans...</p>
        </div>
      )}

      {/* File List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {files.map((file) => (
            <motion.div
              key={file.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedFile(file)}
              className="glass group cursor-pointer p-5 rounded-2xl hover:border-zinc-600 transition-all shadow-lg"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="bg-zinc-800 p-3 rounded-xl">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-mono font-bold bg-zinc-800 text-primary px-2 py-1 rounded">
                  #{file.ticket}
                </span>
              </div>
              <h3 className="font-semibold text-white truncate pr-2">{file.name}</h3>
              <p className="text-zinc-500 text-xs mt-1 font-mono">{file.size}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating End Session Button (Bottom Right) */}
      <div className="fixed bottom-8 right-8 z-40">
        <button 
            onClick={handleEndSession}
            className="flex items-center gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-8 py-4 rounded-full font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:shadow-red-900/20"
        >
            <LogOut className="w-5 h-5" />
            End Session
        </button>
      </div>

      {/* Print Preview Modal */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ y: 50, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 50, scale: 0.95 }}
              className="bg-surface w-full max-w-md rounded-3xl border border-border shadow-2xl overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-lg font-bold text-white">Print Preview</h3>
                    <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-zinc-800 rounded-full transition"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="bg-background py-12 rounded-2xl border border-zinc-800 flex flex-col items-center justify-center mb-8">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full"></div>
                        <FileText className="relative w-20 h-20 text-white mb-4" />
                    </div>
                    <p className="text-center font-bold text-xl px-4 truncate w-full">{selectedFile.name}</p>
                    <p className="text-zinc-500 text-sm mt-2">{selectedFile.size} • PDF Document</p>
                    <div className="mt-4 bg-zinc-800 px-3 py-1 rounded text-xs font-mono text-zinc-400">
                        Ticket #{selectedFile.ticket}
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setSelectedFile(null)}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 rounded-xl transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            alert(`Sent ${selectedFile.name} to printer!`);
                            setSelectedFile(null);
                        }}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-primary/25"
                    >
                        <Printer className="w-5 h-5" />
                        Print
                    </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}