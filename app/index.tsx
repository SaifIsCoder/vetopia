import React from 'react';
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const { isAuthenticated, onboardingCompleted, role, isInitialized } = useAuthStore();

  if (!isInitialized) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (!onboardingCompleted) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  if (role === 'vet') {
    return <Redirect href="/vet/dashboard" />;
  }

  return <Redirect href="/(tabs)" />;
}
