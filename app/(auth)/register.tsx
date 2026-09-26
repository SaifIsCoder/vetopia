import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Stethoscope,
  Heart,
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Square,
  DollarSign,
} from 'lucide-react-native';
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

export default function RegisterScreen() {
  const router = useRouter();

  const [role, setRole] = useState<'pet_parent' | 'vet'>('pet_parent');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [specialty, setSpecialty] = useState('General Veterinary Medicine');
  const [priceUsd, setPriceUsd] = useState('29');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    terms?: string;
  }>({});

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (!fullName.trim() || fullName.trim().length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.';
    }

    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      errors.email = 'Please enter a valid email address.';
    }

    if (!password || password.length < 6) {
      errors.password = 'Password must be at least 6 characters.';
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    if (!agreedToTerms) {
      errors.terms = 'You must agree to the Terms of Service and Privacy Policy.';
    }

    setFieldErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    if (!isValid) {
      console.warn('⚠️ [RegisterScreen] Validation failed with errors:', errors);
    }
    return isValid;
  };

  const handleRegister = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    console.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.info('📝 [RegisterScreen] "Create Account" button pressed');
    console.info('📝 [RegisterScreen] Submitted form details:', {
      fullName: fullName.trim(),
      email: email.trim(),
      role,
      specialty: role === 'vet' ? specialty : undefined,
      priceUsd: role === 'vet' ? priceUsd : undefined,
      agreedToTerms,
    });

    if (!validate()) {
      console.warn('⚠️ [RegisterScreen] Registration aborted due to validation errors.');
      return;
    }

    setLoading(true);
    try {
      console.info('🚀 [RegisterScreen] Sending registration to Supabase via authService...');
      const result = await authService.register({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
        specialty: role === 'vet' ? specialty : undefined,
        priceUsd: role === 'vet' ? parseFloat(priceUsd) || 29 : undefined,
      });

      console.info('📥 [RegisterScreen] Registration completed with response:', {
        userId: result.user?.id,
        userEmail: result.user?.email,
        hasSession: !!result.session,
        profileFound: !!result.profile,
      });

      if (!result.session) {
        console.warn(
          '⚠️ [RegisterScreen] Account created, but NO active session returned.',
          'Supabase "Confirm email" is ENABLED. The user must verify their email before sign-in.',
        );
        const notice = `We sent a confirmation link to ${email.trim()}. Please check your inbox and verify your email before signing in.`;
        setSuccessMessage(notice);
        Alert.alert(
          'Verification Email Sent',
          notice,
          [
            {
              text: 'Go to Sign In',
              onPress: () => router.push('/(auth)/login'),
            },
          ],
          { cancelable: false },
        );
      } else {
        console.info('🎉 [RegisterScreen] Session created! Transitioning to onboarding...');
        router.replace('/(auth)/onboarding');
      }
    } catch (error: any) {
      console.error('❌ [RegisterScreen] Registration caught error:', error);
      console.error('❌ [RegisterScreen] Error details:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        status: error?.status,
        stack: error?.stack,
      });
      setErrorMessage(
        error?.message ||
          'Registration failed. Please check your internet connection or try another email.',
      );
    } finally {
      console.info('🏁 [RegisterScreen] Registration handler concluded.');
      setLoading(false);
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
          Create Account
        </Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Join Vetopia for instant vet telemedicine and healthcare management.
        </Text>
      </View>

      {/* Role Selection Switcher */}
      <View style={styles.roleSelectionContainer}>
        <Text variant="caption" color={colors.inkSoft} style={styles.roleLabel}>
          I AM JOINING AS:
        </Text>
        <View style={styles.roleCards}>
          <TouchableOpacity
            style={[styles.roleCard, role === 'pet_parent' && styles.selectedRoleCard]}
            onPress={() => setRole('pet_parent')}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: role === 'pet_parent' }}
          >
            <Heart size={24} color={role === 'pet_parent' ? colors.primaryDark : colors.muted} />
            <Text
              variant="bodyMd"
              style={[styles.roleTitle, role === 'pet_parent' && styles.selectedRoleTitle]}
            >
              Pet Parent
            </Text>
            <Text variant="caption" color={colors.muted} style={styles.roleSub}>
              Book & consult
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, role === 'vet' && styles.selectedRoleCard]}
            onPress={() => setRole('vet')}
            activeOpacity={0.8}
            accessibilityRole="radio"
            accessibilityState={{ selected: role === 'vet' }}
          >
            <Stethoscope size={24} color={role === 'vet' ? colors.primaryDark : colors.muted} />
            <Text
              variant="bodyMd"
              style={[styles.roleTitle, role === 'vet' && styles.selectedRoleTitle]}
            >
              Veterinarian
            </Text>
            <Text variant="caption" color={colors.muted} style={styles.roleSub}>
              Provide clinical care
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {successMessage ? (
        <Card style={styles.successBanner}>
          <CheckCircle2 size={24} color={colors.success} style={styles.successIcon} />
          <View style={styles.successBody}>
            <Text variant="bodyMd" color={colors.success} style={styles.successTitle}>
              Verification Email Sent
            </Text>
            <Text variant="bodySm" color={colors.inkSoft} style={styles.successText}>
              {successMessage}
            </Text>
            <Button
              title="Go to Sign In"
              onPress={() => router.push('/(auth)/login')}
              variant="primary"
              style={styles.successCta}
            />
          </View>
        </Card>
      ) : null}

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
          label="Full Name"
          placeholder="e.g. Dr. Sarah Jenkins"
          autoCapitalize="words"
          value={fullName}
          onChangeText={(text) => {
            setFullName(text);
            if (fieldErrors.fullName) setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
          }}
          error={fieldErrors.fullName}
          leftIcon={<User size={20} color={colors.muted} />}
          editable={!loading}
        />

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

        {role === 'vet' ? (
          <>
            <Input
              label="Primary Specialty"
              placeholder="e.g. Dermatology, Internal Medicine"
              value={specialty}
              onChangeText={setSpecialty}
              leftIcon={<Stethoscope size={20} color={colors.muted} />}
              editable={!loading}
            />
            <Input
              label="Standard Consultation Fee (USD)"
              placeholder="29"
              keyboardType="numeric"
              value={priceUsd}
              onChangeText={setPriceUsd}
              leftIcon={<DollarSign size={20} color={colors.muted} />}
              editable={!loading}
            />
          </>
        ) : null}

        <Input
          label="Password"
          placeholder="Min. 6 characters"
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

        <Input
          label="Confirm Password"
          placeholder="Re-enter password"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          value={confirmPassword}
          onChangeText={(text) => {
            setConfirmPassword(text);
            if (fieldErrors.confirmPassword)
              setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
          }}
          error={fieldErrors.confirmPassword}
          leftIcon={<Lock size={20} color={colors.muted} />}
          editable={!loading}
        />

        {/* Terms Agreement */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => {
            setAgreedToTerms(!agreedToTerms);
            if (fieldErrors.terms) setFieldErrors((prev) => ({ ...prev, terms: undefined }));
          }}
          activeOpacity={0.8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: agreedToTerms }}
        >
          {agreedToTerms ? (
            <CheckSquare size={22} color={colors.primaryDark} />
          ) : (
            <Square size={22} color={colors.border} />
          )}
          <Text variant="caption" color={colors.inkSoft} style={styles.termsText}>
            I agree to Vetopia&apos;s Terms of Service and Privacy Policy.
          </Text>
        </TouchableOpacity>
        {fieldErrors.terms ? (
          <Text variant="caption" color={colors.destructive} style={styles.termsError}>
            {fieldErrors.terms}
          </Text>
        ) : null}

        <Button
          title="Create Account"
          onPress={handleRegister}
          loading={loading}
          disabled={loading}
          variant="primary"
          style={styles.registerButton}
        />
      </View>

      <View style={styles.footer}>
        <Text variant="bodySm" color={colors.muted}>
          Already have an account?{' '}
        </Text>
        <TouchableOpacity onPress={() => router.push('/(auth)/login')} accessibilityRole="link">
          <Text variant="bodySm" color={colors.primaryDark} style={styles.signInLink}>
            Sign In
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
    marginBottom: spacing.lg,
  },
  backButton: {
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
  },
  title: {
    marginBottom: spacing.xs,
  },
  roleSelectionContainer: {
    marginBottom: spacing.lg,
  },
  roleLabel: {
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  roleCards: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  roleCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  selectedRoleCard: {
    borderColor: colors.primaryDark,
    backgroundColor: colors.cream,
  },
  roleTitle: {
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  selectedRoleTitle: {
    color: colors.primaryDark,
  },
  roleSub: {
    marginTop: 2,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F0FDF4',
    borderColor: colors.success,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  successIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  successBody: {
    flex: 1,
  },
  successTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  successText: {
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  successCta: {
    marginTop: spacing.xs,
    width: '100%',
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  termsText: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  termsError: {
    marginBottom: spacing.sm,
  },
  registerButton: {
    width: '100%',
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  signInLink: {
    fontWeight: '700',
  },
});
