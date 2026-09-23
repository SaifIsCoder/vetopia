import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function ProfileSettingsScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={2}>Account Settings</Heading>
        <Text variant="bodySm" color={colors.muted}>
          Preferences, security & notifications
        </Text>
      </View>

      <EmptyState
        title="Settings & Profile"
        description="Profile editing, avatar upload, and biometric security toggles will be implemented in Phase 11 (MVP-10)."
        icon={<Settings size={48} color={colors.primaryDark} />}
      />

      <Button title="Back" onPress={() => router.back()} variant="outline" />
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
