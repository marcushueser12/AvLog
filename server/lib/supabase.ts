import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn('Supabase URL or Service Role Key is missing. Admin features will not work.');
}

// Admin client (bypasses RLS) - only use on server-side
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Regular client for user operations (respects RLS)
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
