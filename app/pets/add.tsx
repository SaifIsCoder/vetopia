import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PlusCircle } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function AddPetScreen() {
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={2}>Register New Pet</Heading>
        <Text variant="bodySm" color={colors.muted}>
          Add household dog, cat, bird or other companion
        </Text>
      </View>

      <EmptyState
        title="Pet Registration"
        description="Pet intake and photo upload will be implemented in Phase 3 (MVP-02)."
        icon={<PlusCircle size={48} color={colors.primaryDark} />}
      />

      <Button title="Cancel" onPress={() => router.back()} variant="outline" />
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
