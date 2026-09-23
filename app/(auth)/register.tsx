import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { UserPlus } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function RegisterScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={1}>Create Account</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Role-based registration (Pet Parent vs Veterinarian)
        </Text>
      </View>

      <EmptyState
        title="Registration Ready"
        description="Account registration with role assignment will be implemented in Phase 2 (MVP-01)."
        icon={<UserPlus size={44} color={colors.primaryDark} />}
      />

      <Button title="Return to Home" onPress={() => router.replace('/(tabs)')} variant="primary" />
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
});
