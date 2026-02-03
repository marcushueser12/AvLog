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

/** Resize image to max dimension and re-encode as JPEG to reduce upload size. Returns original file if skip or error. */
async function resizeIfLarge(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= LARGE_FILE_BYTES) return file;
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
 * Upload a file to logbook_scans and insert a cloud_uploads row.
 * Converts HEIC/HEIF (e.g. from iPhone) to JPEG before upload; only JPEG is stored, never HEIC.
 * When uploading a spread pair, pass the same uploadGroupId for both files so desktop shows one unit to import.
 */
export async function uploadToCloud(userId: string, file: File | Blob, uploadGroupId?: string | null): Promise<CloudUpload> {
  if (!file || !isFileLike(file)) {
    throw new Error('Invalid photo. Please try again.');
  }
  // Some mobile browsers yield objects that don't pass instanceof Blob; ensure we have a proper File for upload
  const fileForNorm = file instanceof File ? file : new File([file], (file as File).name || 'photo', { type: (file as File).type || 'image/jpeg' });
  const normalized = await normalizeImageFile(fileForNorm);
  if (!normalized || !isFileLike(normalized)) {
    throw new Error('Invalid photo. Please try again.');
  }
  let normFile = normalized instanceof File ? normalized : new File([normalized], 'photo', { type: 'image/jpeg' });
  normFile = await resizeIfLarge(normFile);
  const ext = (normFile.name || 'photo').split('.').pop() || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const contentType = normFile.type || 'image/jpeg';

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, normFile, {
    contentType,
    upsert: false,
  });

  if (uploadError) {
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
    throw uploadError;
  }

  const { data: row, error: insertError } = await supabase
    .from('cloud_uploads')
    .insert({
      user_id: userId,
      storage_path: path,
      status: 'pending',
      ...(uploadGroupId != null && { upload_group_id: uploadGroupId }),
    })
    .select('id, user_id, storage_path, status, created_at, upload_group_id')
    .single();

  if (insertError) throw insertError;
  return row as CloudUpload;
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
