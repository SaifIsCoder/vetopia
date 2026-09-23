import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pill } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={2}>Digital Prescription</Heading>
        <Text variant="bodySm" color={colors.muted}>
          Prescription ID: {id}
        </Text>
      </View>

      <EmptyState
        title="Prescription Details"
        description="Structured medication dosage, instructions, and PDF generation will be implemented in Phase 7 (MVP-06)."
        icon={<Pill size={48} color={colors.primaryDark} />}
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
