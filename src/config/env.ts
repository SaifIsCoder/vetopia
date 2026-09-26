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

const appEnv = (process.env.EXPO_PUBLIC_APP_ENV || 'development') as
  'development' | 'staging' | 'production';

export const env: EnvConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://fkhsqstkkksaerpjoczi.supabase.co',
  supabaseAnonKey:
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_82bHaIpBP9cTL2efnWLldA_ilGDcx83',
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
