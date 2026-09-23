import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../src/lib/query/client';
import { supabase } from '../src/lib/supabase/client';
import { authService } from '../src/lib/auth/authService';
import { useAuthStore } from '../src/store/authStore';
import { colors } from '../src/theme/colors';
import { Heading } from '../src/components/ui/Heading';
import { Text } from '../src/components/ui/Text';

function AuthGatekeeper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const {
    isInitialized,
    isAuthenticated,
    role,
    onboardingCompleted,
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
        clearSession();
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [initialize, setSession, clearSession]);

  // 2. Navigation Guard / Route Protection
  useEffect(() => {
    if (!isInitialized) return;

    const segs = segments as unknown as string[];
    const inAuthGroup = segs[0] === '(auth)';
    const inVetGroup = segs[0] === 'vet';
    const isOnboarding = inAuthGroup && segs[1] === 'onboarding';

    if (!isAuthenticated) {
      // Unauthenticated users cannot access protected routes
      if (!inAuthGroup) {
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
  }, [isInitialized, isAuthenticated, role, onboardingCompleted, segments, router]);

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
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
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
});
