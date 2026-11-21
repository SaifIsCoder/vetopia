import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  Switch,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {
  Stethoscope,
  LogOut,
  Clock,
  ShieldCheck,
  AlertCircle,
  Calendar,
  CheckCircle2,
  DollarSign,
  Settings,
  CalendarX,
  Trash2,
  Plus,
  Timer,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { Chip } from '../../src/components/ui/Chip';
import { Input } from '../../src/components/ui/Input';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { Modal } from '../../src/components/feedback/Modal';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { AppointmentCard } from '../../src/components/appointments/AppointmentCard';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';
import { useAppointments, useCancelAppointment } from '../../src/hooks/useAppointments';
import {
  useMyVetProfile,
  useUpdateMyVetProfile,
  useMyAvailability,
  useUpdateMyAvailability,
  useMyBlockedDates,
  useAddBlockedDate,
  useRemoveBlockedDate,
} from '../../src/hooks/useVets';
import { Appointment } from '../../src/types/appointment';
import {
  VET_SPECIALTIES,
  VET_LANGUAGES,
  VET_COUNTRIES,
  COMMON_TIMEZONES,
  CONSULTATION_DURATIONS,
  WEEKDAYS,
  ConsultationDuration,
} from '../../src/types/vet';

interface DayScheduleDraft {
  weekday: number;
  enabled: boolean;
  start_minute: number;
  end_minute: number;
}

export default function VetDashboardScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Modals state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isBlockedDatesModalOpen, setIsBlockedDatesModalOpen] = useState(false);
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
  const isVerified = myVet?.verified ?? user?.isVetVerified === true;

  useEffect(() => {
    if (user && myVet && myVet.verified !== user.isVetVerified) {
      const { user: currentUser, setUser } = useAuthStore.getState();
      if (currentUser?.id === user.id) {
        setUser({ ...currentUser, isVetVerified: myVet.verified });
      }
    }
  }, [myVet, user]);

  const { data: myAvailability, refetch: refetchAvailability } = useMyAvailability(myVet?.id);
  const { data: myBlockedDates, refetch: refetchBlockedDates } = useMyBlockedDates(myVet?.id);

  const updateVetMutation = useUpdateMyVetProfile();
  const updateAvailabilityMutation = useUpdateMyAvailability();
  const addBlockedDateMutation = useAddBlockedDate();
  const removeBlockedDateMutation = useRemoveBlockedDate();
  const cancelMutation = useCancelAppointment();

  // Profile Edit Form State
  const [editBio, setEditBio] = useState('');
  const [editSpecialty, setEditSpecialty] = useState<string>(VET_SPECIALTIES[0]);
  const [editLanguages, setEditLanguages] = useState<string[]>(['English']);
  const [editPriceUsd, setEditPriceUsd] = useState('29');
  const [editSlotMinutes, setEditSlotMinutes] = useState<ConsultationDuration>(30);
  const [editTimezone, setEditTimezone] = useState('UTC');
  const [editCountry, setEditCountry] = useState<string>(VET_COUNTRIES[0]);
  const [profileFormError, setProfileFormError] = useState<string | null>(null);

  // Weekly Schedule Draft State
  const [scheduleDraft, setScheduleDraft] = useState<DayScheduleDraft[]>(() =>
    WEEKDAYS.map((w) => ({
      weekday: w.index,
      enabled: w.index >= 1 && w.index <= 5, // Default Mon-Fri
      start_minute: 540, // 09:00
      end_minute: 1020, // 17:00
    })),
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Blocked Date Form State
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');
  const [blockedDateError, setBlockedDateError] = useState<string | null>(null);

  // Open modal handlers
  const handleOpenProfileModal = () => {
    if (myVet) {
      setEditBio(myVet.bio || '');
      setEditSpecialty(myVet.specialty || VET_SPECIALTIES[0]);
      setEditLanguages(myVet.languages?.length ? myVet.languages : ['English']);
      setEditPriceUsd(String(myVet.price_usd || 29));
      setEditSlotMinutes((myVet.slot_minutes as ConsultationDuration) || 30);
      setEditTimezone(myVet.timezone || 'UTC');
      setEditCountry(myVet.country || VET_COUNTRIES[0]);
    }
    setProfileFormError(null);
    setIsProfileModalOpen(true);
  };

  const handleOpenScheduleModal = () => {
    if (myAvailability && myAvailability.length > 0) {
      setScheduleDraft(
        WEEKDAYS.map((w) => {
          const found = myAvailability.find((a) => a.weekday === w.index);
          return {
            weekday: w.index,
            enabled: !!found,
            start_minute: found ? found.start_minute : 540,
            end_minute: found ? found.end_minute : 1020,
          };
        }),
      );
    }
    setScheduleError(null);
    setIsScheduleModalOpen(true);
  };

  const handleOpenBlockedDatesModal = () => {
    setNewBlockedDate('');
    setNewBlockedReason('');
    setBlockedDateError(null);
    setIsBlockedDatesModalOpen(true);
  };

  const isRefetching =
    isRefetchingUpcoming || isRefetchingPast || isRefetchingVet;

  const handleRefresh = async () => {
    await Promise.all([
      refetchUpcoming(),
      refetchPast(),
      refetchVet(),
      refetchAvailability(),
      refetchBlockedDates(),
    ]);
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

  const handleRequestLicenseReview = async () => {
    if (!licenseNumber.trim()) {
      setVerificationError('Please enter your veterinary license number.');
      return;
    }
    setVerificationError(null);
    setVerifying(true);
    try {
      await authService.requestLicenseReview(licenseNumber.trim());
      setLicenseNumber('');
      Alert.alert(
        'License Submitted',
        'An administrator will review your license. Refresh this screen to check your approval status.',
      );
    } catch (err: any) {
      setVerificationError(err?.message || 'Could not submit your license for review.');
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

  // Profile Save
  const handleSaveProfile = async () => {
    setProfileFormError(null);
    const parsedFee = parseFloat(editPriceUsd);
    if (isNaN(parsedFee) || parsedFee <= 0) {
      setProfileFormError('Please enter a valid positive consultation fee.');
      return;
    }
    if (editLanguages.length === 0) {
      setProfileFormError('Please select at least one spoken language.');
      return;
    }

    try {
      await updateVetMutation.mutateAsync({
        bio: editBio.trim() || null,
        specialty: editSpecialty,
        languages: editLanguages,
        price_usd: parsedFee,
        slot_minutes: editSlotMinutes,
        timezone: editTimezone,
        country: editCountry,
      });
      setIsProfileModalOpen(false);
      Alert.alert('Profile Saved', 'Your practice details and fees have been updated.');
    } catch (err: any) {
      setProfileFormError(err?.message || 'Failed to save practice profile.');
    }
  };

  // Toggle Language in multiselect
  const toggleLanguage = (lang: string) => {
    setEditLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang],
    );
  };

  // Schedule Save
  const handleSaveSchedule = async () => {
    if (!myVet?.id) return;
    setScheduleError(null);

    const activeWindows = scheduleDraft
      .filter((d) => d.enabled)
      .map((d) => ({
        weekday: d.weekday,
        start_minute: d.start_minute,
        end_minute: d.end_minute,
      }));

    for (const w of activeWindows) {
      if (w.start_minute >= w.end_minute) {
        setScheduleError('End time must be after start time for all active days.');
        return;
      }
      if (w.end_minute - w.start_minute < 15) {
        setScheduleError('Availability windows must be at least 15 minutes.');
        return;
      }
    }

    try {
      await updateAvailabilityMutation.mutateAsync({
        vetId: myVet.id,
        windows: activeWindows,
      });
      setIsScheduleModalOpen(false);
      Alert.alert(
        'Schedule Updated',
        'Your weekly working hours have been updated and synced to the booking calendar.',
      );
    } catch (err: any) {
      setScheduleError(err?.message || 'Failed to save working hours.');
    }
  };

  // Blocked Date Add
  const handleAddBlockedDate = async () => {
    if (!myVet?.id) return;
    setBlockedDateError(null);

    const dateTrimmed = newBlockedDate.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateTrimmed)) {
      setBlockedDateError('Please enter a valid date in YYYY-MM-DD format (e.g. 2026-11-15).');
      return;
    }

    try {
      await addBlockedDateMutation.mutateAsync({
        vetId: myVet.id,
        date: dateTrimmed,
        reason: newBlockedReason.trim() || null,
      });
      setNewBlockedDate('');
      setNewBlockedReason('');
      Alert.alert('Date Blocked', `${dateTrimmed} is now blocked. No patients can book slots on this date.`);
    } catch (err: any) {
      setBlockedDateError(err?.message || 'Could not block date.');
    }
  };

  // Blocked Date Remove
  const handleRemoveBlockedDate = (date: string) => {
    if (!myVet?.id) return;
    Alert.alert('Unblock Date', `Are you sure you want to remove ${date} from blocked dates?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeBlockedDateMutation.mutateAsync({ vetId: myVet.id, date });
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to unblock date.');
          }
        },
      },
    ]);
  };

  // Format minute to HH:MM string
  const formatMinuteString = (m: number): string => {
    const hours = Math.floor(m / 60);
    const mins = m % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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
                Submit your veterinary license number for administrator review. Consultations and
                prescriptions become available after approval.
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
                  title={verifying ? 'Submitting License…' : 'Submit for Review'}
                  onPress={handleRequestLicenseReview}
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
                <Timer size={16} color={colors.primaryDark} />
              </View>
              <Text variant="headingSm" color={colors.ink}>
                {myVet?.slot_minutes || 30}m
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                Duration
              </Text>
            </Card>
          </View>

          {/* Doctor Management Actions (Phase A) */}
          <View style={styles.managementActionsRow}>
            <Button
              title="Edit Profile & Fees"
              variant="outline"
              size="sm"
              leftIcon={<Settings size={14} color={colors.ink} />}
              onPress={handleOpenProfileModal}
              style={styles.actionButton}
            />
            <Button
              title="Working Hours"
              variant="outline"
              size="sm"
              leftIcon={<Clock size={14} color={colors.ink} />}
              onPress={handleOpenScheduleModal}
              style={styles.actionButton}
            />
            <Button
              title="Blocked Dates"
              variant="outline"
              size="sm"
              leftIcon={<CalendarX size={14} color={colors.ink} />}
              onPress={handleOpenBlockedDatesModal}
              style={styles.actionButton}
            />
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
        initialNumToRender={6}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews={true}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primaryDark}
            colors={[colors.primaryDark]}
          />
        }
      />

      {/* 1. Modal: Edit Profile & Practice Settings */}
      <Modal
        visible={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="Practice Settings & Bio"
      >
        <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
          {profileFormError ? (
            <View style={styles.modalErrorBanner}>
              <AlertCircle size={16} color={colors.destructive} />
              <Text variant="caption" color={colors.destructive} style={styles.modalErrorText}>
                {profileFormError}
              </Text>
            </View>
          ) : null}

          {/* Consultation Fee */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            CONSULTATION FEE (USD)
          </Text>
          <Input
            placeholder="29"
            keyboardType="numeric"
            value={editPriceUsd}
            onChangeText={setEditPriceUsd}
            leftIcon={<DollarSign size={16} color={colors.primaryDark} />}
          />

          {/* Consultation Duration */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            SLOT DURATION
          </Text>
          <View style={styles.chipsRow}>
            {CONSULTATION_DURATIONS.map((dur) => (
              <Chip
                key={dur}
                label={`${dur} mins`}
                selected={editSlotMinutes === dur}
                onPress={() => setEditSlotMinutes(dur)}
                style={styles.chipItem}
              />
            ))}
          </View>

          {/* Medical Specialty */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            SPECIALTY
          </Text>
          <View style={styles.chipsRow}>
            {VET_SPECIALTIES.map((spec) => (
              <Chip
                key={spec}
                label={spec}
                selected={editSpecialty === spec}
                onPress={() => setEditSpecialty(spec)}
                style={styles.chipItem}
              />
            ))}
          </View>

          {/* Spoken Languages */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            SPOKEN LANGUAGES
          </Text>
          <View style={styles.chipsRow}>
            {VET_LANGUAGES.map((lang) => (
              <Chip
                key={lang}
                label={lang}
                selected={editLanguages.includes(lang)}
                onPress={() => toggleLanguage(lang)}
                style={styles.chipItem}
              />
            ))}
          </View>

          {/* Timezone */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            TIMEZONE
          </Text>
          <View style={styles.chipsRow}>
            {COMMON_TIMEZONES.map((tz) => (
              <Chip
                key={tz}
                label={tz}
                selected={editTimezone === tz}
                onPress={() => setEditTimezone(tz)}
                style={styles.chipItem}
              />
            ))}
          </View>

          {/* Country */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            COUNTRY
          </Text>
          <View style={styles.chipsRow}>
            {VET_COUNTRIES.map((c) => (
              <Chip
                key={c}
                label={c}
                selected={editCountry === c}
                onPress={() => setEditCountry(c)}
                style={styles.chipItem}
              />
            ))}
          </View>

          {/* Biography */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            BIOGRAPHY & CLINICAL EXPERIENCE
          </Text>
          <Input
            placeholder="Share your clinical background, certifications, and philosophy of care..."
            value={editBio}
            onChangeText={setEditBio}
            multiline
            numberOfLines={4}
            style={styles.multilineInput}
          />

          <View style={styles.modalActions}>
            <Button
              title="Save Changes"
              onPress={handleSaveProfile}
              loading={updateVetMutation.isPending}
              disabled={updateVetMutation.isPending}
              variant="primary"
            />
          </View>
        </ScrollView>
      </Modal>

      {/* 2. Modal: Manage Weekly Availability */}
      <Modal
        visible={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title="Weekly Working Hours"
      >
        <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
          <Text variant="caption" color={colors.inkSoft} style={styles.scheduleIntro}>
            Set your recurring available windows for each weekday. Bookable slots will be generated
            in your authoritative timezone ({myVet?.timezone || 'UTC'}).
          </Text>

          {scheduleError ? (
            <View style={styles.modalErrorBanner}>
              <AlertCircle size={16} color={colors.destructive} />
              <Text variant="caption" color={colors.destructive} style={styles.modalErrorText}>
                {scheduleError}
              </Text>
            </View>
          ) : null}

          {WEEKDAYS.map((w) => {
            const draft = scheduleDraft.find((d) => d.weekday === w.index) || {
              weekday: w.index,
              enabled: false,
              start_minute: 540,
              end_minute: 1020,
            };

            const toggleDay = (val: boolean) => {
              setScheduleDraft((prev) =>
                prev.map((d) => (d.weekday === w.index ? { ...d, enabled: val } : d)),
              );
            };

            const updateHours = (startM: number, endM: number) => {
              setScheduleDraft((prev) =>
                prev.map((d) =>
                  d.weekday === w.index
                    ? { ...d, start_minute: startM, end_minute: endM }
                    : d,
                ),
              );
            };

            return (
              <Card key={w.index} style={styles.dayCard}>
                <View style={styles.dayRow}>
                  <View style={styles.dayInfo}>
                    <Text variant="bodyMd" style={styles.boldText}>
                      {w.label}
                    </Text>
                    <Text variant="caption" color={colors.inkSoft}>
                      {draft.enabled
                        ? `${formatMinuteString(draft.start_minute)} — ${formatMinuteString(draft.end_minute)}`
                        : 'Unavailable'}
                    </Text>
                  </View>
                  <Switch
                    value={draft.enabled}
                    onValueChange={toggleDay}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>

                {draft.enabled && (
                  <View style={styles.presetButtonsRow}>
                    <TouchableOpacity
                      onPress={() => updateHours(540, 1020)} // 09:00 - 17:00
                      style={[
                        styles.presetChip,
                        draft.start_minute === 540 && draft.end_minute === 1020 && styles.presetChipActive,
                      ]}
                    >
                      <Text variant="caption" color={colors.ink}>09:00 - 17:00</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateHours(480, 960)} // 08:00 - 16:00
                      style={[
                        styles.presetChip,
                        draft.start_minute === 480 && draft.end_minute === 960 && styles.presetChipActive,
                      ]}
                    >
                      <Text variant="caption" color={colors.ink}>08:00 - 16:00</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateHours(600, 1080)} // 10:00 - 18:00
                      style={[
                        styles.presetChip,
                        draft.start_minute === 600 && draft.end_minute === 1080 && styles.presetChipActive,
                      ]}
                    >
                      <Text variant="caption" color={colors.ink}>10:00 - 18:00</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => updateHours(720, 1200)} // 12:00 - 20:00
                      style={[
                        styles.presetChip,
                        draft.start_minute === 720 && draft.end_minute === 1200 && styles.presetChipActive,
                      ]}
                    >
                      <Text variant="caption" color={colors.ink}>12:00 - 20:00</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            );
          })}

          <View style={styles.modalActions}>
            <Button
              title="Save Working Hours"
              onPress={handleSaveSchedule}
              loading={updateAvailabilityMutation.isPending}
              disabled={updateAvailabilityMutation.isPending}
              variant="primary"
            />
          </View>
        </ScrollView>
      </Modal>

      {/* 3. Modal: Blocked Dates & Time Off */}
      <Modal
        visible={isBlockedDatesModalOpen}
        onClose={() => setIsBlockedDatesModalOpen(false)}
        title="Time Off & Blocked Dates"
      >
        <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
          <Text variant="caption" color={colors.inkSoft} style={styles.scheduleIntro}>
            Block out specific dates (holidays, personal days, or conferences) so patients cannot
            book appointments on those days.
          </Text>

          {blockedDateError ? (
            <View style={styles.modalErrorBanner}>
              <AlertCircle size={16} color={colors.destructive} />
              <Text variant="caption" color={colors.destructive} style={styles.modalErrorText}>
                {blockedDateError}
              </Text>
            </View>
          ) : null}

          {/* Add Blocked Date Form */}
          <Card style={styles.addBlockedCard}>
            <Text variant="bodySm" style={styles.boldText}>
              Add Blocked Date
            </Text>
            <View style={styles.blockedInputs}>
              <Input
                placeholder="YYYY-MM-DD (e.g. 2026-11-20)"
                value={newBlockedDate}
                onChangeText={setNewBlockedDate}
                leftIcon={<CalendarX size={16} color={colors.primaryDark} />}
              />
              <Input
                placeholder="Reason (e.g. Annual Leave, Holiday)"
                value={newBlockedReason}
                onChangeText={setNewBlockedReason}
              />
              <Button
                title="Block Date"
                size="sm"
                leftIcon={<Plus size={16} color={colors.white} />}
                onPress={handleAddBlockedDate}
                loading={addBlockedDateMutation.isPending}
                disabled={!newBlockedDate.trim() || addBlockedDateMutation.isPending}
              />
            </View>
          </Card>

          {/* List of Active Blocked Dates */}
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            CURRENTLY BLOCKED DATES ({myBlockedDates?.length || 0})
          </Text>

          {myBlockedDates && myBlockedDates.length > 0 ? (
            myBlockedDates.map((item) => (
              <Card key={item.id} style={styles.blockedItemCard}>
                <View style={styles.blockedItemRow}>
                  <View style={styles.blockedItemInfo}>
                    <Text variant="bodyMd" style={styles.boldText}>
                      {item.blocked_date}
                    </Text>
                    {item.reason ? (
                      <Text variant="caption" color={colors.inkSoft}>
                        {item.reason}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveBlockedDate(item.blocked_date)}
                    style={styles.trashBtn}
                    accessibilityLabel={`Remove blocked date ${item.blocked_date}`}
                  >
                    <Trash2 size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </Card>
            ))
          ) : (
            <Text variant="caption" color={colors.muted} style={styles.emptyBlockedText}>
              No blocked dates scheduled.
            </Text>
          )}
        </ScrollView>
      </Modal>
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
    marginBottom: spacing.sm,
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
  managementActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionButton: {
    flex: 1,
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
  modalScrollView: {
    maxHeight: 480,
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FEE2E2',
    borderColor: colors.destructive,
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  modalErrorText: {
    flex: 1,
  },
  fieldLabel: {
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  chipItem: {
    marginBottom: 2,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  scheduleIntro: {
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  dayCard: {
    marginBottom: spacing.xs,
    padding: spacing.sm,
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayInfo: {
    flex: 1,
  },
  presetButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  presetChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
  },
  presetChipActive: {
    backgroundColor: '#DBEAFE',
    borderColor: colors.primaryDark,
    borderWidth: 1,
  },
  addBlockedCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  blockedInputs: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  blockedItemCard: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  blockedItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockedItemInfo: {
    flex: 1,
  },
  trashBtn: {
    padding: spacing.xs,
  },
  emptyBlockedText: {
    fontStyle: 'italic',
    marginVertical: spacing.xs,
  },
});
