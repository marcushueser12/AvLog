import { createClient } from '@supabase/supabase-js';
import { createFetchWithTimeout } from '../utils/apiUtils';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const SUPABASE_FETCH_TIMEOUT_MS = 90_000; // 90s so storage uploads on slow mobile don't hang

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file');
}

// Configure Supabase client: custom fetch with timeout so requests don't hang on mobile
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: createFetchWithTimeout(SUPABASE_FETCH_TIMEOUT_MS),
  },
  auth: {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined,
  },
});
