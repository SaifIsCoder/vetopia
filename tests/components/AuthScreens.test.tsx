import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import WelcomeScreen from '../../app/(auth)/welcome';
import LoginScreen from '../../app/(auth)/login';
import RegisterScreen from '../../app/(auth)/register';
import ForgotPasswordScreen from '../../app/(auth)/forgot-password';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

// Mock authService
jest.mock('../../src/lib/auth/authService', () => ({
  authService: {
    login: jest.fn(),
    register: jest.fn(),
    requestPasswordReset: jest.fn(),
  },
}));

// Mock biometrics
jest.mock('../../src/lib/auth/biometrics', () => ({
  checkBiometricsAvailability: jest.fn().mockResolvedValue({
    isAvailable: false,
    biometricType: 'None',
    isEnabled: false,
  }),
  authenticateWithBiometrics: jest.fn().mockResolvedValue(false),
  getBiometricsPreference: jest.fn().mockResolvedValue(false),
  setBiometricsPreference: jest.fn().mockResolvedValue(undefined),
}));

describe('Authentication Screen Components', () => {
  describe('WelcomeScreen', () => {
    test('Renders brand title, value proposition, and CTA buttons', () => {
      const { getByText } = render(<WelcomeScreen />);

      expect(getByText('Vetopia')).toBeTruthy();
      expect(getByText('THE PETS CLUB')).toBeTruthy();
      expect(getByText('Online Vet Consultations')).toBeTruthy();
      expect(getByText('Get Started')).toBeTruthy();
      expect(getByText('I already have an account')).toBeTruthy();
    });
  });

  describe('LoginScreen', () => {
    test('Renders email, password inputs and validates empty inputs', () => {
      const { getByText, getByPlaceholderText } = render(<LoginScreen />);

      expect(getByText('Welcome Back')).toBeTruthy();
      expect(getByPlaceholderText('your.email@example.com')).toBeTruthy();
      expect(getByPlaceholderText('••••••••')).toBeTruthy();

      const signInButton = getByText('Sign In');
      fireEvent.press(signInButton);

      expect(getByText('Email address is required.')).toBeTruthy();
    });
  });

  describe('RegisterScreen', () => {
    test('Renders role switcher and toggles veterinarian specialty fields', () => {
      const { getAllByText, getByText, queryByText } = render(<RegisterScreen />);

      expect(getAllByText('Create Account').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Pet Parent')).toBeTruthy();
      expect(getByText('Veterinarian')).toBeTruthy();

      // By default pet parent is selected, no specialty input
      expect(queryByText('Primary Specialty')).toBeNull();

      // Tap Veterinarian
      fireEvent.press(getByText('Veterinarian'));

      // Specialty and fee should now be present
      expect(getByText('Primary Specialty')).toBeTruthy();
      expect(getByText('Standard Consultation Fee (USD)')).toBeTruthy();
    });
  });

  describe('ForgotPasswordScreen', () => {
    test('Renders recovery email input and action button', () => {
      const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);

      expect(getByText('Password Reset')).toBeTruthy();
      expect(getByPlaceholderText('your.email@example.com')).toBeTruthy();
      expect(getByText('Send Recovery Link')).toBeTruthy();
    });
  });
});
