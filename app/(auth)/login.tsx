import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function LoginScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={1}>Sign In</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          MVP-01 Authentication & RBAC module connects in Phase 2
        </Text>
      </View>

      <EmptyState
        title="Authentication Foundation Ready"
        description="User login, biometrics (Face ID/Fingerprint), and JWT token refresh rotation will be implemented in Phase 2."
        icon={<Lock size={44} color={colors.primaryDark} />}
      />

      <Button
        title="Return to Home"
        onPress={() => router.replace('/(tabs)')}
        variant="primary"
        style={styles.button}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  button: {
    marginTop: spacing.xl,
  },
});
