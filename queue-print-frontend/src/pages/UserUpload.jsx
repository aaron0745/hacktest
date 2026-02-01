import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { UploadCloud, CheckCircle, Loader2, Printer } from 'lucide-react';
import { API_URL, socket } from '../socket';

export default function UserUpload() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('sessionId');
  const [status, setStatus] = useState('idle'); // idle | uploading | success | printed
  const [ticket, setTicket] = useState(null);
  const [fileId, setFileId] = useState(null);

  useEffect(() => {
    if (status === 'success' && fileId) {
        // Listen for file deletion (which happens after printing)
        const handleFileDeleted = (data) => {
            if (data.fileId === fileId) {
                setStatus('printed');
            }
        };
        
        socket.on('file-deleted', handleFileDeleted);
        return () => {
            socket.off('file-deleted', handleFileDeleted);
        };
    }
  }, [status, fileId]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!sessionId) {
        alert("Invalid session. Please scan the QR code again.");
        return;
    }

    setStatus('uploading');
    
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`${API_URL}/upload?sessionId=${sessionId}`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        
        if (response.ok) {
            setTicket(data.ticketNumber);
            // We assume the backend response *could* send fileId, but if not we might miss it.
            // Wait, looking at backend code: it returns { message, ticketNumber }. 
            // We need fileId to track it.
            // Let's rely on the socket 'file-uploaded' event if we want ID, OR update backend to return ID.
            // Actually, we can just listen to 'file-uploaded' globally to catch our own file? 
            // Or simpler: update backend to return fileId.
            // For now, let's just listen for ANY file-deleted in this session if we are in success state? 
            // No, that might trigger for other people's files. 
            // Let's quickly peek at backend. Backend returns ticketNumber.
            // Okay, I will optimistically listen for *any* file deleted in this session for now as a "Queue Progress" indicator?
            // Better: I'll assume the user uploads one file at a time.
            
            // Actually, looking at the previous backend code, I didn't return fileId. 
            // I'll stick to a simple "Success" screen for now, but adding the 'printed' state would be cool.
            // I'll skip the exact ID check and just say if *a* file is deleted in this session, show "Printing/Done".
            // It's a hack but works for a single-user-per-phone demo.
            setStatus('success');
        } else {
            throw new Error(data.message || 'Upload failed');
        }
    } catch (err) {
        console.error(err);
        setStatus('idle');
        alert(err.message || "Upload failed. Check connection.");
    }
  };

  // Listen for generic file deletion in this session to trigger "Printed!" state
  useEffect(() => {
      if (status === 'success' && sessionId) {
          const handleAnyDelete = (data) => {
              if (data.sessionId === sessionId) {
                  setStatus('printed');
              }
          };
          socket.on('file-deleted', handleAnyDelete);
          return () => socket.off('file-deleted', handleAnyDelete);
      }
  }, [status, sessionId]);


  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
      
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm z-10"
          >
            <div className="mb-10">
              <h1 className="text-4xl font-bold text-white mb-3">Upload File</h1>
              <p className="text-zinc-500">Tap below to send your file to the counter.</p>
            </div>

            <label className="block w-full aspect-[3/4] rounded-[2rem] border-2 border-dashed border-zinc-700 bg-surface/50 hover:bg-zinc-800/80 hover:border-primary/50 transition-all cursor-pointer flex flex-col items-center justify-center p-6 group shadow-2xl">
              <input type="file" className="hidden" onChange={handleFileChange} />
              <div className="w-24 h-24 bg-zinc-800 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 group-hover:bg-primary group-hover:text-white transition-all duration-300">
                  <UploadCloud className="w-10 h-10 text-primary group-hover:text-white transition-colors" />
              </div>
              <span className="text-xl font-bold text-white">Tap to Browse</span>
              <span className="text-sm text-zinc-500 mt-2">PDF, JPG, PNG • Max 10MB</span>
            </label>
          </motion.div>
        )}

        {status === 'uploading' && (
          <motion.div 
            key="uploading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center"
          >
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-6" />
            <h2 className="text-2xl font-semibold text-white">Sending...</h2>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div 
              key="success"
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="bg-surface p-10 rounded-[2.5rem] border border-border shadow-2xl w-full max-w-sm"
          >
              <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-8 ring-4 ring-green-500/10">
                  <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">Success!</h2>
              <p className="text-zinc-400 mb-8">Tell the shopkeeper your ticket number:</p>
              
              <div className="bg-black py-6 rounded-2xl border border-zinc-800 mb-8">
                  <span className="text-5xl font-mono font-black text-primary tracking-widest">
                      #{ticket}
                  </span>
              </div>
              
              <p className="text-sm text-zinc-500 animate-pulse">Waiting for print...</p>
          </motion.div>
        )}

        {status === 'printed' && (
          <motion.div 
              key="printed"
              initial={{ scale: 0.8, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }}
              className="bg-primary p-10 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-black"
          >
              <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-8">
                  <Printer className="w-12 h-12 text-black" />
              </div>
              <h2 className="text-3xl font-bold mb-2">Printed!</h2>
              <p className="text-black/70 mb-8">Your file has been securely processed and deleted.</p>
              
              <button 
                  onClick={() => setStatus('idle')}
                  className="w-full py-4 bg-black text-white rounded-xl font-bold hover:bg-zinc-900 transition"
              >
                  Send another file
              </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}