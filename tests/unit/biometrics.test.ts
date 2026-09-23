import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  checkBiometricsAvailability,
  authenticateWithBiometrics,
  getBiometricsPreference,
  setBiometricsPreference,
} from '../../src/lib/auth/biometrics';

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

describe('Biometrics Service (expo-local-authentication)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Reports unavailable when device lacks hardware or enrollment', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(false);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(false);

    const status = await checkBiometricsAvailability();
    expect(status.isAvailable).toBe(false);
    expect(status.biometricType).toBe('None');
    expect(status.isEnabled).toBe(false);
  });

  test('Detects Face ID when enrolled and supported', async () => {
    (LocalAuthentication.hasHardwareAsync as jest.Mock).mockResolvedValueOnce(true);
    (LocalAuthentication.isEnrolledAsync as jest.Mock).mockResolvedValueOnce(true);
    (LocalAuthentication.supportedAuthenticationTypesAsync as jest.Mock).mockResolvedValueOnce([
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    ]);
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');

    const status = await checkBiometricsAvailability();
    expect(status.isAvailable).toBe(true);
    expect(status.biometricType).toMatch(/Face ID|Biometrics/);
    expect(status.isEnabled).toBe(true);
  });

  test('Executes biometric prompt and returns success', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: true,
    });

    const result = await authenticateWithBiometrics('Unlock Vetopia');
    expect(result).toBe(true);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Unlock Vetopia',
      }),
    );
  });

  test('Returns false when biometric authentication fails or is cancelled', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({
      success: false,
      error: 'user_cancel',
    });

    const result = await authenticateWithBiometrics();
    expect(result).toBe(false);
  });

  test('Persists user biometric preference in SecureStore', async () => {
    await setBiometricsPreference(true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('vetopia_biometrics_enabled', 'true');

    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('true');
    const enabled = await getBiometricsPreference();
    expect(enabled).toBe(true);
  });
});
