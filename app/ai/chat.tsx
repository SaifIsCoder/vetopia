import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Bot } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function AIChatScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={2}>24/7 AI Triage Assistant</Heading>
        <Text variant="bodySm" color={colors.muted}>
          Powered by Google Gemini 2.5 Flash
        </Text>
      </View>

      <EmptyState
        title="AI Symptom Checker"
        description="Real-time clinical symptom triage and red-flag emergency detection will be implemented in Phase 10 (MVP-09)."
        icon={<Bot size={48} color={colors.primaryDark} />}
      />

      <Button title="Close Assistant" onPress={() => router.back()} variant="outline" />
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
