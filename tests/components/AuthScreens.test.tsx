import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import WelcomeScreen from '../../app/(auth)/welcome';
import LoginScreen from '../../app/(auth)/login';
import RegisterScreen from '../../app/(auth)/register';
import ForgotPasswordScreen from '../../app/(auth)/forgot-password';
import { authService } from '../../src/lib/auth/authService';

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
    signInWithGoogleOAuth: jest.fn().mockResolvedValue({ url: 'https://accounts.google.com' }),
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

    test('Renders Continue with Google button and triggers Google OAuth', () => {
      const { getByText } = render(<LoginScreen />);

      const googleButton = getByText('Continue with Google');
      expect(googleButton).toBeTruthy();
      fireEvent.press(googleButton);

      expect(authService.signInWithGoogleOAuth).toHaveBeenCalledWith('pet_parent');
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

    test('Renders Sign Up with Google button and triggers OAuth with selected role', () => {
      const { getByText } = render(<RegisterScreen />);

      // Select Veterinarian role
      fireEvent.press(getByText('Veterinarian'));

      const googleBtn = getByText('Sign Up with Google');
      expect(googleBtn).toBeTruthy();
      fireEvent.press(googleBtn);

      expect(authService.signInWithGoogleOAuth).toHaveBeenCalledWith('vet');
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
