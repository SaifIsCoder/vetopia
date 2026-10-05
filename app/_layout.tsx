import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, ErrorBoundary } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Notifications } from '../src/lib/notifications/safeNotifications';
import { Fingerprint, AlertCircle } from 'lucide-react-native';

import { queryClient } from '../src/lib/query/client';
import { supabase } from '../src/lib/supabase/client';
import { authService } from '../src/lib/auth/authService';
import { notificationService } from '../src/lib/notifications/notificationService';
import { authenticateWithBiometrics } from '../src/lib/auth/biometrics';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import { radii } from '../src/theme/radii';
import { Heading } from '../src/components/ui/Heading';
import { Text } from '../src/components/ui/Text';
import { Button } from '../src/components/ui/Button';
import { Avatar } from '../src/components/ui/Avatar';

export { ErrorBoundary };

function AuthGatekeeper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const {
    isInitialized,
    isAuthenticated,
    role,
    onboardingCompleted,
    isBiometricLocked,
    biometricType,
    user,
    unlockBiometrics,
    initialize,
    setSession,
    clearSession,
  } = useAuthStore();

  // 1. Session Bootstrap & Realtime Auth Listener
  useEffect(() => {
    let isMounted = true;

    async function bootstrapSession() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        let profile = null;

        if (session?.user) {
          profile = await authService.loadUserProfile(session.user.id, session.user.email);
        }

        if (isMounted) {
          await initialize(session, profile);
        }
      } catch (err) {
        console.warn('[AuthGatekeeper] Session bootstrap error:', err);
        if (isMounted) {
          await initialize(null, null);
        }
      }
    }

    bootstrapSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!isMounted) return;

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (newSession?.user) {
          const currentProfile = useAuthStore.getState().user;
          if (!currentProfile || currentProfile.id !== newSession.user.id) {
            const profile = await authService.loadUserProfile(
              newSession.user.id,
              newSession.user.email,
            );
            setSession(newSession, profile);
          } else {
            setSession(newSession, currentProfile);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        notificationService.deactivateDeviceToken().catch(() => {});
        clearSession();
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [initialize, setSession, clearSession]);

  // 2. Push Token Registration on Authentication
  useEffect(() => {
    if (isAuthenticated) {
      notificationService
        .registerForPushNotificationsAsync()
        .then((token) => {
          if (token) {
            notificationService.registerDeviceToken(token).catch((err) => {
              console.warn('[AuthGatekeeper] Failed to register push token:', err);
            });
          }
        })
        .catch((err) => {
          console.warn('[AuthGatekeeper] Push notification registration error:', err);
        });
    }
  }, [isAuthenticated]);

  // 3. Cold-Start Notification Tap Detection
  useEffect(() => {
    async function checkColdStartNotification() {
      try {
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          const data = response.notification.request.content.data;
          const targetRoute = notificationService.resolveRouteFromData(data);
          if (targetRoute) {
            setPendingRoute(targetRoute);
          }
        }
      } catch (err) {
        console.warn('[AuthGatekeeper] Cold-start notification check error:', err);
      }
    }

    checkColdStartNotification();
  }, []);

  // 4. Background & Foreground Notification Response Listener
  useEffect(() => {
    let subscription: { remove: () => void } | undefined;
    try {
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        try {
          const data = response.notification.request.content.data;
          const targetRoute = notificationService.resolveRouteFromData(data);
          if (targetRoute) {
            if (isAuthenticated && onboardingCompleted) {
              router.push(targetRoute as any);
            } else {
              setPendingRoute(targetRoute);
            }
          }
        } catch (err) {
          console.warn('[AuthGatekeeper] Notification response listener error:', err);
        }
      });
    } catch (listenerErr) {
      console.warn(
        '[AuthGatekeeper] Failed to attach notification response listener:',
        listenerErr,
      );
    }

    return () => {
      subscription?.remove();
    };
  }, [isAuthenticated, onboardingCompleted, router]);

  // 5. Pending Deep Link Resolution After Authentication Boundary
  useEffect(() => {
    if (isInitialized && isAuthenticated && onboardingCompleted && pendingRoute) {
      const destination = pendingRoute;
      const timer = setTimeout(() => {
        setPendingRoute(null);
        router.push(destination as any);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, isAuthenticated, onboardingCompleted, pendingRoute, router]);

  // 6. Navigation Guard / Route Protection
  useEffect(() => {
    if (!isInitialized || isBiometricLocked) return;

    const segs = segments as unknown as string[];
    // Prevent premature navigation redirects before segments are resolved on root mount
    if (!segs || segs.length === 0) return;

    const inAuthGroup = segs[0] === '(auth)';
    const inVetGroup = segs[0] === 'vet';
    const isAiChat = segs[0] === 'ai';
    const isOnboarding = inAuthGroup && segs[1] === 'onboarding';

    if (!isAuthenticated) {
      // Unauthenticated users cannot access protected routes (guest triage mode permitted)
      if (!inAuthGroup && !isAiChat) {
        router.replace('/(auth)/welcome');
      }
    } else {
      // Authenticated users with incomplete onboarding are routed to onboarding
      if (!onboardingCompleted) {
        if (!isOnboarding) {
          router.replace('/(auth)/onboarding');
        }
      } else {
        // Authenticated and onboarded users should not stay on login/register/welcome/onboarding
        if (inAuthGroup) {
          if (role === 'vet') {
            router.replace('/vet/dashboard');
          } else {
            router.replace('/(tabs)');
          }
        } else if (inVetGroup && role === 'pet_parent') {
          // Pet parents cannot access doctor portal
          router.replace('/(tabs)');
        }
      }
    }
  }, [
    isInitialized,
    isAuthenticated,
    isBiometricLocked,
    role,
    onboardingCompleted,
    segments,
    router,
  ]);

  // 7. Auto Biometric Challenge on App Startup when Locked
  useEffect(() => {
    let active = true;
    if (isBiometricLocked) {
      authenticateWithBiometrics('Unlock Vetopia to access your clinical records')
        .then((success) => {
          if (!active) return;
          if (success) {
            unlockBiometrics();
          } else {
            setBioError('Biometric authentication was cancelled or failed.');
          }
        })
        .catch((err) => {
          if (!active) return;
          setBioError(err?.message || 'Biometric authentication failed.');
        });
    }
    return () => {
      active = false;
    };
  }, [isBiometricLocked, unlockBiometrics]);

  const handleManualUnlock = async () => {
    setIsUnlocking(true);
    setBioError(null);
    try {
      const success = await authenticateWithBiometrics('Unlock Vetopia');
      if (success) {
        unlockBiometrics();
      } else {
        setBioError(
          'Biometric authentication was cancelled or failed. Please try again or sign in with your password.',
        );
      }
    } catch (err: any) {
      setBioError(err?.message || 'Biometric authentication failed.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleFallbackSignOut = async () => {
    await authService.signOut();
  };

  if (!isInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <Text variant="caption" color={colors.inkSoft} style={styles.kicker}>
          THE PETS CLUB
        </Text>
        <Heading level={1} style={styles.title}>
          Vetopia
        </Heading>
        <ActivityIndicator size="large" color={colors.primaryDark} style={styles.spinner} />
      </View>
    );
  }

  if (isBiometricLocked) {
    const displayName = user?.fullName || 'Pet Parent';
    const methodLabel = biometricType && biometricType !== 'None' ? biometricType : 'Biometrics';

    return (
      <View style={styles.lockContainer} testID="biometric-lock-screen">
        <View style={styles.lockContent}>
          <Avatar name={displayName} source={user?.avatarUrl} size={72} />
          <Heading level={2} style={styles.lockTitle} testID="lock-user-greeting">
            Welcome Back
          </Heading>
          <Text variant="bodyMd" style={styles.lockName}>
            {displayName}
          </Text>
          <Text variant="bodySm" color={colors.muted} style={styles.lockDescription}>
            Biometric verification is required to unlock your consultations and health passport.
          </Text>

          {bioError && (
            <View style={styles.lockErrorBanner} testID="lock-error-message">
              <AlertCircle size={16} color={colors.destructive} />
              <Text variant="caption" color={colors.destructive} style={styles.lockErrorText}>
                {bioError}
              </Text>
            </View>
          )}

          <Button
            title={isUnlocking ? 'Verifying...' : `Unlock with ${methodLabel}`}
            onPress={handleManualUnlock}
            variant="primary"
            leftIcon={<Fingerprint size={20} color={colors.ink} />}
            loading={isUnlocking}
            disabled={isUnlocking}
            style={styles.lockUnlockBtn}
            testID="btn-lock-unlock-biometrics"
          />

          <Button
            title="Sign Out / Use Password"
            onPress={handleFallbackSignOut}
            variant="outline"
            size="sm"
            style={styles.lockFallbackBtn}
            testID="btn-lock-use-password"
          />
        </View>
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <AuthGatekeeper>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
            }}
          >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen
              name="notifications"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="consult/[id]"
              options={{
                presentation: 'fullScreenModal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="booking/[vetId]"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="ai/chat"
              options={{
                presentation: 'modal',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="consult/[id]/prescription"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="prescriptions/[id]"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="messages/[id]"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="pets/[id]"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="pets/add"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="pets/edit"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="settings/profile"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="vet/dashboard"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
          </Stack>
        </AuthGatekeeper>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    marginBottom: 24,
  },
  spinner: {
    marginTop: 8,
  },
  lockContainer: {
    flex: 1,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lockContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  lockTitle: {
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  lockName: {
    color: colors.ink,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  lockDescription: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 20,
  },
  lockErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    width: '100%',
    gap: spacing.sm,
  },
  lockErrorText: {
    flex: 1,
  },
  lockUnlockBtn: {
    width: '100%',
    marginBottom: spacing.md,
  },
  lockFallbackBtn: {
    width: '100%',
  },
});
