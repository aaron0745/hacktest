import QRCode from "react-qr-code";

export default function QRDisplay() {
  // Points to the Upload Page on the local network
  const uploadUrl = `${window.location.protocol}//${window.location.hostname}:${window.location.port}/upload`;

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-primary text-white p-6">
      <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl mb-10">
        <QRCode 
            value={uploadUrl} 
            size={280} 
            fgColor="#000000" 
            bgColor="#ffffff" 
        />
      </div>
      
      <h1 className="text-5xl font-black text-center mb-3 tracking-tighter">SCAN ME</h1>
      <p className="text-white/80 text-xl font-medium">To upload your files</p>
      
      <div className="mt-16 px-6 py-3 bg-black/20 rounded-full font-mono text-sm backdrop-blur-md border border-white/10">
        {uploadUrl}
      </div>
    </div>
  );
}