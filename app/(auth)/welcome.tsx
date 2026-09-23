import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.content}>
        <Text variant="caption" color={colors.inkSoft} style={styles.kicker}>
          THE PETS CLUB
        </Text>
        <Heading level={1} style={styles.title}>
          Vetopia
        </Heading>
        <Text variant="bodyLg" color={colors.muted} style={styles.subtitle}>
          Online vet consultations in your language, digital health passports, and 24/7 AI triage.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button
          title="Explore Platform"
          onPress={() => router.replace('/(tabs)')}
          variant="primary"
          style={styles.button}
        />
        <Button
          title="Sign In (Phase 2)"
          onPress={() => router.push('/(auth)/login')}
          variant="outline"
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: spacing['3xl'],
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  kicker: {
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
  },
  title: {
    marginBottom: spacing.md,
  },
  subtitle: {
    lineHeight: 24,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  button: {
    width: '100%',
  },
});
