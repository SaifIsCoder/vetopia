/**
 * Centralized, validated environment configuration
 */

export interface EnvConfig {
  apiUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  appEnv: 'development' | 'staging' | 'production';
  isDevelopment: boolean;
  isProduction: boolean;
}

const appEnv = (process.env.EXPO_PUBLIC_APP_ENV || 'development') as
  'development' | 'staging' | 'production';

export const env: EnvConfig = {
  apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000/api/v1',
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://ysedjjmpvgotuqjzxqfu.supabase.co',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
  appEnv,
  isDevelopment: appEnv === 'development',
  isProduction: appEnv === 'production',
};
