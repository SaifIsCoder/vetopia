/**
 * AuthGatekeeper Biometric Security Component Tests (MVP-10)
 * Vetopia Mobile
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { useAuthStore, UserProfile } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';
import {
  checkBiometricsAvailability,
  authenticateWithBiometrics,
} from '../../src/lib/auth/biometrics';
import { supabase } from '../../src/lib/supabase/client';
import RootLayout from '../../app/_layout';

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }: any) => children,
    SafeAreaConsumer: ({ children }: any) => children(inset),
    useSafeAreaInsets: () => inset,
  };
});

// Mock expo-router
const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: jest.fn(),
  }),
  useSegments: () => ['(tabs)'],
  Stack: Object.assign(({ children }: any) => children || null, {
    Screen: () => null,
  }),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'mock-token' }),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  addNotificationResponseReceivedListener: jest.fn().mockReturnValue({
    remove: jest.fn(),
  }),
  AndroidImportance: {
    MAX: 5,
    DEFAULT: 3,
  },
}));

// Mock Supabase
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      onAuthStateChange: jest.fn().mockReturnValue({
        data: { subscription: { unsubscribe: jest.fn() } },
      }),
    },
    rpc: jest.fn().mockResolvedValue({ error: null }),
  },
}));

// Mock notificationService
jest.mock('../../src/lib/notifications/notificationService', () => ({
  notificationService: {
    registerForPushNotificationsAsync: jest.fn().mockResolvedValue('mock-token'),
    registerDeviceToken: jest.fn().mockResolvedValue(undefined),
    deactivateDeviceToken: jest.fn().mockResolvedValue(undefined),
    resolveRouteFromData: jest.fn().mockReturnValue(null),
  },
}));

// Mock authService
jest.mock('../../src/lib/auth/authService', () => ({
  authService: {
    loadUserProfile: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock biometrics
jest.mock('../../src/lib/auth/biometrics', () => ({
  checkBiometricsAvailability: jest.fn(),
  authenticateWithBiometrics: jest.fn(),
  setBiometricsPreference: jest.fn().mockResolvedValue(undefined),
  getBiometricsPreference: jest.fn(),
}));

describe('AuthGatekeeper — Biometric Lock Boundary Tests (MVP-10)', () => {
  const mockSession = {
    access_token: 'valid-jwt',
    refresh_token: 'valid-refresh',
    user: { id: 'usr-secure-789', email: 'clara.oswald@example.com' },
  } as any;

  const mockProfile: UserProfile = {
    id: 'usr-secure-789',
    email: 'clara.oswald@example.com',
    fullName: 'Clara Oswald',
    roles: ['pet_parent'],
    onboarded: true,
    isVet: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().clearSession();

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: mockSession },
    });
    (authService.loadUserProfile as jest.Mock).mockResolvedValue(mockProfile);
    (checkBiometricsAvailability as jest.Mock).mockResolvedValue({
      isAvailable: true,
      biometricType: 'Face ID',
      isEnabled: true,
    });
  });

  test('Blocks access to protected routes and renders lock screen when isBiometricLocked=true on startup', async () => {
    // When biometrics are enabled, auto-prompt fails or is pending
    (authenticateWithBiometrics as jest.Mock).mockResolvedValue(false);

    const { getByTestId } = render(<RootLayout />);

    // Lock screen must be rendered
    await waitFor(() => {
      expect(getByTestId('biometric-lock-screen')).toBeTruthy();
    });

    expect(getByTestId('lock-user-greeting')).toBeTruthy();
    expect(getByTestId('btn-lock-unlock-biometrics')).toBeTruthy();
    expect(getByTestId('btn-lock-use-password')).toBeTruthy();
  });

  test('Shows error message and maintains locked state if biometric verification is cancelled', async () => {
    (authenticateWithBiometrics as jest.Mock).mockResolvedValue(false);

    const { getByTestId } = render(<RootLayout />);

    await waitFor(() => {
      expect(getByTestId('biometric-lock-screen')).toBeTruthy();
    });

    // Press Unlock button manually
    const unlockBtn = getByTestId('btn-lock-unlock-biometrics');
    await act(async () => {
      fireEvent.press(unlockBtn);
    });

    // Must show cancellation/failure error and remain locked
    await waitFor(() => {
      expect(getByTestId('lock-error-message')).toBeTruthy();
    });
    expect(useAuthStore.getState().isBiometricLocked).toBe(true);
  });

  test('Unlocks screen and clears lock overlay when biometric authentication succeeds', async () => {
    // Initial mount auto-challenge is cancelled
    (authenticateWithBiometrics as jest.Mock).mockResolvedValueOnce(false);

    const { getByTestId, queryByTestId } = render(<RootLayout />);

    await waitFor(() => {
      expect(getByTestId('biometric-lock-screen')).toBeTruthy();
    });

    // Mock successful authentication on manual tap
    (authenticateWithBiometrics as jest.Mock).mockResolvedValueOnce(true);

    const unlockBtn = getByTestId('btn-lock-unlock-biometrics');
    await act(async () => {
      fireEvent.press(unlockBtn);
    });

    await waitFor(() => {
      expect(useAuthStore.getState().isBiometricLocked).toBe(false);
    });

    // Lock screen must be removed
    expect(queryByTestId('biometric-lock-screen')).toBeNull();
  });

  test('Invokes authService.signOut() when user chooses Sign Out / Use Password', async () => {
    (authenticateWithBiometrics as jest.Mock).mockResolvedValue(false);

    const { getByTestId } = render(<RootLayout />);

    await waitFor(() => {
      expect(getByTestId('biometric-lock-screen')).toBeTruthy();
    });

    const fallbackBtn = getByTestId('btn-lock-use-password');
    await act(async () => {
      fireEvent.press(fallbackBtn);
    });

    expect(authService.signOut).toHaveBeenCalledTimes(1);
  });
});
