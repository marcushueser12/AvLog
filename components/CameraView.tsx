
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ICONS } from '../constants';

interface CameraViewProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
  // Note: App.tsx handles batch processing, but for the camera fallback 
  // we'll keep it simple or redirect to the main app's batch handler.
}

const CameraView: React.FC<CameraViewProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setError("Unable to access camera. Please use file upload instead.");
      console.error(err);
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCapture(dataUrl);
      }
    }
  };

  // If fallback is used from within camera view, we process one at a time for simplicity
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onCapture(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="p-4 flex justify-between items-center bg-slate-900 border-b border-slate-800">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ICONS.Camera /> Scan Logbook Page
        </h2>
        <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {error ? (
          <div className="text-center p-8 bg-slate-900 rounded-xl max-w-sm">
            <p className="text-red-400 mb-4">{error}</p>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700"
            />
          </div>
        ) : (
          <>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="max-h-full max-w-full object-contain"
            />
            {/* Guide overlay */}
            <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                <div className="w-full h-full border-2 border-dashed border-blue-400/50 rounded-lg flex items-center justify-center">
                    <p className="text-white/30 text-xs font-medium uppercase tracking-widest">Align logbook page here</p>
                </div>
            </div>
          </>
        )}
      </div>

      <div className="p-8 bg-slate-900 flex justify-around items-center border-t border-slate-800">
        <div className="w-12">
            <label className="cursor-pointer hover:text-blue-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </label>
        </div>
        
        {!error && (
            <button 
                onClick={captureFrame}
                className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            >
                <div className="w-16 h-16 rounded-full bg-white"></div>
            </button>
        )}

        <div className="w-12"></div>
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraView;
