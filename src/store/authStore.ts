import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { checkBiometricsAvailability, setBiometricsPreference } from '../lib/auth/biometrics';

export type UserRole = 'pet_parent' | 'vet' | 'admin';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  roles: UserRole[];
  onboarded: boolean;
  isVet: boolean;
  isVetVerified?: boolean;
}

export interface AuthState {
  user: UserProfile | null;
  session: Session | null;
  accessToken: string | null;
  refreshToken: string | null;
  role: UserRole | null;
  roles: UserRole[];
  isLoading: boolean;
  isInitialized: boolean;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  biometricAvailable: boolean;
  biometricType: string;
  biometricsEnabled: boolean;

  // Actions
  initialize: (session: Session | null, profile: UserProfile | null) => Promise<void>;
  setSession: (session: Session | null, profile?: UserProfile | null) => void;
  setUser: (user: UserProfile | null) => void;
  setRoles: (roles: UserRole[]) => void;
  setOnboardingCompleted: (completed: boolean) => void;
  setBiometricsEnabled: (enabled: boolean) => Promise<void>;
  setBiometricStatus: (available: boolean, type: string, enabled: boolean) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  accessToken: null,
  refreshToken: null,
  role: null,
  roles: [],
  isLoading: false,
  isInitialized: false,
  isAuthenticated: false,
  onboardingCompleted: false,
  biometricAvailable: false,
  biometricType: 'None',
  biometricsEnabled: false,

  initialize: async (session, profile) => {
    const bioStatus = await checkBiometricsAvailability();
    const primaryRole =
      profile?.roles.find((r) => r === 'vet') ||
      profile?.roles[0] ||
      (profile?.isVet ? 'vet' : 'pet_parent');

    set({
      session,
      user: profile,
      accessToken: session?.access_token || null,
      refreshToken: session?.refresh_token || null,
      role: primaryRole,
      roles: profile?.roles || [],
      isAuthenticated: !!session && !!profile,
      onboardingCompleted: profile?.onboarded ?? false,
      biometricAvailable: bioStatus.isAvailable,
      biometricType: bioStatus.biometricType,
      biometricsEnabled: bioStatus.isEnabled,
      isInitialized: true,
      isLoading: false,
    });
  },

  setSession: (session, profile) => {
    if (!session) {
      get().clearSession();
      return;
    }

    const currentProfile = profile ?? get().user;
    const primaryRole =
      currentProfile?.roles.find((r) => r === 'vet') ||
      currentProfile?.roles[0] ||
      (currentProfile?.isVet ? 'vet' : 'pet_parent');

    set({
      session,
      user: currentProfile,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      role: primaryRole,
      roles: currentProfile?.roles || [],
      isAuthenticated: true,
      onboardingCompleted: currentProfile?.onboarded ?? false,
      isLoading: false,
    });
  },

  setUser: (user) => {
    const primaryRole =
      user?.roles.find((r) => r === 'vet') ||
      user?.roles[0] ||
      (user?.isVet ? 'vet' : 'pet_parent');

    set({
      user,
      role: primaryRole,
      roles: user?.roles || [],
      onboardingCompleted: user?.onboarded ?? false,
      isAuthenticated: !!user && !!get().session,
    });
  },

  setRoles: (roles) => {
    const primaryRole = roles.find((r) => r === 'vet') || roles[0] || 'pet_parent';
    const currentUser = get().user;
    const updatedUser = currentUser ? { ...currentUser, roles } : null;

    set({
      roles,
      role: primaryRole,
      user: updatedUser,
    });
  },

  setOnboardingCompleted: (completed) => {
    const currentUser = get().user;
    const updatedUser = currentUser ? { ...currentUser, onboarded: completed } : null;

    set({
      onboardingCompleted: completed,
      user: updatedUser,
    });
  },

  setBiometricsEnabled: async (enabled) => {
    await setBiometricsPreference(enabled);
    set({ biometricsEnabled: enabled });
  },

  setBiometricStatus: (available, type, enabled) => {
    set({
      biometricAvailable: available,
      biometricType: type,
      biometricsEnabled: enabled,
    });
  },

  clearSession: () =>
    set({
      user: null,
      session: null,
      accessToken: null,
      refreshToken: null,
      role: null,
      roles: [],
      isAuthenticated: false,
      onboardingCompleted: false,
      isLoading: false,
    }),

  setLoading: (isLoading) => set({ isLoading }),
}));
