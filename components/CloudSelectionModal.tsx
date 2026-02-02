import React, { useState, useEffect } from 'react';
import { X, Cloud, Loader2 } from 'lucide-react';
import { useCloudUploads, getSignedUrl } from '../hooks/useCloudUploads';
import { extractFromCloudUrl, extractPairFromCloudUrls } from '../services/geminiService';
import type { CloudUpload } from '../types';

interface CloudSelectionModalProps {
  open: boolean;
  onClose: () => void;
  onExtract: (result: { entries: any[]; pageTotals?: any }, mode: 'single' | 'spread', cloudUploadIds: string[]) => void;
  userId: string | undefined;
}

const CloudSelectionModal: React.FC<CloudSelectionModalProps> = ({
  open,
  onClose,
  onExtract,
  userId,
}) => {
  const { uploads, pendingCount, loading, error, refetch } = useCloudUploads(userId);
  const [selected, setSelected] = useState<string[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const pending = uploads.filter((u) => u.status === 'pending');

  useEffect(() => {
    if (!open) return;
    refetch();
    setSelected([]);
    setExtractError(null);
  }, [open, refetch]);

  useEffect(() => {
    if (pending.length === 0) return;
    let cancelled = false;
    const load = async () => {
      const map: Record<string, string> = {};
      for (const u of pending) {
        if (cancelled) break;
        try {
          const url = await getSignedUrl(u.storage_path, 300);
          map[u.id] = url;
        } catch {
          map[u.id] = '';
        }
      }
      if (!cancelled) setThumbnails((m) => ({ ...m, ...map }));
    };
    load();
    return () => { cancelled = true; };
  }, [open, pending.map((u) => u.id).join(',')]);

  const toggle = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const handleExtract = async () => {
    if (selected.length === 0 || !userId) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const urls = await Promise.all(
        selected.map((id) => {
          const u = pending.find((x) => x.id === id);
          return u ? getSignedUrl(u.storage_path, 3600) : Promise.reject(new Error('Upload not found'));
        })
      );
      const mode: 'single' | 'spread' = selected.length === 2 ? 'spread' : 'single';
      const result =
        mode === 'single'
          ? await extractFromCloudUrl(urls[0])
          : await extractPairFromCloudUrls(urls[0], urls[1]);
      onExtract(result, mode, selected);
      onClose();
    } catch (err: any) {
      setExtractError(err?.message || 'Extraction failed');
    } finally {
      setExtracting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#E2E8F0]">
          <h3 className="text-lg font-bold text-[#003366] flex items-center gap-2">
            <Cloud className="w-5 h-5 text-[#007BFF]" />
            Import from Cloud
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-[#003366]/70 hover:text-[#003366] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#007BFF] animate-spin" />
            </div>
          )}
          {error && (
            <p className="text-red-600 text-sm py-2">{error}</p>
          )}
          {!loading && pending.length === 0 && !error && (
            <p className="text-[#003366]/70 text-sm py-6 text-center">
              No pending scans. Capture on your phone to sync here.
            </p>
          )}
          {!loading && pending.length > 0 && (
            <>
              <p className="text-sm text-[#003366]/70 mb-3">
                Select 1 for single page or 2 for spread, then Extract.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {pending.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className={`relative rounded-xl border-2 overflow-hidden aspect-[3/4] transition-all ${
                      selected.includes(u.id)
                        ? 'border-[#007BFF] ring-2 ring-[#007BFF]/30'
                        : 'border-[#E2E8F0] hover:border-[#007BFF]/50'
                    }`}
                  >
                    {thumbnails[u.id] ? (
                      <img
                        src={thumbnails[u.id]}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#F4F7FA] flex items-center justify-center">
                        <Cloud className="w-8 h-8 text-[#003366]/40" />
                      </div>
                    )}
                    {selected.includes(u.id) && (
                      <span className="absolute top-1 right-1 w-6 h-6 bg-[#007BFF] text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {selected.indexOf(u.id) + 1}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {extractError && (
                <p className="text-red-600 text-sm mt-3">{extractError}</p>
              )}
            </>
          )}
        </div>

        {!loading && pending.length > 0 && (
          <div className="p-4 border-t border-[#E2E8F0] flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-[#E2E8F0] text-[#003366] font-semibold hover:bg-[#F4F7FA] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExtract}
              disabled={selected.length === 0 || extracting}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#003366] text-white font-semibold hover:bg-[#003366]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Extracting…
                </>
              ) : (
                `Extract ${selected.length === 2 ? 'Spread' : selected.length === 1 ? 'Single' : ''}`
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudSelectionModal;
