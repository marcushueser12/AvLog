import { useState, useEffect, useCallback } from 'react';
import heic2any from 'heic2any';
import { supabase } from '../lib/supabase';
import type { CloudUpload } from '../types';

const BUCKET = 'logbook_scans';

const HEIC_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXT = /\.(heic|heif)$/i;

const MAX_UPLOAD_DIM = 2048;
const UPLOAD_JPEG_QUALITY = 0.88;
const LARGE_FILE_BYTES = 1.2 * 1024 * 1024; // 1.2MB – resize if larger

const UPLOAD_RETRIES = 3;
const UPLOAD_RETRY_DELAY_MS = 2000;
const INSERT_RETRIES = 3;
const INSERT_RETRY_DELAY_MS = 1000;

let resizeWorker: Worker | null = null;

function getResizeWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (resizeWorker) return resizeWorker;
  try {
    resizeWorker = new Worker(new URL('../workers/imageResize.worker.ts', import.meta.url), { type: 'module' });
    return resizeWorker;
  } catch {
    return null;
  }
}

/** True if value looks like a File/Blob (some mobile contexts don't pass instanceof Blob). */
function isFileLike(value: unknown): value is File | Blob {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  return typeof o.size === 'number' && typeof o.slice === 'function';
}

/** Convert HEIC/HEIF (e.g. from iPhone) to JPEG before upload. No HEIC is stored. */
async function normalizeImageFile(file: File | Blob): Promise<File> {
  if (!file || !isFileLike(file)) return file as File;
  const type = typeof (file as File).type === 'string' ? (file as File).type : '';
  const name = typeof (file as File).name === 'string' ? (file as File).name : '';
  const isHeic = HEIC_TYPES.includes(type) || HEIC_EXT.test(name);
  if (!isHeic) return file instanceof File ? file : new File([file], name || 'photo', { type: type || 'image/jpeg' });

  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob || !isFileLike(blob)) throw new Error('HEIC conversion failed.');
    const outName = (name || 'photo').replace(HEIC_EXT, '.jpg');
    return new File([blob], outName, { type: 'image/jpeg' });
  } catch (e) {
    throw new Error('Photo format not supported. Try saving as JPG or use a different photo.');
  }
}

/** Resize in worker; fallback to main-thread resize if worker unavailable. */
async function resizeIfLarge(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= LARGE_FILE_BYTES) return file;
  const worker = getResizeWorker();
  if (worker) {
    try {
      const id = crypto.randomUUID();
      const arrayBuffer = await file.arrayBuffer();
      const msg = await new Promise<{ arrayBuffer?: ArrayBuffer; fileName?: string; error?: string }>((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          if (e.data?.id !== id) return;
          worker.removeEventListener('message', handler);
          worker.removeEventListener('error', errHandler);
          if (e.data.error) reject(new Error(e.data.error));
          else resolve(e.data);
        };
        const errHandler = () => {
          worker.removeEventListener('message', handler);
          worker.removeEventListener('error', errHandler);
          reject(new Error('Worker error'));
        };
        worker.addEventListener('message', handler);
        worker.addEventListener('error', errHandler);
        worker.postMessage(
          {
            id,
            arrayBuffer,
            fileName: file.name,
            mimeType: file.type,
            maxDim: MAX_UPLOAD_DIM,
            quality: UPLOAD_JPEG_QUALITY,
            sizeThreshold: LARGE_FILE_BYTES,
          },
          [arrayBuffer]
        );
      });
      if (msg.arrayBuffer && msg.fileName) {
        return new File([msg.arrayBuffer], msg.fileName, { type: 'image/jpeg' });
      }
    } catch {
      /* fall through to main-thread resize */
    }
  }
  return resizeIfLargeMainThread(file);
}

/** Main-thread resize fallback when worker unavailable or fails. */
function resizeIfLargeMainThread(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= LARGE_FILE_BYTES) return Promise.resolve(file);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.width;
      const h = img.height;
      if (w <= MAX_UPLOAD_DIM && h <= MAX_UPLOAD_DIM) {
        resolve(file);
        return;
      }
      const scale = Math.min(1, MAX_UPLOAD_DIM / w, MAX_UPLOAD_DIM / h);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          resolve(new File([blob], file.name.replace(/\.[a-z]+$/i, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        UPLOAD_JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

function isRetryableUploadError(err: unknown): boolean {
  const msg = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: string }).message) : '';
  return (
    msg.includes('timeout') ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('Network request failed') ||
    msg.includes('Load failed')
  );
}

/**
 * Fetch pending cloud uploads for the current user.
 */
export function useCloudUploads(userId: string | undefined) {
  const [uploads, setUploads] = useState<CloudUpload[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUploads = useCallback(async () => {
    if (!userId) {
      setUploads([]);
      setPendingCount(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: e } = await supabase
        .from('cloud_uploads')
        .select('id, user_id, storage_path, status, created_at, upload_group_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (e) throw e;
      const list = (data || []) as CloudUpload[];
      setUploads(list);
      setPendingCount(list.filter((u) => u.status === 'pending').length);
    } catch (err: any) {
      setError(err?.message || 'Failed to load cloud uploads');
      setUploads([]);
      setPendingCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUploads();
  }, [fetchUploads]);

  // Realtime: subscribe to new inserts for this user
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('cloud_uploads')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'cloud_uploads',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchUploads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUploads]);

  return { uploads, pendingCount, loading, error, refetch: fetchUploads };
}

/**
 * Get a signed URL for a storage path (for thumbnails or passing to API).
 */
export async function getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, expiresIn);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('No signed URL');
  return data.signedUrl;
}

