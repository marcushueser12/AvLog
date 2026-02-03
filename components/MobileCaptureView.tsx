import React, { useRef, useState } from 'react';
import { Camera, Cloud, CheckCircle2 } from 'lucide-react';
import { uploadToCloud } from '../hooks/useCloudUploads';
import { useAuth } from '../contexts/AuthContext';

/**
 * Mobile-only view: vertical, capture-only. Used as the "camera" of the operation.
 * User captures single page or spread (one or two photos), uploads to Supabase Storage,
 * inserts into cloud_uploads. Desktop will show these under "Import from Cloud".
 */
const MobileCaptureView: React.FC = () => {
  const { user } = useAuth();
  const singleInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [lastSync, setLastSync] = useState<boolean | null>(null); // true = success, false = error

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>, mode: 'single' | 'spread') => {
    const files = e.target.files;
    if (!files?.length || !user) return;
    e.target.value = '';

    setUploading(true);
    setLastSync(null);
    setErrorMessage(null);
    try {
      const file = files[0];
      await uploadToCloud(user.id, file);
      if (mode === 'spread' && files[1]) {
        await uploadToCloud(user.id, files[1]);
      }
      setLastSync(true);
    } catch (err: any) {
      console.error('Cloud upload failed:', err);
      setLastSync(false);
      const msg = err?.message || '';
      if (msg.includes('Permission denied') || msg.includes('sign in')) {
        setErrorMessage('Session expired. Please sign in again and try again.');
      } else if (msg.includes('too large') || msg.includes('10 MB')) {
        setErrorMessage('Photo is too large. Use a photo under 10 MB.');
      } else if (msg.includes('format not supported') || msg.includes('JPG or PNG')) {
        setErrorMessage('Photo format not supported. Use JPG or PNG.');
      } else {
        setErrorMessage(msg || 'Upload failed. Check connection and try again.');
      }
    } finally {
      setUploading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
        <p className="text-[#003366]/80 font-medium">Sign in to sync scans to the cloud.</p>
        <p className="text-sm text-[#003366]/60 mt-2">Then open the app on desktop to extract and review.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-lg font-bold text-[#003366]">Capture & Sync</h2>
        <p className="text-sm text-[#003366]/70">
          Take a photo of a logbook page (or two for a spread). It will sync to the cloud for extraction on desktop.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs">
        <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 bg-white/80 border-2 border-[#007BFF]/30 rounded-xl shadow-sm hover:bg-[#007BFF]/5 transition-all cursor-pointer min-h-[120px]">
          <Camera className="w-8 h-8 text-[#007BFF]" />
          <span className="text-sm font-semibold text-[#003366]">Single page</span>
          <input
            ref={singleInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleCapture(e, 'single')}
          />
        </label>
        <label className="flex-1 flex flex-col items-center justify-center gap-2 p-6 bg-white/80 border-2 border-[#007BFF]/30 rounded-xl shadow-sm hover:bg-[#007BFF]/5 transition-all cursor-pointer min-h-[120px]">
          <Camera className="w-8 h-8 text-[#007BFF]" />
          <span className="text-sm font-semibold text-[#003366]">Spread (2 photos)</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleCapture(e, 'spread')}
          />
        </label>
      </div>

      {uploading && (
        <div className="flex items-center gap-2 text-[#007BFF]">
          <span className="w-4 h-4 border-2 border-[#007BFF] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Syncing to cloud…</span>
        </div>
      )}

      {lastSync === true && !uploading && (
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-sm font-medium">Synced to cloud</span>
        </div>
      )}

      {lastSync === false && !uploading && errorMessage && (
        <div className="text-center space-y-1">
          <p className="text-sm text-red-600 font-medium">{errorMessage}</p>
          <p className="text-xs text-[#003366]/60">Try again or use a different photo (JPG/PNG under 10 MB).</p>
        </div>
      )}

      <div className="flex items-center gap-2 text-[#003366]/60 text-xs mt-4">
        <Cloud className="w-4 h-4" />
        <span>Open LogExtract on desktop → Import from Cloud to extract.</span>
      </div>
    </div>
  );
};

export default MobileCaptureView;
