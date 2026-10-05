/**
 * Settings & Profile Screen Component Tests (SCR-SET-001 / MVP-10)
 * Vetopia Mobile
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ProfileSettingsScreen from '../../app/settings/profile';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';
import { profileService } from '../../src/lib/profile/profileService';
import { checkBiometricsAvailability, toggleBiometrics } from '../../src/lib/auth/biometrics';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../src/lib/notifications/notificationPreferences';

// Mock expo-router
const mockBack = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: jest.fn(),
  }),
}));

// Mock authService
jest.mock('../../src/lib/auth/authService', () => ({
  authService: {
    signOut: jest.fn(),
    requestPasswordReset: jest.fn(),
    loadUserProfile: jest.fn(),
  },
}));

// Mock profileService
jest.mock('../../src/lib/profile/profileService', () => ({
  profileService: {
    updateProfile: jest.fn(),
    getProfile: jest.fn(),
  },
}));

// Mock biometrics
jest.mock('../../src/lib/auth/biometrics', () => ({
  checkBiometricsAvailability: jest.fn(),
  toggleBiometrics: jest.fn(),
  getBiometricsPreference: jest.fn().mockResolvedValue(false),
  setBiometricsPreference: jest.fn().mockResolvedValue(undefined),
}));

// Mock notificationPreferences
jest.mock('../../src/lib/notifications/notificationPreferences', () => ({
  getNotificationPreferences: jest.fn(),
  updateNotificationPreference: jest.fn(),
  DEFAULT_NOTIFICATION_PREFERENCES: {
    consultationReminders: true,
    clinicalMessages: true,
    prescriptionAlerts: true,
    generalAnnouncements: true,
  },
}));

describe('ProfileSettingsScreen Component (MVP-10)', () => {
  const mockUser = {
    id: 'user-456',
    email: 'emma.watson@example.com',
    fullName: 'Emma Watson',
    phone: '+1 555 987 6543',
    avatarUrl: null,
    roles: ['pet_parent'] as ('pet_parent' | 'vet' | 'admin')[],
    onboarded: true,
    isVet: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setUser(mockUser);
    useAuthStore.getState().setBiometricsEnabled(false);

    (checkBiometricsAvailability as jest.Mock).mockResolvedValue({
      isAvailable: true,
      biometricType: 'Face ID',
      isEnabled: false,
    });

    (getNotificationPreferences as jest.Mock).mockResolvedValue({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
    });
  });

  describe('1. Header & Profile Rendering', () => {
    test('Renders header and navigation back button', async () => {
      const { getByTestId, getByText } = render(<ProfileSettingsScreen />);

      await waitFor(() => {
        expect(getByText('Settings & Profile')).toBeTruthy();
      });

      const backButton = getByTestId('btn-settings-back');
      fireEvent.press(backButton);
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    test('Renders authenticated user profile details accurately', async () => {
      const { getByTestId, getByText } = render(<ProfileSettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('profile-user-name').props.children).toBe('Emma Watson');
      });

      expect(getByTestId('profile-user-email').props.children).toBe('emma.watson@example.com');
      expect(getByTestId('profile-user-phone').props.children).toBe('+1 555 987 6543');
      expect(getByText('Pet Parent')).toBeTruthy();
    });
  });

  describe('2. Profile Editing Modal & Validation', () => {
    test('Opens edit profile modal, validates input, and saves valid changes', async () => {
      const updatedUser = {
        ...mockUser,
        fullName: 'Emma Watson-Smith',
        phone: '+1 555 111 2222',
      };
      (profileService.updateProfile as jest.Mock).mockResolvedValueOnce(updatedUser);

      const { getByTestId, getByText } = render(<ProfileSettingsScreen />);

      await waitFor(() => {
        expect(getByTestId('profile-user-name')).toBeTruthy();
      });

      // Open edit modal
      fireEvent.press(getByTestId('btn-open-edit-profile'));
      expect(getByTestId('input-edit-name')).toBeTruthy();

      // Test validation: Empty name
      fireEvent.changeText(getByTestId('input-edit-name'), '');
      fireEvent.press(getByTestId('btn-save-profile'));
      expect(getByText('Full name must be at least 2 characters long.')).toBeTruthy();

      // Test validation: Invalid phone number
      fireEvent.changeText(getByTestId('input-edit-name'), 'Emma Watson-Smith');
      fireEvent.changeText(getByTestId('input-edit-phone'), 'invalid-phone');
      fireEvent.press(getByTestId('btn-save-profile'));
      expect(getByText('Please enter a valid phone number (7-20 digits).')).toBeTruthy();

      // Enter valid phone number and submit
      fireEvent.changeText(getByTestId('input-edit-phone'), '+1 555 111 2222');
      fireEvent.press(getByTestId('btn-save-profile'));

      await waitFor(() => {
        expect(profileService.updateProfile).toHaveBeenCalledWith('user-456', {
          fullName: 'Emma Watson-Smith',
          phone: '+1 555 111 2222',
          avatarUrl: null,
        });
      });
    });

    test('Closes edit modal on cancel without saving', async () => {
      const { getByTestId } = render(<ProfileSettingsScreen />);

      fireEvent.press(getByTestId('btn-open-edit-profile'));
      expect(getByTestId('btn-cancel-edit')).toBeTruthy();

      fireEvent.press(getByTestId('btn-cancel-edit'));
      // Modal should not show edit inputs
      await waitFor(() => {
        expect(profileService.updateProfile).not.toHaveBeenCalled();
      });
    });
  });

  describe('3. Biometric Toggle & Local Authentication Flow', () => {
    test('Enables biometrics upon successful local authentication', async () => {
      (toggleBiometrics as jest.Mock).mockResolvedValueOnce({ success: true });

      const { getByTestId } = render(<ProfileSettingsScreen />);

      await waitFor(() => {
        expect(checkBiometricsAvailability).toHaveBeenCalled();
      });

      const bioToggle = getByTestId('toggle-biometrics');
      await act(async () => {
        fireEvent(bioToggle, 'valueChange', true);
      });

      expect(toggleBiometrics).toHaveBeenCalledWith(true);
      expect(useAuthStore.getState().biometricsEnabled).toBe(true);
    });

    test('Displays error message when biometric confirmation fails or is cancelled', async () => {
      (toggleBiometrics as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Biometric confirmation was cancelled or failed.',
      });

      const { getByTestId, getByText } = render(<ProfileSettingsScreen />);

      await waitFor(() => {
        expect(checkBiometricsAvailability).toHaveBeenCalled();
      });

      const bioToggle = getByTestId('toggle-biometrics');
      await act(async () => {
        fireEvent(bioToggle, 'valueChange', true);
      });

      expect(toggleBiometrics).toHaveBeenCalledWith(true);
      expect(useAuthStore.getState().biometricsEnabled).toBe(false);
      expect(getByText('Biometric confirmation was cancelled or failed.')).toBeTruthy();
    });

    test('Disables biometrics safely without local prompt failure', async () => {
      useAuthStore.getState().setBiometricsEnabled(true);
      (toggleBiometrics as jest.Mock).mockResolvedValueOnce({ success: true });

      const { getByTestId } = render(<ProfileSettingsScreen />);

      const bioToggle = getByTestId('toggle-biometrics');
      await act(async () => {
        fireEvent(bioToggle, 'valueChange', false);
      });

      expect(toggleBiometrics).toHaveBeenCalledWith(false);
      expect(useAuthStore.getState().biometricsEnabled).toBe(false);
    });
  });

  describe('4. Notification Preference Toggles', () => {
    test('Toggles consultation reminders and persists change', async () => {
      (updateNotificationPreference as jest.Mock).mockResolvedValueOnce({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        consultationReminders: false,
      });

      const { getByTestId } = render(<ProfileSettingsScreen />);

      await waitFor(() => {
        expect(getNotificationPreferences).toHaveBeenCalled();
      });

      const notifToggle = getByTestId('toggle-notif-consultations');
      await act(async () => {
        fireEvent(notifToggle, 'valueChange', false);
      });

      expect(updateNotificationPreference).toHaveBeenCalledWith('consultationReminders', false);
    });
  });

  describe('5. Password Reset & Sign Out Integration', () => {
    test('Triggers password reset confirmation and sends email', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (authService.requestPasswordReset as jest.Mock).mockResolvedValueOnce(undefined);

      const { getByTestId } = render(<ProfileSettingsScreen />);
      await waitFor(() => expect(getByTestId('profile-user-name')).toBeTruthy());

      fireEvent.press(getByTestId('btn-password-reset'));

      // Check alert was prompted
      expect(alertSpy).toHaveBeenCalledWith(
        'Reset Password',
        expect.stringContaining('emma.watson@example.com'),
        expect.any(Array),
      );

      // Trigger confirm action callback from Alert
      const alertButtons = alertSpy.mock.calls[0][2];
      const sendButton = alertButtons?.find((b) => b.text === 'Send Instructions');
      expect(sendButton).toBeDefined();

      await act(async () => {
        await sendButton?.onPress?.();
      });

      expect(authService.requestPasswordReset).toHaveBeenCalledWith('emma.watson@example.com');
      alertSpy.mockRestore();
    });

    test('Prompts confirmation alert on Sign Out and executes signOut on confirm', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      (authService.signOut as jest.Mock).mockResolvedValueOnce(undefined);

      const { getByTestId } = render(<ProfileSettingsScreen />);
      await waitFor(() => expect(getByTestId('profile-user-name')).toBeTruthy());

      fireEvent.press(getByTestId('btn-sign-out'));

      expect(alertSpy).toHaveBeenCalledWith(
        'Sign Out',
        'Are you sure you want to sign out of your Vetopia account?',
        expect.any(Array),
      );

      const alertButtons = alertSpy.mock.calls[0][2];
      const signOutConfirmBtn = alertButtons?.find((b) => b.text === 'Sign Out');
      expect(signOutConfirmBtn).toBeDefined();

      await act(async () => {
        await signOutConfirmBtn?.onPress?.();
      });

      expect(authService.signOut).toHaveBeenCalledTimes(1);
      alertSpy.mockRestore();
    });
  });
});
