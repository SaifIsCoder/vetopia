/**
 * Centralized, validated environment configuration
 */

export interface EnvConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  livekitUrl?: string;
  appEnv: 'development' | 'staging' | 'production';
  isDevelopment: boolean;
  isProduction: boolean;
}

import { Platform } from 'react-native';

const appEnv = (process.env.EXPO_PUBLIC_APP_ENV || 'development') as
  'development' | 'staging' | 'production';

const resolveApiUrl = (configuredUrl?: string): string => {
  const fallback =
    Platform?.OS === 'android'
      ? 'http://10.0.2.2:3000/api/v1'
      : 'http://localhost:3000/api/v1';

  const url = configuredUrl || fallback;
  if (Platform?.OS && Platform.OS !== 'android' && url.includes('10.0.2.2')) {
    return url.replace('10.0.2.2', 'localhost');
  }
  return url;
};

export const env: EnvConfig = {
  apiUrl: resolveApiUrl(process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://oqqdznxlqnscvhlluiit.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_e0fCqz8GCYtQqIG_LvrG8w_MDI6mGx3',
  livekitUrl: process.env.EXPO_PUBLIC_LIVEKIT_URL || 'wss://vetopia-rtc.livekit.cloud',
  appEnv,
  isDevelopment: appEnv === 'development',
  isProduction: appEnv === 'production',
};

console.info('🔧 [Env] Active Config:', {
  appEnv: env.appEnv,
  supabaseUrl: env.supabaseUrl,
  anonKeyConfigured: !!env.supabaseAnonKey && env.supabaseAnonKey.length > 10,
  anonKeyPrefix: env.supabaseAnonKey ? env.supabaseAnonKey.slice(0, 16) + '...' : 'NONE',
});
