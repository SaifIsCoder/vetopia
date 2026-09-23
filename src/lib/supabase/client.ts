import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

/**
 * Mobile Supabase Client Foundation
 * Configured using public anon key only.
 */
const supabaseUrl = env.supabaseUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = env.supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
