import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function BookingScreen() {
  const { vetId } = useLocalSearchParams<{ vetId: string }>();
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={2}>Book Consultation</Heading>
        <Text variant="bodySm" color={colors.muted}>
          Doctor ID: {vetId}
        </Text>
      </View>

      <EmptyState
        title="Booking Wizard Shell"
        description="Slot reservation, pet selection, and appointment confirmation will be implemented in Phase 5 (MVP-04)."
        icon={<CalendarCheck size={48} color={colors.primaryDark} />}
      />

      <Button title="Close" onPress={() => router.back()} variant="outline" />
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
