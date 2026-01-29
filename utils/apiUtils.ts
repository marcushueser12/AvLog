/**
 * Utility functions for API calls with timeout and retry logic
 */

const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

/**
 * Fetch with timeout
 */
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
};

/**
 * Fetch with retry logic
 */
export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  timeout: number = DEFAULT_TIMEOUT,
  retries: number = MAX_RETRIES
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (attempt > 0) {
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
      }

      const response = await fetchWithTimeout(url, options, timeout);
      
      // If response is ok, return it
      if (response.ok) {
        return response;
      }

      // If it's a rate limit error (429), retry with exponential backoff
      if (response.status === 429 && attempt < retries) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter 
          ? parseInt(retryAfter, 10) * 1000 
          : RETRY_DELAY * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
        console.warn(`Rate limited (429), retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        lastError = new Error(`Rate limited, retrying...`);
        continue;
      }

      // If it's a server error (5xx), retry
      if (response.status >= 500 && attempt < retries) {
        lastError = new Error(`Server error ${response.status}, retrying...`);
        continue;
      }

      // For other errors, don't retry
      return response;
    } catch (error: any) {
      lastError = error;
      
      // If it's a network error and we have retries left, try again
      if (
        (error.message?.includes('timeout') || 
         error.message?.includes('Failed to fetch') ||
         error.message?.includes('NetworkError')) &&
        attempt < retries
      ) {
        continue;
      }

      // If no retries left or it's not a retryable error, throw
      throw error;
    }
  }

  // If we exhausted all retries, throw the last error
  throw lastError || new Error('Request failed after all retries');
};

/**
 * Safe API call wrapper that handles errors gracefully
 */
export const safeApiCall = async <T>(
  apiCall: () => Promise<T>,
  fallback: T,
  errorMessage?: string
): Promise<T> => {
  try {
    return await apiCall();
  } catch (error: any) {
    console.error(errorMessage || 'API call failed:', error);
    return fallback;
  }
};
