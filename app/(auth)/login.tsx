import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, Fingerprint, Lock, Mail, AlertCircle } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { authService } from '../../src/lib/auth/authService';
import { authenticateWithBiometrics } from '../../src/lib/auth/biometrics';
import { useAuthStore } from '../../src/store/authStore';

export default function LoginScreen() {
  const router = useRouter();
  const { biometricAvailable, biometricType, biometricsEnabled } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};

    if (!email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!email.includes('@') || !email.includes('.')) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password) {
      errors.password = 'Password is required.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    if (!validate()) return;

    setLoading(true);
    try {
      await authService.login({ email: email.trim(), password });
      // AuthGatekeeper automatically navigates to appropriate screen
    } catch (error: any) {
      setErrorMessage(error?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricUnlock = async () => {
    const success = await authenticateWithBiometrics('Unlock Vetopia');
    if (success) {
      // If user had a previously stored session, refresh it
      setLoading(true);
      try {
        const session = await authService.refreshSession();
        if (!session) {
          setErrorMessage('Session expired. Please sign in with your password.');
        }
      } catch (err: any) {
        setErrorMessage(err?.message || 'Biometric authentication failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Screen scrollable style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Back"
          accessibilityRole="button"
        >
          <Text variant="bodyMd" color={colors.primaryDark}>
            ← Back
          </Text>
        </TouchableOpacity>

        <Heading level={1} style={styles.title}>
          Welcome Back
        </Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Sign in to access your consultations, prescriptions, and health records.
        </Text>
      </View>

      {errorMessage ? (
        <Card style={styles.errorBanner}>
          <AlertCircle size={20} color={colors.destructive} style={styles.errorIcon} />
          <Text variant="bodySm" color={colors.destructive} style={styles.errorText}>
            {errorMessage}
          </Text>
        </Card>
      ) : null}

      <View style={styles.form}>
        <Input
          label="Email Address"
          placeholder="your.email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
          }}
          error={fieldErrors.email}
          leftIcon={<Mail size={20} color={colors.muted} />}
          editable={!loading}
        />

        <Input
          label="Password"
          placeholder="••••••••"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
          }}
          error={fieldErrors.password}
          leftIcon={<Lock size={20} color={colors.muted} />}
          rightIcon={
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              accessibilityRole="button"
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.muted} />
              ) : (
                <Eye size={20} color={colors.muted} />
              )}
            </TouchableOpacity>
          }
          editable={!loading}
        />

        <TouchableOpacity
          onPress={() => router.push('/(auth)/forgot-password')}
          style={styles.forgotPassword}
          accessibilityRole="link"
        >
          <Text variant="bodySm" color={colors.primaryDark} style={styles.forgotPasswordText}>
            Forgot Password?
          </Text>
        </TouchableOpacity>

        <Button
          title="Sign In"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          variant="primary"
          style={styles.signInButton}
        />

        {biometricAvailable && biometricsEnabled ? (
          <Button
            title={`Unlock with ${biometricType}`}
            onPress={handleBiometricUnlock}
            variant="outline"
            leftIcon={<Fingerprint size={20} color={colors.ink} />}
            disabled={loading}
            style={styles.biometricButton}
          />
        ) : null}
      </View>

      <View style={styles.footer}>
        <Text variant="bodySm" color={colors.muted}>
          Don&apos;t have an account?{' '}
        </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/register')} accessibilityRole="link">
          <Text variant="bodySm" color={colors.primaryDark} style={styles.signUpLink}>
            Sign Up
          </Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  title: {
    marginBottom: spacing.xs,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: colors.destructive,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  errorIcon: {
    marginRight: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontWeight: '500',
  },
  form: {
    marginBottom: spacing.xl,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    marginTop: -spacing.xs,
  },
  forgotPasswordText: {
    fontWeight: '600',
  },
  signInButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
  biometricButton: {
    width: '100%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  signUpLink: {
    fontWeight: '700',
  },
});
