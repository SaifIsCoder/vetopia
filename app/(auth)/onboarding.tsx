import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function OnboardingScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={1}>Welcome Setup</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Initial profile photo & first pet registration wizard
        </Text>
      </View>

      <EmptyState
        title="Onboarding Flow"
        description="The onboarding wizard for new accounts will be implemented in Phase 2 & 3."
        icon={<Sparkles size={44} color={colors.primaryDark} />}
      />

      <Button
        title="Finish (Go to Home)"
        onPress={() => router.replace('/(tabs)')}
        variant="primary"
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
});
