import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Star, Globe, Clock, AlertCircle, Calendar } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { Chip } from '../../src/components/ui/Chip';
import { LoadingState } from '../../src/components/feedback/LoadingState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { useVet, useVetSchedule } from '../../src/hooks/useVets';
import { TimeSlot } from '../../src/types/vet';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function VetProfileScreen() {
  const { vetId } = useLocalSearchParams<{ vetId: string }>();
  const router = useRouter();

  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Queries
  const {
    data: vet,
    isLoading: isVetLoading,
    isError: isVetError,
    error: vetError,
    refetch: refetchVet,
  } = useVet(vetId || '');

  const {
    data: schedule,
    isLoading: isScheduleLoading,
    isError: isScheduleError,
    refetch: refetchSchedule,
  } = useVetSchedule(vetId || '', 14);

  // Selected day's slots
  const activeDay = useMemo(() => {
    if (!schedule || schedule.length === 0) return null;
    return schedule[selectedDateIndex] || schedule[0];
  }, [schedule, selectedDateIndex]);

  const handleBookingCTA = () => {
    // STRICT PHASE BOUNDARY (MVP-03 Veterinarian Discovery)
    // Appointment reservation and slot locking belong to Phase 5 (MVP-04 Appointments).
    Alert.alert(
      'Phase 5 Boundary',
      `Slot selected: ${selectedSlot?.formattedTime || 'Selected Slot'}.\n\nAppointment reservation, pet selection, and confirmation will be activated in Phase 5 (MVP-04 Appointments).`,
      [{ text: 'Understood', style: 'default' }],
    );
  };

  if (isVetLoading) {
    return (
      <Screen style={styles.centerContainer}>
        <LoadingState message="Loading doctor profile..." />
      </Screen>
    );
  }

  if (isVetError || !vet) {
    return (
      <Screen style={styles.centerContainer}>
        <ErrorState
          title="Doctor Not Found"
          message={vetError?.message || 'The requested veterinarian profile could not be loaded.'}
          onRetry={refetchVet}
          retryTitle="Retry"
        />
        <Button
          title="Back to Directory"
          variant="outline"
          onPress={() => router.back()}
          style={styles.backToDirectoryBtn}
        />
      </Screen>
    );
  }

  const languagesList =
    Array.isArray(vet.languages) && vet.languages.length > 0 ? vet.languages.join(', ') : 'English';

  const defaultBio =
    vet.bio ||
    `Licensed veterinary specialist dedicated to comprehensive clinical wellness, preventative medicine, and high-quality telemedicine consultations for domestic pets.`;

  return (
    <Screen scrollable style={styles.screen}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Find Vet directory"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={22} color={colors.ink} />
        </Pressable>
        <Heading level={3} style={styles.topBarTitle}>
          Doctor Profile
        </Heading>
        <View style={styles.topBarSpacer} />
      </View>

      {/* Hero Doctor Info Card */}
      <Card style={styles.heroCard}>
        <View style={styles.heroRow}>
          <Avatar name={vet.name} size={72} style={styles.avatar} />
          <View style={styles.heroDetails}>
            <View style={styles.nameRow}>
              <Text variant="headingSm" color={colors.ink} numberOfLines={2} style={styles.vetName}>
                {vet.name}
              </Text>
              {vet.verified ? (
                <Badge variant="verified" label="Verified" style={styles.verifiedBadge} />
              ) : null}
            </View>

            <Text variant="bodySm" color={colors.primaryDark} style={styles.specialty}>
              {vet.specialty}
            </Text>

            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.inkSoft}>
                {vet.flag ? `${vet.flag} ` : ''}
                {vet.country || 'Global'}
              </Text>
              <Text variant="caption" color={colors.muted} style={styles.dot}>
                •
              </Text>
              <View style={styles.ratingBox}>
                <Star size={14} color="#EAB308" fill="#EAB308" />
                <Text variant="caption" color={colors.ink} style={styles.ratingText}>
                  {Number(vet.rating || 5.0).toFixed(1)}
                </Text>
                <Text variant="caption" color={colors.muted}>
                  ({vet.reviews || 0} reviews)
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Spoken Languages */}
        <View style={styles.languagesRow}>
          <Globe size={15} color={colors.muted} />
          <Text variant="caption" color={colors.inkSoft} style={styles.languagesText}>
            Languages:{' '}
            <Text variant="caption" color={colors.ink} style={styles.boldText}>
              {languagesList}
            </Text>
          </Text>
        </View>
      </Card>

      {/* Pricing and Consultation Details */}
      <Card style={styles.pricingCard}>
        <View style={styles.pricingRow}>
          <View style={styles.priceCol}>
            <Text variant="caption" color={colors.muted}>
              CONSULTATION FEE
            </Text>
            <View style={styles.priceValueRow}>
              <Text variant="headingLg" color={colors.ink}>
                ${Number(vet.price_usd || 29).toFixed(0)}
              </Text>
              <Text variant="bodySm" color={colors.muted} style={styles.slotDuration}>
                / {vet.slot_minutes || 30} mins
              </Text>
            </View>
          </View>

          <View style={styles.priceDivider} />

          <View style={styles.timezoneCol}>
            <Text variant="caption" color={colors.muted}>
              TIMEZONE
            </Text>
            <View style={styles.timezoneRow}>
              <Clock size={14} color={colors.inkSoft} />
              <Text variant="bodySm" color={colors.ink} style={styles.timezoneText}>
                {vet.timezone || 'UTC'}
              </Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Biography Section */}
      <View style={styles.sectionContainer}>
        <Heading level={3} style={styles.sectionHeading}>
          About Doctor
        </Heading>
        <Card style={styles.bioCard}>
          <Text variant="bodyMd" color={colors.inkSoft} style={styles.bioText}>
            {defaultBio}
          </Text>
        </Card>
      </View>

      {/* Schedule / Live Availability Slots Section */}
      <View style={styles.sectionContainer}>
        <View style={styles.scheduleHeaderRow}>
          <Heading level={3} style={styles.sectionHeading}>
            Available Consultation Slots
          </Heading>
          <Text variant="caption" color={colors.muted}>
            Next 14 Days
          </Text>
        </View>

        {!vet.accepting ? (
          // Error Behavior (FR-VET-002): Doctor not accepting patients
          <Card style={styles.notAcceptingCard}>
            <View style={styles.notAcceptingRow}>
              <AlertCircle size={28} color={colors.destructive} style={styles.notAcceptingIcon} />
              <View style={styles.notAcceptingTextCol}>
                <Text variant="headingSm" color={colors.destructive}>
                  Currently Not Accepting Bookings
                </Text>
                <Text variant="bodySm" color={colors.inkSoft} style={styles.notAcceptingDesc}>
                  This veterinarian is not accepting new patient appointments at this time. Please
                  browse other verified doctors in the directory.
                </Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.scheduleCard}>
            {isScheduleLoading ? (
              <LoadingState message="Generating bookable slots..." />
            ) : isScheduleError ? (
              <ErrorState
                title="Could not load schedule"
                message="Unable to calculate available slots."
                onRetry={refetchSchedule}
              />
            ) : !schedule || schedule.length === 0 ? (
              <View style={styles.emptySchedule}>
                <Calendar size={32} color={colors.muted} />
                <Text variant="bodySm" color={colors.muted} style={styles.emptyScheduleText}>
                  No bookable slots found for the next 14 days.
                </Text>
              </View>
            ) : (
              <>
                {/* 14-Day Date Strip */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.dateStripScroll}
                  contentContainerStyle={styles.dateStripContent}
                >
                  {schedule.map((dayItem, index) => {
                    const isSelected = selectedDateIndex === index;
                    return (
                      <Pressable
                        key={dayItem.date}
                        accessibilityRole="button"
                        accessibilityLabel={`Select date ${dayItem.dayLabel}`}
                        onPress={() => {
                          setSelectedDateIndex(index);
                          setSelectedSlot(null);
                        }}
                        style={[styles.datePill, isSelected && styles.datePillSelected]}
                      >
                        <Text
                          variant="caption"
                          color={isSelected ? colors.ink : colors.inkSoft}
                          style={[styles.datePillLabel, isSelected && styles.boldText]}
                        >
                          {dayItem.dayLabel}
                        </Text>
                        <Text
                          variant="caption"
                          color={isSelected ? colors.ink : colors.muted}
                          style={styles.slotCountLabel}
                        >
                          {dayItem.slots.length} slots
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Slots Grid for Active Day */}
                <View style={styles.slotsGridContainer}>
                  {activeDay && activeDay.slots.length > 0 ? (
                    <View style={styles.slotsGrid}>
                      {activeDay.slots.map((slot) => {
                        const isChosen = selectedSlot?.startTime === slot.startTime;
                        return (
                          <Chip
                            key={slot.startTime}
                            label={slot.formattedTime}
                            selected={isChosen}
                            onPress={() => setSelectedSlot(slot)}
                            style={styles.slotChip}
                          />
                        );
                      })}
                    </View>
                  ) : (
                    <Text variant="bodySm" color={colors.muted} style={styles.noSlotsText}>
                      No available consultation times for this date.
                    </Text>
                  )}
                </View>
              </>
            )}
          </Card>
        )}
      </View>

      {/* Booking Action CTA (Phase Boundary) */}
      <View style={styles.ctaContainer}>
        {!vet.accepting ? (
          <Button
            title="Currently Not Accepting Bookings"
            variant="outline"
            disabled
            style={styles.bookingButton}
          />
        ) : (
          <Button
            title={
              selectedSlot
                ? `Proceed to Booking (${selectedSlot.formattedTime})`
                : 'Select an Available Slot'
            }
            variant="primary"
            disabled={!selectedSlot}
            onPress={handleBookingCTA}
            style={styles.bookingButton}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing['4xl'],
  },
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
  topBarTitle: {
    fontWeight: '700',
  },
  topBarSpacer: {
    width: 40,
  },
  heroCard: {
    marginBottom: spacing.md,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: spacing.md,
  },
  heroDetails: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  vetName: {
    fontWeight: '700',
    flex: 1,
    marginRight: spacing.xs,
  },
  verifiedBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  specialty: {
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    marginHorizontal: spacing.xs,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontWeight: '600',
    marginLeft: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  languagesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  languagesText: {
    flex: 1,
  },
  boldText: {
    fontWeight: '700',
  },
  pricingCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  pricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceCol: {
    flex: 1,
  },
  priceValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 2,
  },
  slotDuration: {
    marginLeft: 4,
  },
  priceDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  timezoneCol: {
    flex: 1,
  },
  timezoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  timezoneText: {
    fontWeight: '600',
  },
  sectionContainer: {
    marginBottom: spacing.lg,
  },
  sectionHeading: {
    marginBottom: spacing.xs,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: spacing.xs,
  },
  bioCard: {
    padding: spacing.md,
  },
  bioText: {
    lineHeight: 22,
  },
  notAcceptingCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: spacing.md,
  },
  notAcceptingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  notAcceptingIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  notAcceptingTextCol: {
    flex: 1,
  },
  notAcceptingDesc: {
    marginTop: 4,
    lineHeight: 18,
  },
  scheduleCard: {
    padding: spacing.md,
  },
  emptySchedule: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyScheduleText: {
    textAlign: 'center',
  },
  dateStripScroll: {
    marginBottom: spacing.md,
  },
  dateStripContent: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  datePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  datePillSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  datePillLabel: {
    marginBottom: 2,
  },
  slotCountLabel: {
    fontSize: 10,
  },
  slotsGridContainer: {
    paddingTop: spacing.xs,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  slotChip: {
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  noSlotsText: {
    fontStyle: 'italic',
    paddingVertical: spacing.md,
  },
  ctaContainer: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  bookingButton: {
    width: '100%',
  },
  backToDirectoryBtn: {
    marginTop: spacing.md,
  },
});
