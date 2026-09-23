import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const BIOMETRICS_PREF_KEY = 'vetopia_biometrics_enabled';

export interface BiometricStatus {
  isAvailable: boolean;
  biometricType: 'Face ID' | 'Touch ID' | 'Biometrics' | 'None';
  isEnabled: boolean;
}

/**
 * Checks if hardware supports biometrics and has enrolled biometric records.
 */
export async function checkBiometricsAvailability(): Promise<BiometricStatus> {
  if (Platform.OS === 'web') {
    return { isAvailable: false, biometricType: 'None', isEnabled: false };
  }

  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const isAvailable = hasHardware && isEnrolled;

    let biometricType: 'Face ID' | 'Touch ID' | 'Biometrics' | 'None' = 'None';
    if (isAvailable) {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometricType = Platform.OS === 'ios' ? 'Face ID' : 'Biometrics';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometricType = Platform.OS === 'ios' ? 'Touch ID' : 'Biometrics';
      } else {
        biometricType = 'Biometrics';
      }
    }

    const enabledVal = await getBiometricsPreference();

    return {
      isAvailable,
      biometricType,
      isEnabled: isAvailable && enabledVal,
    };
  } catch (error) {
    console.warn('[Biometrics] Error checking availability:', error);
    return { isAvailable: false, biometricType: 'None', isEnabled: false };
  }
}

/**
 * Triggers biometric prompt.
 */
export async function authenticateWithBiometrics(
  promptMessage = 'Unlock Vetopia with Biometrics',
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: 'Enter Password',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    return result.success;
  } catch (error) {
    console.warn('[Biometrics] Error during biometric authentication:', error);
    return false;
  }
}

/**
 * Reads user preference for biometric unlock.
 */
export async function getBiometricsPreference(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const val = await SecureStore.getItemAsync(BIOMETRICS_PREF_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

/**
 * Saves user preference for biometric unlock.
 */
export async function setBiometricsPreference(enabled: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.setItemAsync(BIOMETRICS_PREF_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.warn('[Biometrics] Failed to save biometric preference:', error);
  }
}
