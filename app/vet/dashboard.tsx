import React, { useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, Alert, Switch } from 'react-native';
import {
  Stethoscope,
  LogOut,
  Clock,
  ShieldCheck,
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Star,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Input } from '../../src/components/ui/Input';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { AppointmentCard } from '../../src/components/appointments/AppointmentCard';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';
import { useAppointments, useCancelAppointment } from '../../src/hooks/useAppointments';
import { useMyVetProfile, useUpdateMyVetProfile } from '../../src/hooks/useVets';
import { Appointment } from '../../src/types/appointment';

export default function VetDashboardScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  const isVerified = user?.isVetVerified === true;

  // 1. Data Hooks
  const {
    data: upcomingAppointments,
    isLoading: loadingUpcoming,
    isError: isUpcomingError,
    error: upcomingError,
    refetch: refetchUpcoming,
    isRefetching: isRefetchingUpcoming,
  } = useAppointments('upcoming');

  const {
    data: pastAppointments,
    isLoading: loadingPast,
    isError: isPastError,
    error: pastError,
    refetch: refetchPast,
    isRefetching: isRefetchingPast,
  } = useAppointments('past');

  const { data: myVet, refetch: refetchVet, isRefetching: isRefetchingVet } = useMyVetProfile();

  const updateVetMutation = useUpdateMyVetProfile();
  const cancelMutation = useCancelAppointment();

  const isRefetching = isRefetchingUpcoming || isRefetchingPast || isRefetchingVet;

  const handleRefresh = async () => {
    await Promise.all([refetchUpcoming(), refetchPast(), refetchVet()]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of the Doctor Portal?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await authService.signOut();
        },
      },
    ]);
  };

  const handleVerifyLicense = async () => {
    if (!licenseNumber.trim()) {
      setVerificationError('Please enter your veterinary license number.');
      return;
    }
    setVerificationError(null);
    setVerifying(true);
    try {
      await authService.verifyLicense(licenseNumber.trim());
      await refetchVet();
      Alert.alert(
        'License Verified',
        'Your medical credentials have been verified. Consultation rooms and digital prescription features are now fully activated.',
      );
    } catch (err: any) {
      setVerificationError(
        err?.message || 'Verification failed. Please check the number and try again.',
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleToggleAccepting = async (value: boolean) => {
    try {
      await updateVetMutation.mutateAsync({ accepting: value });
    } catch (err: any) {
      Alert.alert(
        'Update Failed',
        err?.message || 'Could not update practice availability. Please try again.',
      );
    }
  };

  const handleCancelPress = (appointment: Appointment) => {
    Alert.alert(
      'Cancel Consultation',
      `Are you sure you want to cancel the scheduled visit for ${appointment.pet_name || 'Patient'}? The pet parent will be notified immediately.`,
      [
        { text: 'Keep Appointment', style: 'cancel' },
        {
          text: 'Confirm Cancellation',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(appointment.id);
              Alert.alert(
                'Consultation Cancelled',
                'The slot has been released back to your schedule.',
              );
            } catch (err: any) {
              Alert.alert('Cancellation Failed', err?.message || 'Could not cancel appointment.');
            }
          },
        },
      ],
    );
  };

  const currentList =
    activeTab === 'upcoming' ? upcomingAppointments || [] : pastAppointments || [];
  const currentLoading = activeTab === 'upcoming' ? loadingUpcoming : loadingPast;
  const currentError = activeTab === 'upcoming' ? upcomingError : pastError;
  const isCurrentError = activeTab === 'upcoming' ? isUpcomingError : isPastError;

  const upcomingCount = upcomingAppointments?.length || 0;
  const completedCount = (pastAppointments || []).filter((a) => a.status === 'completed').length;
  const isAccepting = myVet?.accepting ?? true;

  const renderHeader = () => (
    <View style={styles.header}>
      {/* Top Identity Row */}
      <View style={styles.headerTop}>
        <View style={styles.headerTitleWrap}>
          <Text variant="caption" color={colors.inkSoft} style={styles.kicker}>
            DOCTOR PORTAL
          </Text>
          <Heading level={2} style={styles.doctorName} numberOfLines={1}>
            {user?.fullName || myVet?.name || 'Dr. Veterinarian'}
          </Heading>
          <Text variant="caption" color={colors.primaryDark} style={styles.specialtyText}>
            {myVet?.specialty || 'General Veterinary Medicine'}
          </Text>
        </View>

        <View style={styles.headerRightActions}>
          {isVerified ? (
            <Badge label="Verified Vet" variant="verified" />
          ) : (
            <Badge label="Pending Approval" variant="pending" />
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign out of doctor account"
            onPress={handleSignOut}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          >
            <LogOut size={18} color={colors.destructive} />
          </Pressable>
        </View>
      </View>

      {/* License Verification Warning Card (when unverified) */}
      {!isVerified && (
        <Card style={styles.pendingCard}>
          <View style={styles.pendingRow}>
            <Clock size={20} color={colors.warning} style={styles.pendingIcon} />
            <View style={styles.pendingText}>
              <Text variant="caption" color={colors.ink} style={styles.pendingTitle}>
                Medical License Verification Required
              </Text>
              <Text variant="caption" color={colors.inkSoft} style={styles.pendingDescription}>
                Telemedicine consultation rooms and digital prescription creation are locked until
                your veterinary medical license is approved.
              </Text>

              {verificationError ? (
                <View style={styles.errorContainer}>
                  <AlertCircle size={14} color={colors.destructive} />
                  <Text variant="caption" color={colors.destructive} style={styles.errorText}>
                    {verificationError}
                  </Text>
                </View>
              ) : null}

              <View style={styles.verifyInputContainer}>
                <Input
                  placeholder="e.g. VET-84920"
                  value={licenseNumber}
                  onChangeText={(val) => {
                    setLicenseNumber(val);
                    if (verificationError) setVerificationError(null);
                  }}
                  autoCapitalize="characters"
                  leftIcon={<ShieldCheck size={18} color={colors.primaryDark} />}
                />
                <Button
                  title={verifying ? 'Verifying License...' : 'Verify License Instantly'}
                  onPress={handleVerifyLicense}
                  disabled={verifying || !licenseNumber.trim()}
                  loading={verifying}
                  style={styles.verifyButton}
                />
              </View>
            </View>
          </View>
        </Card>
      )}

      {/* Verified Practice Controls & Overview */}
      {isVerified && (
        <View style={styles.practiceSection}>
          {/* Availability Toggle Card */}
          <Card style={styles.availabilityCard}>
            <View style={styles.availRow}>
              <View style={styles.availInfo}>
                <View style={styles.availStatusRow}>
                  <View
                    style={[styles.statusDot, isAccepting ? styles.dotActive : styles.dotPaused]}
                  />
                  <Text variant="bodyMd" color={colors.ink} style={styles.boldText}>
                    {isAccepting ? 'Accepting Patients' : 'Consultations Paused'}
                  </Text>
                </View>
                <Text variant="caption" color={colors.inkSoft} style={styles.availSub}>
                  {isAccepting
                    ? 'Your 14-day schedule slots are bookable in the Vet Directory.'
                    : 'Your profile is hidden from new appointment bookings.'}
                </Text>
              </View>

              <Switch
                value={isAccepting}
                onValueChange={handleToggleAccepting}
                disabled={updateVetMutation.isPending}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.white}
              />
            </View>
          </Card>

          {/* Practice Summary Metric Stats */}
          <View style={styles.statsGrid}>
            <Card style={styles.statBox}>
              <View style={styles.statIconWrap}>
                <Calendar size={16} color={colors.primaryDark} />
              </View>
              <Text variant="headingSm" color={colors.ink}>
                {upcomingCount}
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                In Queue
              </Text>
            </Card>

            <Card style={styles.statBox}>
              <View style={styles.statIconWrap}>
                <CheckCircle2 size={16} color={colors.primaryDark} />
              </View>
              <Text variant="headingSm" color={colors.ink}>
                {completedCount}
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                Concluded
              </Text>
            </Card>

            <Card style={styles.statBox}>
              <View style={styles.statIconWrap}>
                <DollarSign size={16} color={colors.primaryDark} />
              </View>
              <Text variant="headingSm" color={colors.ink}>
                ${Number(myVet?.price_usd || 29).toFixed(0)}
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                Slot Rate
              </Text>
            </Card>

            <Card style={styles.statBox}>
              <View style={styles.statIconWrap}>
                <Star size={16} color="#D97706" />
              </View>
              <Text variant="headingSm" color={colors.ink}>
                {myVet?.rating ? Number(myVet.rating).toFixed(1) : '5.0'}
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                {myVet?.reviews || 0} Reviews
              </Text>
            </Card>
          </View>
        </View>
      )}

      {/* Patient Queue Section Header & Tab Controls */}
      <View style={styles.queueHeader}>
        <View style={styles.queueTitleRow}>
          <Heading level={3}>Patient Consultations</Heading>
          {upcomingCount > 0 && (
            <View style={styles.queueCountBadge}>
              <Text variant="caption" color={colors.ink} style={styles.queueCountText}>
                {upcomingCount} upcoming
              </Text>
            </View>
          )}
        </View>

        {/* Segmented Queue Controller */}
        <View style={styles.segmentContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View upcoming patient appointments"
            style={[styles.segmentButton, activeTab === 'upcoming' && styles.segmentActive]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text
              variant="bodySm"
              color={activeTab === 'upcoming' ? colors.ink : colors.inkSoft}
              style={activeTab === 'upcoming' ? styles.activeText : undefined}
            >
              Upcoming Queue ({upcomingCount})
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View past and completed consultations"
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
    </View>
  );

  return (
    <Screen style={styles.container}>
      <FlatList
        data={currentList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <AppointmentCard
            appointment={item}
            onCancel={activeTab === 'upcoming' ? handleCancelPress : undefined}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => {
          if (currentLoading) {
            return (
              <View style={styles.loadingContainer}>
                <Skeleton width="100%" height={150} style={styles.skeleton} />
                <Skeleton width="100%" height={150} style={styles.skeleton} />
              </View>
            );
          }

          if (isCurrentError) {
            return (
              <ErrorState
                title="Could not load consultations"
                message={currentError?.message || 'Check your connection and try again.'}
                onRetry={handleRefresh}
              />
            );
          }

          if (activeTab === 'upcoming') {
            return (
              <EmptyState
                title="No Upcoming Consultations"
                description={
                  isVerified
                    ? "You're all caught up! When pet parents book consultations, they will appear here in chronological order."
                    : 'Verify your medical license above to activate consultation rooms and accept patient appointments.'
                }
                icon={<Stethoscope size={44} color={colors.primaryDark} />}
              />
            );
          }

          return (
            <EmptyState
              title="No Past Consultations"
              description="Concluded telemedicine appointments and digital prescriptions will be recorded here."
              icon={<Calendar size={44} color={colors.muted} />}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primaryDark}
            colors={[colors.primaryDark]}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  kicker: {
    letterSpacing: 1.5,
    marginBottom: 2,
    fontWeight: '700',
  },
  doctorName: {
    fontSize: 22,
    marginBottom: 2,
  },
  specialtyText: {
    fontWeight: '600',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    padding: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  pendingCard: {
    padding: spacing.md,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pendingIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  pendingText: {
    flex: 1,
  },
  pendingTitle: {
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
    fontSize: 13,
  },
  pendingDescription: {
    color: '#78350F',
    lineHeight: 18,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  errorText: {
    flex: 1,
  },
  verifyInputContainer: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  verifyButton: {
    marginTop: spacing.xs,
    width: '100%',
  },
  practiceSection: {
    marginBottom: spacing.md,
  },
  availabilityCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  availInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  availStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotPaused: {
    backgroundColor: colors.muted,
  },
  boldText: {
    fontWeight: '700',
  },
  availSub: {
    lineHeight: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statBox: {
    flex: 1,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  statIconWrap: {
    marginBottom: 4,
  },
  queueHeader: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  queueCountBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  queueCountText: {
    fontWeight: '700',
    fontSize: 10,
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
  pressed: {
    opacity: 0.7,
  },
});
