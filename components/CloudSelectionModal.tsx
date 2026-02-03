import React, { useState, useEffect, useMemo } from 'react';
import { X, Cloud, Loader2, Trash2 } from 'lucide-react';
import { useCloudUploads, getSignedUrl, deleteFromCloud } from '../hooks/useCloudUploads';
import type { CloudUpload } from '../types';

/** One importable unit: either a single page (1 upload) or a spread pair (2 uploads). */
type CloudUnit = { mode: 'single' | 'spread'; uploads: CloudUpload[] };

interface CloudSelectionModalProps {
  open: boolean;
  onClose: () => void;
  /** Called with downloaded image data URLs; app adds a pending scan and user clicks Extract on dashboard. */
  onImport: (images: string[], mode: 'single' | 'spread', cloudUploadIds: string[]) => void;
  userId: string | undefined;
}

/** Build units from pending uploads: group by upload_group_id; each single (null group) is one unit, each pair (same id) is one spread unit. */
function buildUnits(pending: CloudUpload[]): CloudUnit[] {
  const units: CloudUnit[] = [];
  const seenGroupIds = new Set<string>();
  const sorted = [...pending].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const u of sorted) {
    const gid = u.upload_group_id ?? null;
    if (gid !== null) {
      if (seenGroupIds.has(gid)) continue;
      seenGroupIds.add(gid);
      const pair = sorted.filter((p) => p.upload_group_id === gid);
      const uploads = pair.slice(0, 2);
      units.push({ mode: uploads.length === 2 ? 'spread' : 'single', uploads });
    } else {
      units.push({ mode: 'single', uploads: [u] });
    }
  }
  return units;
}

const CloudSelectionModal: React.FC<CloudSelectionModalProps> = ({
  open,
  onClose,
  onImport,
  userId,
}) => {
  const { uploads, loading, error, refetch } = useCloudUploads(userId);
  /** Selected unit key: upload ids joined (stable for comparison). */
  const [selectedUnitKey, setSelectedUnitKey] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [deletingUnitKey, setDeletingUnitKey] = useState<string | null>(null);

  const pending = uploads.filter((u) => u.status === 'pending');
  const units = useMemo(() => buildUnits(pending), [pending]);

  useEffect(() => {
    if (!open) return;
    refetch();
    setSelectedUnitKey(null);
    setImportError(null);
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

  const selectedUnit = useMemo(
    () => (selectedUnitKey ? units.find((u) => u.uploads.map((x) => x.id).join(',') === selectedUnitKey) ?? null : null),
    [units, selectedUnitKey]
  );

  const importButtonLabel =
    selectedUnit === null
      ? 'Import to dashboard'
      : selectedUnit.mode === 'spread'
        ? 'Import spread'
        : 'Import page';

  const handleDeleteFromCloud = async (unit: CloudUnit) => {
    if (!userId) return;
    const ids = unit.uploads.map((u) => u.id);
    if (!confirm('Remove this from the cloud? The images will be deleted and cannot be recovered.')) return;
    setDeletingUnitKey(unit.uploads.map((u) => u.id).join(','));
    setImportError(null);
    try {
      await deleteFromCloud(userId, ids);
      refetch();
      setSelectedUnitKey(null);
    } catch (err: any) {
      setImportError(err?.message || 'Failed to remove from cloud');
    } finally {
      setDeletingUnitKey(null);
    }
  };

  const handleImport = async () => {
    if (!selectedUnit || selectedUnit.uploads.length === 0 || !userId) return;
    setImporting(true);
    setImportError(null);
    try {
      const urls = await Promise.all(
        selectedUnit.uploads.map((u) => getSignedUrl(u.storage_path, 3600))
      );
      const dataUrls = await Promise.all(
        urls.map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to download image');
          const blob = await res.blob();
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Failed to read image'));
            reader.readAsDataURL(blob);
          });
        })
      );
      onImport(dataUrls, selectedUnit.mode, selectedUnit.uploads.map((u) => u.id));
      onClose();
    } catch (err: any) {
      setImportError(err?.message || 'Download failed');
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-[#E2E8F0]">
          <div className="flex items-center justify-between">
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
          <p className="text-sm text-[#003366]/70 mt-2">Select a page or pages to import.</p>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {units.map((unit) => {
                  const unitKey = unit.uploads.map((u) => u.id).join(',');
                  const isSelected = selectedUnitKey === unitKey;
                  const isDeleting = deletingUnitKey === unitKey;
                  return (
                    <div
                      key={unitKey}
                      className={`relative rounded-xl border-2 overflow-hidden transition-all ${
                        isSelected ? 'border-[#007BFF] ring-2 ring-[#007BFF]/30' : 'border-[#E2E8F0]'
                      } ${unit.mode === 'spread' ? 'aspect-[3/2]' : 'aspect-[3/4]'}`}
                    >
                      <button
                        type="button"
                        onClick={() => !isDeleting && setSelectedUnitKey(isSelected ? null : unitKey)}
                        disabled={isDeleting}
                        className="absolute inset-0 w-full h-full text-left hover:bg-[#007BFF]/5 transition-colors disabled:opacity-70"
                      >
                        <div className={`absolute inset-0 flex ${unit.mode === 'spread' ? 'flex-row' : ''}`}>
                          {unit.uploads.map((u) => (
                            <div
                              key={u.id}
                              className={unit.mode === 'spread' ? 'flex-1 min-w-0' : 'w-full h-full'}
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
                            </div>
                          ))}
                        </div>
                        {isSelected && (
                          <span className="absolute top-1 right-10 w-6 h-6 bg-[#007BFF] text-white rounded-full flex items-center justify-center pointer-events-none">
                            <span className="text-xs font-bold">✓</span>
                          </span>
                        )}
                        {unit.mode === 'spread' && (
                          <span className="absolute bottom-1 left-1 text-[10px] font-medium text-white bg-black/50 px-1.5 py-0.5 rounded pointer-events-none">
                            Spread
                          </span>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isDeleting && userId) handleDeleteFromCloud(unit);
                        }}
                        disabled={isDeleting}
                        className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-red-500/90 hover:bg-red-600 text-white flex items-center justify-center shadow transition-colors disabled:opacity-70"
                        aria-label="Remove from cloud"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              {importError && (
                <p className="text-red-600 text-sm mt-3">{importError}</p>
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
              onClick={handleImport}
              disabled={!selectedUnit || importing}
              className="flex-1 px-4 py-2.5 rounded-xl bg-[#003366] text-white font-semibold hover:bg-[#003366]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Downloading…
                </>
              ) : (
                importButtonLabel
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CloudSelectionModal;
