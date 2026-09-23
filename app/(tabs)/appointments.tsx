import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Calendar } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function AppointmentsScreen() {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Heading level={1}>Appointments</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Manage your scheduled and completed telemedicine visits
        </Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        <Pressable
          style={[styles.segmentButton, activeTab === 'upcoming' && styles.segmentActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text
            variant="bodySm"
            color={activeTab === 'upcoming' ? colors.ink : colors.inkSoft}
            style={activeTab === 'upcoming' ? styles.activeText : undefined}
          >
            Upcoming
          </Text>
        </Pressable>

        <Pressable
          style={[styles.segmentButton, activeTab === 'past' && styles.segmentActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text
            variant="bodySm"
            color={activeTab === 'past' ? colors.ink : colors.inkSoft}
            style={activeTab === 'past' ? styles.activeText : undefined}
          >
            Past Consultations
          </Text>
        </Pressable>
      </View>

      <EmptyState
        title={activeTab === 'upcoming' ? 'No Upcoming Consultations' : 'No Past Consultations'}
        description="Appointments scheduling, countdown reminders, and LiveKit video consultation rooms will be implemented in Phase 5 & 6 (MVP-04 & MVP-05)."
        icon={<Calendar size={44} color={colors.primaryDark} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: spacing.xs,
    marginBottom: spacing.xl,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  segmentActive: {
    backgroundColor: colors.white,
  },
  activeText: {
    fontWeight: '700',
  },
});
