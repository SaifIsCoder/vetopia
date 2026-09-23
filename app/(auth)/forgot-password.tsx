import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react-native';
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

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  const handleReset = async () => {
    setErrorMessage(null);
    setFieldError(undefined);

    if (!email.trim() || !email.includes('@') || !email.includes('.')) {
      setFieldError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await authService.requestPasswordReset(email.trim());
      setSent(true);
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to send recovery link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Screen style={styles.container}>
        <View style={styles.confirmationContent}>
          <View style={styles.iconCircle}>
            <CheckCircle2 size={56} color={colors.primaryDark} />
          </View>
          <Heading level={1} style={styles.title}>
            Check Your Email
          </Heading>
          <Text variant="bodyMd" color={colors.muted} style={styles.confirmText}>
            We&apos;ve sent a password reset link to{' '}
            <Text variant="bodyMd" color={colors.ink} style={styles.boldEmail}>
              {email}
            </Text>
            . Please check your inbox and follow the instructions.
          </Text>

          <Button
            title="Return to Sign In"
            onPress={() => router.replace('/(auth)/login')}
            variant="primary"
            style={styles.actionButton}
          />
          <Button
            title="Resend Link"
            onPress={() => {
              setSent(false);
              handleReset();
            }}
            variant="ghost"
            style={styles.actionButton}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.container}>
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
          Password Reset
        </Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Enter your registered email address and we&apos;ll send you instructions to reset your
          password.
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
          label="Registered Email"
          placeholder="your.email@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            if (fieldError) setFieldError(undefined);
          }}
          error={fieldError}
          leftIcon={<Mail size={20} color={colors.muted} />}
          editable={!loading}
        />

        <Button
          title="Send Recovery Link"
          onPress={handleReset}
          loading={loading}
          disabled={loading}
          variant="primary"
          style={styles.sendButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
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
    flex: 1,
  },
  sendButton: {
    width: '100%',
    marginTop: spacing.md,
  },
  confirmationContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  confirmText: {
    textAlign: 'center',
    marginVertical: spacing.lg,
    lineHeight: 22,
  },
  boldEmail: {
    fontWeight: '700',
  },
  actionButton: {
    width: '100%',
    marginBottom: spacing.sm,
  },
});
