import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Video } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function ConsultRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={2}>Telemedicine Room</Heading>
        <Text variant="bodySm" color={colors.muted}>
          Appointment ID: {id}
        </Text>
      </View>

      <EmptyState
        title="LiveKit Room Shell"
        description="Hardware-accelerated LiveKit Cloud video/audio calling, waiting room, and controls will be implemented in Phase 6 (MVP-05)."
        icon={<Video size={48} color={colors.primaryDark} />}
      />

      <Button title="Exit Consultation Room" onPress={() => router.back()} variant="destructive" />
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
