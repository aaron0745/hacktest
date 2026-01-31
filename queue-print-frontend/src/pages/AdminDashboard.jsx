import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, X, Printer, Smartphone, LogOut, Clock, Loader2 } from 'lucide-react';
import { socket, API_URL } from '../socket';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [files, setFiles] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Initial check for active session
    socket.on('current-session-status', (data) => {
      if (data.active) {
        setSessionId(data.sessionId);
        setFiles(data.files || []);
      }
    });

    // Session lifecycle events
    socket.on('session-started', (data) => {
        setSessionId(data.sessionId);
        setFiles([]);
    });

    socket.on('session-ended', () => {
        setSessionId(null);
        setFiles([]);
        navigate('/');
    });

    // File events
    socket.on('file-uploaded', (data) => {
        // Only add if it belongs to current session (though socket usually implies this)
        if (data.sessionId === sessionId || !sessionId) { 
             setFiles((prev) => [...prev, data.file]);
        }
    });

    socket.on('file-deleted', (data) => {
        setFiles((prev) => prev.filter(f => f.id !== data.fileId));
        if (selectedFile?.id === data.fileId) {
            setSelectedFile(null);
        }
    });

    return () => {
      socket.off('current-session-status');
      socket.off('session-started');
      socket.off('session-ended');
      socket.off('file-uploaded');
      socket.off('file-deleted');
    };
  }, [sessionId, selectedFile, navigate]);

  const handleEndSession = async () => {
    if (confirm("Are you sure? This will delete all files and close the session.")) {
      try {
        await fetch(`${API_URL}/end-session`, { method: 'POST' });
        // Navigation handled by socket event 'session-ended'
      } catch (e) {
        alert("Error ending session");
        console.error(e);
      }
    }
  };

  const handlePrint = async () => {
      if (!selectedFile || !sessionId) return;
      
      setIsPrinting(true);
      try {
          const response = await fetch(`${API_URL}/print/${selectedFile.id}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
          });
          
          if (response.ok) {
              // File will be deleted by backend and 'file-deleted' event will close modal
              alert("Sent to printer successfully!");
          } else {
              const err = await response.json();
              alert(`Print failed: ${err.message}`);
          }
      } catch (error) {
          console.error(error);
          alert("Network error while trying to print.");
      } finally {
          setIsPrinting(false);
      }
  };

  // Helper to format bytes
  const formatSize = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileUrl = (file) => {
      if (!file || !sessionId) return '';
      return `${API_URL}/uploads/session_${sessionId}/${file.filename}`;
  };

  return (
    <div className="min-h-screen p-6 md:p-10 pb-24 relative bg-background text-white">
      
      {/* Header */}
      <header className="flex justify-between items-center mb-10 border-b border-zinc-800 pb-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          {sessionId ? (
             <div className="flex items-center gap-2 text-green-400 mt-1 text-sm font-medium">
                <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                Session Active
            </div>
          ) : (
            <div className="text-zinc-500 mt-1 text-sm">No active session</div>
          )}
        </div>
        
        {sessionId && (
            <button 
            onClick={() => window.open(`/qr?sessionId=${sessionId}`, '_blank')} 
            className="flex items-center gap-2 text-sm font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-5 py-2.5 rounded-lg border border-zinc-700 transition-all"
            >
            <Smartphone className="w-4 h-4" />
            View QR
            </button>
        )}
      </header>

      {/* Empty State */}
      {files.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[50vh] border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
            <Clock className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-lg">Waiting for user uploads...</p>
        </div>
      )}

      {/* File List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {files.map((file) => (
            <motion.div
              key={file.id}
              layout
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedFile(file)}
              className="bg-surface/50 border border-zinc-700/50 backdrop-blur cursor-pointer p-5 rounded-2xl hover:border-primary/50 hover:bg-zinc-800/80 transition-all shadow-lg group relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Printer className="w-5 h-5 text-primary" />
              </div>
              <div className="flex justify-between items-start mb-4">
                <div className="bg-zinc-800 p-3 rounded-xl group-hover:bg-zinc-700 transition-colors">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <span className="text-xs font-mono font-bold bg-primary/20 text-primary px-2 py-1 rounded">
                  {file.ticketNumber}
                </span>
              </div>
              <h3 className="font-semibold text-white truncate pr-2" title={file.originalname}>{file.originalname}</h3>
              <p className="text-zinc-500 text-xs mt-1 font-mono">{formatSize(file.size)}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Floating End Session Button (Bottom Right) */}
      {sessionId && (
        <div className="fixed bottom-8 right-8 z-40">
            <button 
                onClick={handleEndSession}
                className="flex items-center gap-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-8 py-4 rounded-full font-bold shadow-2xl backdrop-blur-md transition-all hover:scale-105 hover:shadow-red-900/20"
            >
                <LogOut className="w-5 h-5" />
                End Session
            </button>
        </div>
      )}

      {/* Print Preview Modal */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          >
            <motion.div 
              initial={{ y: 50, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 50, scale: 0.95 }}
              className="bg-zinc-900 w-full max-w-4xl h-[85vh] rounded-3xl border border-zinc-700 shadow-2xl overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900 z-10">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-3">
                        {selectedFile.originalname}
                        <span className="text-xs font-mono font-normal bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            {formatSize(selectedFile.size)}
                        </span>
                    </h3>
                  </div>
                  <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-zinc-800 rounded-full transition text-zinc-400 hover:text-white">
                      <X className="w-6 h-6" />
                  </button>
              </div>
              
              {/* Preview Area */}
              <div className="flex-1 bg-zinc-950 relative overflow-hidden flex flex-col items-center justify-center">
                    {/* Render iframe for preview */}
                    <iframe 
                        src={getFileUrl(selectedFile)} 
                        className="w-full h-full object-contain border-0" 
                        title="File Preview"
                    />
              </div>

              {/* Modal Footer / Actions */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-900">
                <div className="flex gap-4">
                    <button 
                        onClick={() => setSelectedFile(null)}
                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-4 rounded-xl transition"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={handlePrint}
                        disabled={isPrinting}
                        className="flex-[2] bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isPrinting ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Sending to Printer...
                            </>
                        ) : (
                            <>
                                <Printer className="w-5 h-5" />
                                Print Now
                            </>
                        )}
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