/**
 * Prepare a file for cloud upload: HEIC → JPEG on main thread, then resize in worker (or main-thread fallback).
 * Use this for spread uploads so you can run prepare sequentially then upload in parallel.
 */
export async function prepareImageForCloud(file: File | Blob): Promise<File> {
  if (!file || !isFileLike(file)) {
    throw new Error('Invalid photo. Please try again.');
  }
  const fileForNorm = file instanceof File ? file : new File([file], (file as File).name || 'photo', { type: (file as File).type || 'image/jpeg' });
  const normalized = await normalizeImageFile(fileForNorm);
  if (!normalized || !isFileLike(normalized)) {
    throw new Error('Invalid photo. Please try again.');
  }
  let out = normalized instanceof File ? normalized : new File([normalized], 'photo', { type: 'image/jpeg' });
  out = await resizeIfLarge(out);
  return out;
}

/**
 * Upload a file to logbook_scans and insert a cloud_uploads row.
 * Converts HEIC/HEIF (e.g. from iPhone) to JPEG before upload; only JPEG is stored, never HEIC.
 * When uploading a spread pair, pass the same uploadGroupId for both files so desktop shows one unit to import.
 * Use skipPrepare: true when the file was already prepared via prepareImageForCloud (e.g. sequential prep, parallel upload).
 * Storage upload and DB insert are retried on transient failures; Supabase client uses a 90s timeout.
 */
export async function uploadToCloud(
  userId: string,
  file: File | Blob,
  uploadGroupId?: string | null,
  options?: { skipPrepare?: boolean }
): Promise<CloudUpload> {
  if (!file || !isFileLike(file)) {
    throw new Error('Invalid photo. Please try again.');
  }
  let normFile: File;
  if (options?.skipPrepare) {
    normFile = file instanceof File ? file : new File([file], (file as File).name || 'photo', { type: (file as File).type || 'image/jpeg' });
  } else {
    normFile = await prepareImageForCloud(file);
  }
  const ext = (normFile.name || 'photo').split('.').pop() || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const contentType = normFile.type || 'image/jpeg';

  let lastUploadErr: unknown = null;
  for (let attempt = 0; attempt < UPLOAD_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, UPLOAD_RETRY_DELAY_MS * attempt));
    }
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, normFile, {
      contentType,
      upsert: false,
    });
    if (!uploadError) {
      lastUploadErr = null;
      break;
    }
    const msg = uploadError.message || '';
    if (msg.includes('new row violates row-level security') || msg.includes('policy')) {
      throw new Error('Permission denied. Please sign in again and try again.');
    }
    if (msg.includes('Payload too large') || msg.includes('file_size_limit')) {
      throw new Error('Photo is too large. Use a photo under 10 MB.');
    }
    if (msg.includes('Unsupported Media Type') || msg.includes('allowed_mime')) {
      throw new Error('Photo format not supported. Use JPG or PNG.');
    }
    lastUploadErr = uploadError;
    if (!isRetryableUploadError(uploadError) || attempt === UPLOAD_RETRIES - 1) {
      throw uploadError;
    }
  }
  if (lastUploadErr) throw lastUploadErr;

  let lastInsertErr: unknown = null;
  for (let attempt = 0; attempt < INSERT_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, INSERT_RETRY_DELAY_MS * attempt));
    }
    const { data: row, error: insertError } = await supabase
      .from('cloud_uploads')
      .insert({
        user_id: userId,
        storage_path: path,
        status: 'pending',
        ...(uploadGroupId != null && uploadGroupId !== '' && { upload_group_id: String(uploadGroupId) }),
      })
      .select('id, user_id, storage_path, status, created_at, upload_group_id')
      .single();
    if (!insertError) {
      return row as CloudUpload;
    }
    lastInsertErr = insertError;
  }
  await supabase.storage.from(BUCKET).remove([path]);
  throw lastInsertErr ?? new Error('Failed to save upload record. Please try again.');
}

/**
 * Mark cloud_uploads as processed (after extraction + review).
 */
export async function markCloudUploadsProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from('cloud_uploads')
    .update({ status: 'processed' })
    .in('id', ids);
  if (error) throw error;
}

/**
 * Fetch storage paths for cloud_uploads belonging to the user (for delete).
 */
async function getStoragePathsForUserUploads(userId: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('cloud_uploads')
    .select('storage_path')
    .eq('user_id', userId)
    .in('id', ids);
  if (error) throw error;
  return (data || []).map((r) => r.storage_path).filter(Boolean);
}

/**
 * Delete uploads from cloud: remove files from storage and delete cloud_uploads rows.
 * Use for manual "Remove from cloud" in the Import modal.
 */
export async function deleteFromCloud(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const paths = await getStoragePathsForUserUploads(userId, ids);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) console.warn('Storage delete:', storageError);
  }
  const { error } = await supabase.from('cloud_uploads').delete().in('id', ids);
  if (error) throw error;
}

/**
 * Delete storage files for the given uploads and mark them processed.
 * Call after user approves (verifies) extraction so pictures are removed from the cloud.
 */
export async function deleteStorageAndMarkProcessed(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const paths = await getStoragePathsForUserUploads(userId, ids);
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(paths);
    if (storageError) console.warn('Storage delete after approve:', storageError);
  }
  await markCloudUploadsProcessed(ids);
}
