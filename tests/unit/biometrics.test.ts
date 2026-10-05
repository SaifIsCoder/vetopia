/**
 * Biometrics Service & Security Verification (MVP-10)
 * Vetopia Mobile
 *
 * NOTE: Native biometric APIs are mocked here via Jest. Physical device
 * verification is required on real hardware for Face ID, Touch ID, and
 * Android BiometricPrompt prior to production release.
 */

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  checkBiometricsAvailability,
  authenticateWithBiometrics,
  getBiometricsPreference,
  setBiometricsPreference,
  toggleBiometrics,
} from '../../src/lib/auth/biometrics';
import { useAuthStore } from '../../src/store/authStore';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  supportedAuthenticationTypesAsync: jest.fn(),
  authenticateAsync: jest.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));

describe('Biometrics Service (expo-local-authentication & SecureStore)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Hardware & Enrollment Detection', () => {
    test('Reports unavailable when device lacks hardware', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);

      const status = await checkBiometricsAvailability();
      expect(status.isAvailable).toBe(false);
      expect(status.biometricType).toBe('None');
      expect(status.isEnabled).toBe(false);
    });

    test('Reports unavailable when hardware exists but biometrics are not enrolled', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);

      const status = await checkBiometricsAvailability();
      expect(status.isAvailable).toBe(false);
      expect(status.biometricType).toBe('None');
      expect(status.isEnabled).toBe(false);
    });

    test('Detects Face ID when enrolled and supported on iOS', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');

      const status = await checkBiometricsAvailability();
      expect(status.isAvailable).toBe(true);
      expect(status.biometricType).toBe('Face ID');
      expect(status.isEnabled).toBe(true);
    });

    test('Detects Touch ID when enrolled and supported on iOS', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([
        LocalAuthentication.AuthenticationType.FINGERPRINT,
      ]);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('false');

      const status = await checkBiometricsAvailability();
      expect(status.isAvailable).toBe(true);
      expect(status.biometricType).toBe('Touch ID');
      expect(status.isEnabled).toBe(false);
    });

    test('Returns default fallback when an unexpected error occurs during hardware check', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Hardware sensor fault'),
      );

      const status = await checkBiometricsAvailability();
      expect(status.isAvailable).toBe(false);
      expect(status.biometricType).toBe('None');
      expect(status.isEnabled).toBe(false);
    });
  });

  describe('2. Local Authentication Prompt', () => {
    test('Executes biometric prompt and returns success', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const result = await authenticateWithBiometrics('Unlock Vetopia');
      expect(result).toBe(true);
      expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          promptMessage: 'Unlock Vetopia',
          fallbackLabel: 'Enter Password',
        }),
      );
    });

    test('Returns false when biometric authentication is cancelled by user', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'user_cancel',
      });

      const result = await authenticateWithBiometrics();
      expect(result).toBe(false);
    });

    test('Returns false when biometric authentication fails verification', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'authentication_failed',
      });

      const result = await authenticateWithBiometrics();
      expect(result).toBe(false);
    });

    test('Handles unexpected exception in authenticateAsync gracefully', async () => {
      (LocalAuthentication.authenticateAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Sensor disconnected'),
      );

      const result = await authenticateWithBiometrics();
      expect(result).toBe(false);
    });
  });

  describe('3. Preference Persistence & toggleBiometrics', () => {
    test('Persists user biometric preference in SecureStore', async () => {
      await setBiometricsPreference(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vetopia_biometrics_enabled', 'true');

      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');
      const enabled = await getBiometricsPreference();
      expect(enabled).toBe(true);
    });

    test('toggleBiometrics(true) requires successful local authentication', async () => {
      // Mock hardware available & Face ID
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('false');

      // Mock user successfully confirming biometrics
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: true,
      });

      const result = await toggleBiometrics(true);
      expect(result.success).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vetopia_biometrics_enabled', 'true');
    });

    test('toggleBiometrics(true) fails if device lacks biometrics or is unenrolled', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);

      const result = await toggleBiometrics(true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        'vetopia_biometrics_enabled',
        'true',
      );
    });

    test('toggleBiometrics(true) does NOT enable preference if user cancels prompt', async () => {
      (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(true);
      (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      ]);
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('false');

      // Mock user cancellation
      (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'user_cancel',
      });

      const result = await toggleBiometrics(true);
      expect(result.success).toBe(false);
      expect(result.error).toContain('cancelled or failed');
      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith(
        'vetopia_biometrics_enabled',
        'true',
      );
    });

    test('toggleBiometrics(false) disables preference without deleting session credentials', async () => {
      const result = await toggleBiometrics(false);
      expect(result.success).toBe(true);
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vetopia_biometrics_enabled', 'false');
      // SecureStore session deletion should NOT be called during biometric toggle
      expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
    });
  });

  describe('4. Security Boundaries & Session Cleared on Sign-Out', () => {
    test('Sign out clears authenticated session and prevents biometric bypass', () => {
      // Simulate signed in state
      useAuthStore.getState().setUser({
        id: 'u-signed-in',
        email: 'user@example.com',
        fullName: 'Jane Doe',
        roles: ['pet_parent'],
        onboarded: true,
        isVet: false,
      });
      useAuthStore.getState().setSession({
        access_token: 'valid-access-token',
        refresh_token: 'valid-refresh-token',
        user: { id: 'u-signed-in', email: 'user@example.com' },
      } as any);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Execute sign out / clearSession
      useAuthStore.getState().clearSession();

      // State is completely reset
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().refreshToken).toBeNull();

      // Even if biometrics is enabled in SecureStore, without stored valid tokens
      // the server cannot be called or bypassed
    });
  });
});
