import React, { useState } from 'react';
import { View, StyleSheet, Pressable, FlatList, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { AppointmentCard } from '../../src/components/appointments/AppointmentCard';
import { useAppointments, useCancelAppointment } from '../../src/hooks/useAppointments';
import { Appointment } from '../../src/types/appointment';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function AppointmentsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const {
    data: appointments,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useAppointments(activeTab);

  const cancelMutation = useCancelAppointment();

  const handleCancelPress = (appointment: Appointment) => {
    const startsAt = new Date(appointment.starts_at).getTime();
    const now = Date.now();
    const twoHoursMs = 2 * 60 * 60 * 1000;
    const isLessThanTwoHours = startsAt - now < twoHoursMs;

    const message = isLessThanTwoHours
      ? 'Cancellation Policy Notice: This consultation is scheduled to start in less than 2 hours. Are you sure you want to proceed with cancelling?'
      : 'Are you sure you want to cancel this consultation? Your time slot will be released back to the doctor.';

    Alert.alert('Cancel Appointment', message, [
      { text: 'Keep Appointment', style: 'cancel' },
      {
        text: 'Confirm Cancellation',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelMutation.mutateAsync(appointment.id);
            Alert.alert(
              'Cancelled',
              'Your consultation appointment has been cancelled and the slot has been freed.',
            );
          } catch (err: any) {
            Alert.alert(
              'Cancellation Failed',
              err?.message || 'Could not cancel appointment. Please try again.',
            );
          }
        },
      },
    ]);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.titleSection}>
        <Heading level={1}>Appointments</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Manage your scheduled and completed telemedicine visits
        </Text>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View upcoming appointments"
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
          accessibilityRole="button"
          accessibilityLabel="View past consultations"
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
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={appointments || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            onCancel={activeTab === 'upcoming' ? handleCancelPress : undefined}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => {
          if (isLoading) {
            return (
              <View style={styles.loadingContainer}>
                <Skeleton width="100%" height={160} style={styles.skeleton} />
                <Skeleton width="100%" height={160} style={styles.skeleton} />
              </View>
            );
          }

          if (isError) {
            return (
              <ErrorState
                title="Could not load appointments"
                message={error?.message || 'Check your internet connection and try again.'}
                onRetry={refetch}
              />
            );
          }

          if (activeTab === 'upcoming') {
            return (
              <EmptyState
                title="No Upcoming Consultations"
                description="You don't have any scheduled appointments. Search our directory of certified veterinarians to book your next consultation."
                icon={<Calendar size={44} color={colors.primaryDark} />}
                actionTitle="Find a Vet"
                onAction={() => router.push('/(tabs)/vets')}
              />
            );
          }

          return (
            <EmptyState
              title="No Past Consultations"
              description="Your completed and past telemedicine visits will appear here."
              icon={<Calendar size={44} color={colors.muted} />}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primaryDark}
            colors={[colors.primaryDark]}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
  header: {
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  titleSection: {
    marginBottom: spacing.md,
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: spacing.xs,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  segmentActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  activeText: {
    fontWeight: '700',
  },
  loadingContainer: {
    paddingTop: spacing.sm,
  },
  skeleton: {
    marginBottom: spacing.md,
    borderRadius: radii.lg,
  },
});
