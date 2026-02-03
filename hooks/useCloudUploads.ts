import { useState, useEffect, useCallback } from 'react';
import heic2any from 'heic2any';
import { supabase } from '../lib/supabase';
import type { CloudUpload } from '../types';

const BUCKET = 'logbook_scans';

const HEIC_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXT = /\.(heic|heif)$/i;

/** Convert HEIC/HEIF (e.g. from iPhone) to JPEG before upload. No HEIC is stored. */
async function normalizeImageFile(file: File): Promise<File> {
  if (!file || typeof file !== 'object' || !(file instanceof Blob)) return file;
  const type = typeof file.type === 'string' ? file.type : '';
  const isHeic = HEIC_TYPES.includes(type) || HEIC_EXT.test(file.name || '');
  if (!isHeic) return file;

  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob || !(blob instanceof Blob)) throw new Error('HEIC conversion failed.');
    const name = (file.name || 'photo').replace(HEIC_EXT, '.jpg');
    return new File([blob], name, { type: 'image/jpeg' });
  } catch (e) {
    throw new Error('Photo format not supported. Try saving as JPG or use a different photo.');
  }
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
        .select('id, user_id, storage_path, status, created_at')
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
 */
export async function uploadToCloud(userId: string, file: File): Promise<CloudUpload> {
  if (!file || !(file instanceof Blob)) {
    throw new Error('Invalid photo. Please try again.');
  }
  const normalized = await normalizeImageFile(file);
  if (!normalized || !(normalized instanceof Blob)) {
    throw new Error('Invalid photo. Please try again.');
  }
  const ext = (normalized.name || 'photo').split('.').pop() || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const contentType = normalized.type || 'image/jpeg';

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, normalized, {
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
    })
    .select('id, user_id, storage_path, status, created_at')
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
