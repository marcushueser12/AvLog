// Client-side service that calls the backend API
// The actual Gemini API calls are now handled server-side

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const authHeaders = (token?: string | null): Record<string, string> => {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
};

/**
 * Preprocess image - calls backend API (requires auth)
 */
export const preprocessImage = async (base64Str: string, token?: string | null): Promise<{ data: string; clarity: number }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/preprocess-image`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ base64Image: base64Str }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Image preprocessing failed');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Preprocess error:', error);
    // Fallback to original image if API call fails
    return { data: base64Str, clarity: 50 };
  }
};

/**
 * Extract logbook entries from a pair of images - calls backend API (requires auth)
 */
export const extractLogbookEntriesFromPair = async (
  leftImage: string,
  rightImage: string,
  expectedCount?: number,
  token?: string | null
): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/extract-pair`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      leftImage,
      rightImage,
      expectedCount,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Extraction failed');
  }

  return await response.json();
};

/**
 * Extract logbook entries from a single image - calls backend API (requires auth)
 */
export const extractLogbookEntriesSingle = async (
  image: string,
  expectedCount?: number,
  token?: string | null
): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/extract-single`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      image,
      expectedCount,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Extraction failed');
  }

  return await response.json();
};

/** Extract from cloud: backend fetches image from signed URL and runs extraction (requires auth). */
export const extractFromCloudUrl = async (
  imageUrl: string,
  expectedCount?: number,
  token?: string | null
): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/extract-from-url`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ imageUrl, expectedCount }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Extraction failed');
  }
  return await response.json();
};

/** Extract pair from cloud: backend fetches both images from signed URLs (requires auth). */
export const extractPairFromCloudUrls = async (
  leftImageUrl: string,
  rightImageUrl: string,
  expectedCount?: number,
  token?: string | null
): Promise<any> => {
  const response = await fetch(`${API_BASE_URL}/api/extract-from-url`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      leftImageUrl,
      rightImageUrl,
      expectedCount,
    }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Extraction failed');
  }
  return await response.json();
};
