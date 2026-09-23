import { createClient } from '@supabase/supabase-js';
import { env } from '../../config/env';
import { SecureStorageAdapter } from './storage';

/**
 * Mobile Supabase Client Foundation
 * Configured using public anon key only and hardware-backed SecureStore.
 */
const supabaseUrl = env.supabaseUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = env.supabaseAnonKey || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStorageAdapter,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
