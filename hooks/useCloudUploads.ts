import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { CloudUpload } from '../types';

const BUCKET = 'logbook_scans';

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
 */
export async function uploadToCloud(userId: string, file: File): Promise<CloudUpload> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) throw uploadError;

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
