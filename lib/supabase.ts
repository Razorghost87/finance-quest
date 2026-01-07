import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read from environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Only create client if credentials are available
let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase credentials not found. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file');
}

/**
 * Helper function to ensure Supabase is configured before use
 * Throws a friendly error if credentials are missing
 */
export function ensureSupabaseConfigured(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file'
    );
  }
  return supabase;
}

/**
 * Get Supabase client if configured, otherwise returns null
 * Use ensureSupabaseConfigured() if you want to throw an error instead
 */
export function getSupabaseClient(): SupabaseClient | null {
  return supabase;
}

// Export the client for backward compatibility (will be null if not configured)
export { supabase };

