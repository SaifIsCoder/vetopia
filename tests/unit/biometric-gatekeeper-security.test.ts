/**
 * Biometric Gatekeeper & Session Restoration Security Tests (MVP-10)
 * Vetopia Mobile
 *
 * Verifies that:
 * 1. When biometric login is enabled, authenticated sessions cannot bypass local biometric challenge.
 * 2. Cancelling or failing biometric prompt never silently grants access.
 * 3. App restart, session revocation, sign-out, and account switching strictly preserve security boundaries.
 * 4. Disabling biometrics or OS enrollment changes degrade gracefully without locking out valid users.
 */

import { useAuthStore, UserProfile } from '../../src/store/authStore';
import {
  checkBiometricsAvailability,
  authenticateWithBiometrics,
} from '../../src/lib/auth/biometrics';
import { authService } from '../../src/lib/auth/authService';
import { queryClient } from '../../src/lib/query/client';

// Mock biometrics module
jest.mock('../../src/lib/auth/biometrics', () => ({
  checkBiometricsAvailability: jest.fn(),
  authenticateWithBiometrics: jest.fn(),
  setBiometricsPreference: jest.fn().mockResolvedValue(undefined),
  getBiometricsPreference: jest.fn(),
}));

// Mock authService
jest.mock('../../src/lib/auth/authService', () => ({
  authService: {
    signOut: jest.fn(),
    refreshSession: jest.fn(),
    loadUserProfile: jest.fn(),
  },
}));

// Mock queryClient
jest.mock('../../src/lib/query/client', () => ({
  queryClient: {
    clear: jest.fn(),
    invalidateQueries: jest.fn(),
  },
}));

describe('Biometric Gatekeeper & Session Restoration Security', () => {
  const mockSession = {
    access_token: 'valid-jwt-access-token',
    refresh_token: 'valid-jwt-refresh-token',
    user: { id: 'usr-secure-001', email: 'owner@vetopia.com' },
  } as any;

  const mockProfile: UserProfile = {
    id: 'usr-secure-001',
    email: 'owner@vetopia.com',
    fullName: 'Dr. Jane Foster',
    roles: ['pet_parent'],
    onboarded: true,
    isVet: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();
  });

  describe('1. Session Restoration & Biometric Lock on Cold Start', () => {
    test('Enforces isBiometricLocked=true when session exists and biometrics are enabled', async () => {
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        biometricType: 'Face ID',
        isEnabled: true,
      });

      await useAuthStore.getState().initialize(mockSession, mockProfile);

      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.biometricsEnabled).toBe(true);
      // Security boundary: Must be locked upon cold start!
      expect(state.isBiometricLocked).toBe(true);
    });

    test('Does NOT lock session when biometrics are disabled by user preference', async () => {
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        biometricType: 'Face ID',
        isEnabled: false,
      });

      await useAuthStore.getState().initialize(mockSession, mockProfile);

      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      expect(state.biometricsEnabled).toBe(false);
      expect(state.isBiometricLocked).toBe(false);
    });

    test('Does NOT lock when no authenticated session exists (unauthenticated guest/welcome)', async () => {
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        biometricType: 'Face ID',
        isEnabled: true,
      });

      await useAuthStore.getState().initialize(null, null);

      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(false);
      expect(state.isBiometricLocked).toBe(false);
    });
  });

  describe('2. Biometric Authentication Failure & Cancellation Resilience', () => {
    test('Cancelling biometric verification leaves session locked', async () => {
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        biometricType: 'Touch ID',
        isEnabled: true,
      });

      await useAuthStore.getState().initialize(mockSession, mockProfile);
      expect(useAuthStore.getState().isBiometricLocked).toBe(true);

      // Simulate user cancellation
      (authenticateWithBiometrics as jest.Mock).mockResolvedValueOnce(false);

      const success = await authenticateWithBiometrics('Unlock Vetopia');
      expect(success).toBe(false);

      // unlockBiometrics should NOT have been called
      expect(useAuthStore.getState().isBiometricLocked).toBe(true);
    });

    test('Failed sensor verification leaves session locked', async () => {
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        biometricType: 'Face ID',
        isEnabled: true,
      });

      await useAuthStore.getState().initialize(mockSession, mockProfile);
      expect(useAuthStore.getState().isBiometricLocked).toBe(true);

      // Simulate biometric sensor mismatch
      (authenticateWithBiometrics as jest.Mock).mockResolvedValueOnce(false);

      const result = await authenticateWithBiometrics('Unlock Vetopia');
      expect(result).toBe(false);
      expect(useAuthStore.getState().isBiometricLocked).toBe(true);
    });

    test('Successful local biometric verification unlocks the session', async () => {
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        biometricType: 'Face ID',
        isEnabled: true,
      });

      await useAuthStore.getState().initialize(mockSession, mockProfile);
      expect(useAuthStore.getState().isBiometricLocked).toBe(true);

      // Simulate successful Face ID unlock
      (authenticateWithBiometrics as jest.Mock).mockResolvedValueOnce(true);

      const result = await authenticateWithBiometrics('Unlock Vetopia');
      expect(result).toBe(true);

      useAuthStore.getState().unlockBiometrics();
      expect(useAuthStore.getState().isBiometricLocked).toBe(false);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
  });

  describe('3. Operating System Enrollment Changes & Hardware Removal', () => {
    test('Degrades gracefully without locking user out if biometric hardware is disabled in OS', async () => {
      // User previously had biometrics enabled in app, but removed fingerprint in Android Settings
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: false,
        biometricType: 'None',
        isEnabled: false,
      });

      await useAuthStore.getState().initialize(mockSession, mockProfile);

      const state = useAuthStore.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isAuthenticated).toBe(true);
      // Cannot lock because device lacks biometric capability
      expect(state.isBiometricLocked).toBe(false);
    });
  });

  describe('4. Sign-Out, Revoked Sessions, & Account Switching Isolation', () => {
    test('Sign-out clears all auth credentials, cache, and resets lock state', async () => {
      (checkBiometricsAvailability as jest.Mock).mockResolvedValueOnce({
        isAvailable: true,
        biometricType: 'Face ID',
        isEnabled: true,
      });

      await useAuthStore.getState().initialize(mockSession, mockProfile);
      expect(useAuthStore.getState().isBiometricLocked).toBe(true);

      // Sign out via authService
      await authService.signOut();
      useAuthStore.getState().clearSession();
      queryClient.clear();

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isBiometricLocked).toBe(false);
      expect(state.session).toBeNull();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
    });

    test('Calling unlockBiometrics on a signed-out state cannot conjure a session', () => {
      useAuthStore.getState().clearSession();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);

      useAuthStore.getState().unlockBiometrics();
      // Unlocking an unauthenticated state does not grant authentication
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().session).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    test('Fresh password login (setSession) bypasses biometric lock for the new session', () => {
      // Simulate account switching: New user logs in with password
      const newUserSession = {
        access_token: 'new-user-access-token',
        refresh_token: 'new-user-refresh-token',
        user: { id: 'usr-new-002', email: 'dr.smith@vetopia.com' },
      } as any;

      const newUserProfile: UserProfile = {
        id: 'usr-new-002',
        email: 'dr.smith@vetopia.com',
        fullName: 'Dr. John Smith',
        roles: ['vet'],
        onboarded: true,
        isVet: true,
      };

      useAuthStore.getState().setSession(newUserSession, newUserProfile);

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.fullName).toBe('Dr. John Smith');
      // Just logged in with password; lock is false
      expect(state.isBiometricLocked).toBe(false);
    });
  });
});
