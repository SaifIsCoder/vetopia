import React, { useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Star,
  Globe,
  Clock,
  AlertCircle,
  Calendar,
  Video,
  Phone,
  MessageSquare,
  CheckCircle2,
  Check,
  User,
  ShieldCheck,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { Chip } from '../../src/components/ui/Chip';
import { Input } from '../../src/components/ui/Input';
import { LoadingState } from '../../src/components/feedback/LoadingState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { useVet, useVetSchedule } from '../../src/hooks/useVets';
import { usePets } from '../../src/hooks/usePets';
import { useBookAppointment } from '../../src/hooks/useAppointments';
import { useAuthStore } from '../../src/store/authStore';
import { TimeSlot } from '../../src/types/vet';
import {
  AppointmentMode,
  AppointmentUrgency,
  BookingConfirmation,
  APPOINTMENT_MODES,
  APPOINTMENT_URGENCIES,
} from '../../src/types/appointment';
import { ConflictError } from '../../src/lib/api/errors';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

type BookingStep = 1 | 2 | 3 | 4 | 5;

export default function BookingScreen() {
  const { vetId } = useLocalSearchParams<{ vetId: string }>();
  const router = useRouter();

  // Multi-step state:
  // Step 1: Doctor Profile & Schedule (slot selection)
  // Step 2: Patient (Pet) & Consultation Format selection
  // Step 3: Clinical Intake (Symptoms, Urgency, Contact Phone)
  // Step 4: Summary Review & Confirm CTA
  // Step 5: Confirmed Receipt Screen
  const [step, setStep] = useState<BookingStep>(1);

  // Step 1 state
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Step 2 state
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<AppointmentMode>('video');

  // Step 3 state
  const [symptoms, setSymptoms] = useState('');
  const [urgency, setUrgency] = useState<AppointmentUrgency>('Medium');
  const [contactPhone, setContactPhone] = useState('');
  const [medications, setMedications] = useState('');

  // Step 5 state (Receipt)
  const [confirmationReceipt, setConfirmationReceipt] = useState<BookingConfirmation | null>(null);

  // Auth & Queries
  const { user, isAuthenticated } = useAuthStore();

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

  const { data: pets, isLoading: isPetsLoading } = usePets();

  // Booking Mutation
  const bookAppointmentMutation = useBookAppointment();

  // Selected day's slots
  const activeDay = useMemo(() => {
    if (!schedule || schedule.length === 0) return null;
    return schedule[selectedDateIndex] || schedule[0];
  }, [schedule, selectedDateIndex]);

  // Effective pet ID (auto-selects if user has only 1 pet registered)
  const activePetId = selectedPetId || (pets && pets.length === 1 ? pets[0].id : null);

  // Selected pet object
  const selectedPet = useMemo(() => {
    if (!pets || !activePetId) return null;
    return pets.find((p) => p.id === activePetId) || null;
  }, [pets, activePetId]);

  // Effective contact phone (defaults to user profile phone)
  const effectivePhone = contactPhone || user?.phone || '';

  // Step 1 -> Step 2
  const handleProceedFromSchedule = () => {
    if (!isAuthenticated) {
      Alert.alert(
        'Sign In Required',
        'You must be signed in as a pet parent to book an appointment.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign In', onPress: () => router.push('/(auth)/login') },
        ],
      );
      return;
    }
    if (!selectedSlot) {
      Alert.alert('Select a Slot', 'Please choose an available consultation time slot.');
      return;
    }
    setStep(2);
  };

  // Step 2 -> Step 3
  const handleProceedFromPetFormat = () => {
    if (!activePetId) {
      Alert.alert('Select a Pet', 'Please choose a registered pet for this consultation.');
      return;
    }
    setStep(3);
  };

  // Step 3 -> Step 4
  const handleProceedFromClinical = () => {
    if (!symptoms.trim() || symptoms.trim().length < 5) {
      Alert.alert(
        'Symptoms Required',
        'Please enter a brief description of your pet’s symptoms (minimum 5 characters).',
      );
      return;
    }
    if (!effectivePhone.trim() || effectivePhone.trim().length < 7) {
      Alert.alert(
        'Phone Number Required',
        'Please provide a valid contact phone number for consultation updates.',
      );
      return;
    }
    setStep(4);
  };

  // Step 4: Atomic Server-Side Reservation
  const handleConfirmBooking = async () => {
    if (!vet || !selectedSlot || !activePetId) return;

    try {
      const receipt = await bookAppointmentMutation.mutateAsync({
        vet_id: vet.id,
        pet_id: activePetId,
        starts_at: selectedSlot.startTime,
        mode: selectedMode,
        symptoms: symptoms.trim(),
        urgency,
        contact_phone: effectivePhone.trim(),
        medications: medications.trim() || undefined,
      });

      setConfirmationReceipt(receipt);
      setStep(5);
    } catch (err: any) {
      // Race condition: slot taken concurrently
      if (
        err instanceof ConflictError ||
        err.status === 409 ||
        err.message?.includes('Slot just taken')
      ) {
        Alert.alert('Slot Unavailable', 'Slot just taken. Please select another time.', [
          {
            text: 'Choose Another Time',
            onPress: () => {
              refetchSchedule();
              setSelectedSlot(null);
              setStep(1);
            },
          },
        ]);
        return;
      }

      // Other errors
      Alert.alert(
        'Booking Failed',
        err?.message || 'Unable to complete appointment reservation. Please try again.',
      );
    }
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

  // Render Step 5: Confirmed Receipt Screen
  if (step === 5 && confirmationReceipt) {
    return (
      <Screen scrollable style={styles.screen}>
        <View style={styles.receiptContainer}>
          <View style={styles.successIconWrapper}>
            <CheckCircle2 size={56} color={colors.primary} />
          </View>

          <Heading level={2} style={styles.receiptTitle}>
            Appointment Confirmed!
          </Heading>
          <Text variant="bodyMd" color={colors.inkSoft} style={styles.receiptSubtitle}>
            Your consultation has been atomically reserved.
          </Text>

          {/* Receipt Card */}
          <Card style={styles.receiptCard}>
            <View style={styles.receiptHeaderRow}>
              <View>
                <Text variant="caption" color={colors.muted}>
                  CONFIRMATION ID
                </Text>
                <Text variant="headingSm" color={colors.ink} style={styles.confirmationId}>
                  #{confirmationReceipt.appointment_id.substring(0, 8).toUpperCase()}
                </Text>
              </View>
              <Badge variant="verified" label="SCHEDULED" />
            </View>

            <View style={styles.receiptDivider} />

            <View style={styles.receiptRow}>
              <Text variant="bodySm" color={colors.inkSoft}>
                Doctor:
              </Text>
              <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                {confirmationReceipt.vet_name}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text variant="bodySm" color={colors.inkSoft}>
                Patient:
              </Text>
              <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                {confirmationReceipt.pet_name} ({confirmationReceipt.species})
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text variant="bodySm" color={colors.inkSoft}>
                Date & Time:
              </Text>
              <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                {new Date(confirmationReceipt.starts_at).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                at{' '}
                {new Date(confirmationReceipt.starts_at).toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text variant="bodySm" color={colors.inkSoft}>
                Format:
              </Text>
              <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                {confirmationReceipt.mode.toUpperCase()} Call
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text variant="bodySm" color={colors.inkSoft}>
                Duration:
              </Text>
              <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                {confirmationReceipt.duration_minutes || vet.slot_minutes || 30} minutes
              </Text>
            </View>

            <View style={styles.receiptRow}>
              <Text variant="bodySm" color={colors.inkSoft}>
                Consultation Fee:
              </Text>
              <Text variant="headingSm" color={colors.ink} style={styles.boldText}>
                ${Number(confirmationReceipt.price_usd || vet.price_usd || 29).toFixed(0)}
              </Text>
            </View>

            {confirmationReceipt.contact_phone ? (
              <View style={styles.receiptRow}>
                <Text variant="bodySm" color={colors.inkSoft}>
                  Contact Phone:
                </Text>
                <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                  {confirmationReceipt.contact_phone}
                </Text>
              </View>
            ) : null}
          </Card>

          <View style={styles.receiptActions}>
            <Button
              title="View in Appointments"
              variant="primary"
              onPress={() => router.replace('/(tabs)/appointments')}
              style={styles.actionBtn}
            />
            <Button
              title="Return to Directory"
              variant="outline"
              onPress={() => router.replace('/(tabs)/vets')}
              style={styles.actionBtn}
            />
          </View>
        </View>
      </Screen>
    );
  }

  // Render Step 4: Summary Review & Confirm
  if (step === 4) {
    return (
      <Screen scrollable style={styles.screen}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Clinical Details"
            onPress={() => setStep(3)}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Heading level={3} style={styles.topBarTitle}>
              Review Booking
            </Heading>
            <Text variant="caption" color={colors.muted}>
              Step 3 of 3 • Confirmation
            </Text>
          </View>
          <View style={styles.topBarSpacer} />
        </View>

        {/* Summary Card */}
        <Card style={styles.summaryCard}>
          <Heading level={3} style={styles.summaryTitle}>
            Consultation Summary
          </Heading>

          <View style={styles.summaryItem}>
            <Text variant="caption" color={colors.muted}>
              DOCTOR
            </Text>
            <Text variant="bodyMd" color={colors.ink} style={styles.boldText}>
              {vet.name}
            </Text>
            <Text variant="caption" color={colors.primaryDark}>
              {vet.specialty}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text variant="caption" color={colors.muted}>
              PATIENT
            </Text>
            <Text variant="bodyMd" color={colors.ink} style={styles.boldText}>
              {selectedPet?.name || 'Selected Pet'}
            </Text>
            <Text variant="caption" color={colors.inkSoft}>
              {selectedPet?.species} • {selectedPet?.breed || 'Unknown breed'}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text variant="caption" color={colors.muted}>
              DATE & TIME
            </Text>
            <Text variant="bodyMd" color={colors.ink} style={styles.boldText}>
              {selectedSlot
                ? new Date(selectedSlot.startTime).toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })
                : ''}
            </Text>
            <Text variant="caption" color={colors.inkSoft}>
              {selectedSlot?.formattedTime} ({vet.slot_minutes || 30} mins) •{' '}
              {vet.timezone || 'UTC'}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text variant="caption" color={colors.muted}>
              CONSULTATION FORMAT & URGENCY
            </Text>
            <View style={styles.badgeRow}>
              <Badge variant="scheduled" label={`${selectedMode.toUpperCase()} CALL`} />
              <Badge
                variant={urgency === 'High' ? 'cancelled' : 'scheduled'}
                label={`${urgency.toUpperCase()} URGENCY`}
              />
            </View>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text variant="caption" color={colors.muted}>
              REASON / SYMPTOMS
            </Text>
            <Text variant="bodySm" color={colors.inkSoft} style={styles.symptomsPreview}>
              {symptoms}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          <View style={styles.summaryItem}>
            <Text variant="caption" color={colors.muted}>
              CONTACT PHONE
            </Text>
            <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
              {effectivePhone}
            </Text>
          </View>

          <View style={styles.summaryDivider} />

          {/* Pricing Row */}
          <View style={styles.priceRowSummary}>
            <Text variant="headingSm" color={colors.ink}>
              Total Consultation Fee
            </Text>
            <Text variant="headingLg" color={colors.ink} style={styles.boldText}>
              ${Number(vet.price_usd || 29).toFixed(0)}
            </Text>
          </View>
        </Card>

        {/* Notice Card */}
        <Card style={styles.noticeCard}>
          <View style={styles.noticeRow}>
            <ShieldCheck size={20} color={colors.primaryDark} style={styles.noticeIcon} />
            <View style={styles.noticeTextCol}>
              <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                No Upfront Payment Required
              </Text>
              <Text variant="caption" color={colors.inkSoft} style={styles.noticeDesc}>
                Vetopia MVP appointment confirmation is not gated by upfront payment. Your slot will
                be atomically reserved upon confirmation.
              </Text>
              <Text variant="caption" color={colors.muted} style={styles.cancellationNotice}>
                • Free cancellation up to 2 hours prior to scheduled start.
              </Text>
            </View>
          </View>
        </Card>

        {/* Confirm CTA */}
        <View style={styles.ctaContainer}>
          <Button
            title="Confirm & Reserve Appointment"
            variant="primary"
            loading={bookAppointmentMutation.isPending}
            onPress={handleConfirmBooking}
            style={styles.bookingButton}
          />
        </View>
      </Screen>
    );
  }

  // Render Step 3: Clinical Intake Form
  if (step === 3) {
    return (
      <Screen scrollable style={styles.screen}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Pet and Format selection"
            onPress={() => setStep(2)}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Heading level={3} style={styles.topBarTitle}>
              Clinical Details
            </Heading>
            <Text variant="caption" color={colors.muted}>
              Step 2 of 3 • Intake Information
            </Text>
          </View>
          <View style={styles.topBarSpacer} />
        </View>

        {/* Form Container */}
        <View style={styles.sectionContainer}>
          <Input
            label="Symptoms or Reason for Visit *"
            placeholder="Describe symptoms, onset, behavioral changes..."
            value={symptoms}
            onChangeText={setSymptoms}
            multiline
            numberOfLines={4}
            style={styles.multilineInput}
            helperText="Please be descriptive to help the veterinarian prepare."
          />

          {/* Urgency Selector */}
          <View style={styles.fieldSection}>
            <Text variant="bodySm" color={colors.inkSoft} style={styles.fieldLabel}>
              Urgency Level *
            </Text>
            <View style={styles.urgencyOptions}>
              {APPOINTMENT_URGENCIES.map((item) => {
                const isSelected = urgency === item.value;
                return (
                  <Pressable
                    key={item.value}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${item.label} urgency`}
                    onPress={() => setUrgency(item.value)}
                    style={[styles.urgencyCard, isSelected && styles.urgencyCardSelected]}
                  >
                    <View style={styles.urgencyTopRow}>
                      <Text
                        variant="bodySm"
                        color={isSelected ? colors.ink : colors.inkSoft}
                        style={[styles.urgencyTitle, isSelected && styles.boldText]}
                      >
                        {item.label}
                      </Text>
                      {isSelected ? <Check size={16} color={colors.primaryDark} /> : null}
                    </View>
                    <Text variant="caption" color={colors.muted}>
                      {item.description}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Contact Phone */}
          <Input
            label="Contact Phone Number *"
            placeholder="+1 555-0199"
            value={effectivePhone}
            onChangeText={setContactPhone}
            keyboardType="phone-pad"
            helperText="Used for consultation reminders and connection updates."
          />

          {/* Medications (Optional) */}
          <Input
            label="Current Medications (Optional)"
            placeholder="E.g., Heartworm preventive, insulin..."
            value={medications}
            onChangeText={setMedications}
          />
        </View>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <Button
            title="Review Booking Summary"
            variant="primary"
            onPress={handleProceedFromClinical}
            style={styles.bookingButton}
          />
        </View>
      </Screen>
    );
  }

  // Render Step 2: Patient (Pet) & Format Selection
  if (step === 2) {
    return (
      <Screen scrollable style={styles.screen}>
        {/* Top Bar */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Schedule"
            onPress={() => setStep(1)}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>
          <View style={styles.topBarCenter}>
            <Heading level={3} style={styles.topBarTitle}>
              Pet & Format
            </Heading>
            <Text variant="caption" color={colors.muted}>
              Step 1 of 3 • Patient Setup
            </Text>
          </View>
          <View style={styles.topBarSpacer} />
        </View>

        {/* Slot Preview Banner */}
        <Card style={styles.slotBannerCard}>
          <View style={styles.slotBannerRow}>
            <Clock size={18} color={colors.primaryDark} />
            <Text variant="bodySm" color={colors.ink} style={styles.slotBannerText}>
              {selectedSlot
                ? `${new Date(selectedSlot.startTime).toLocaleDateString(undefined, {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })} at ${selectedSlot.formattedTime}`
                : ''}
            </Text>
            <Text variant="caption" color={colors.muted}>
              ({vet.slot_minutes || 30}m)
            </Text>
          </View>
        </Card>

        {/* Pet Selection Section */}
        <View style={styles.sectionContainer}>
          <Heading level={3} style={styles.sectionHeading}>
            Select Pet for Consultation *
          </Heading>

          {isPetsLoading ? (
            <LoadingState message="Loading your pets..." />
          ) : !pets || pets.length === 0 ? (
            <Card style={styles.noPetsCard}>
              <AlertCircle size={28} color={colors.muted} />
              <Text variant="bodyMd" color={colors.ink} style={styles.noPetsTitle}>
                No Registered Pets Found
              </Text>
              <Text variant="bodySm" color={colors.inkSoft} style={styles.noPetsDesc}>
                You must register at least one pet before booking an appointment.
              </Text>
              <Button
                title="Register a Pet"
                variant="primary"
                onPress={() => router.push('/pets/add')}
                style={styles.addPetBtn}
              />
            </Card>
          ) : (
            <View style={styles.petsList}>
              {pets.map((pet) => {
                const isSelected = activePetId === pet.id;
                return (
                  <Pressable
                    key={pet.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Select pet ${pet.name}`}
                    onPress={() => setSelectedPetId(pet.id)}
                    style={[styles.petCard, isSelected && styles.petCardSelected]}
                  >
                    <View style={styles.petCardLeft}>
                      <View style={styles.petIconWrapper}>
                        <User size={20} color={isSelected ? colors.primaryDark : colors.muted} />
                      </View>
                      <View>
                        <Text variant="headingSm" color={colors.ink}>
                          {pet.name}
                        </Text>
                        <Text variant="caption" color={colors.inkSoft}>
                          {pet.species} • {pet.breed || 'Breed not specified'}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
                      {isSelected ? <View style={styles.radioInnerDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Consultation Format Section */}
        <View style={styles.sectionContainer}>
          <Heading level={3} style={styles.sectionHeading}>
            Consultation Format *
          </Heading>
          <View style={styles.formatOptions}>
            {APPOINTMENT_MODES.map((mode) => {
              const isSelected = selectedMode === mode.value;
              const IconComponent =
                mode.value === 'video' ? Video : mode.value === 'audio' ? Phone : MessageSquare;

              return (
                <Pressable
                  key={mode.value}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${mode.label}`}
                  onPress={() => setSelectedMode(mode.value)}
                  style={[styles.formatCard, isSelected && styles.formatCardSelected]}
                >
                  <View style={styles.formatIconRow}>
                    <IconComponent
                      size={22}
                      color={isSelected ? colors.primaryDark : colors.inkSoft}
                    />
                    <Text
                      variant="bodySm"
                      color={isSelected ? colors.ink : colors.inkSoft}
                      style={[styles.formatTitle, isSelected && styles.boldText]}
                    >
                      {mode.label}
                    </Text>
                  </View>
                  {isSelected ? <Check size={18} color={colors.primaryDark} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaContainer}>
          <Button
            title="Continue to Clinical Intake"
            variant="primary"
            disabled={!activePetId}
            onPress={handleProceedFromPetFormat}
            style={styles.bookingButton}
          />
        </View>
      </Screen>
    );
  }

  // Render Step 1: Doctor Profile & Schedule (Default)
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

      {/* Booking Action CTA */}
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
            onPress={handleProceedFromSchedule}
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
  topBarCenter: {
    alignItems: 'center',
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
    marginBottom: spacing.sm,
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

  // Step 2 & 3 styles
  slotBannerCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  slotBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  slotBannerText: {
    fontWeight: '600',
  },
  noPetsCard: {
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  noPetsTitle: {
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  noPetsDesc: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  addPetBtn: {
    width: 200,
  },
  petsList: {
    gap: spacing.xs,
  },
  petCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  petCardSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: '#F0FDFA',
  },
  petCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  petIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: radii.pill,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: colors.primaryDark,
  },
  radioInnerDot: {
    width: 10,
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.primaryDark,
  },
  formatOptions: {
    gap: spacing.xs,
  },
  formatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  formatCardSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: '#F0FDFA',
  },
  formatIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  formatTitle: {
    fontWeight: '600',
  },
  multilineInput: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  fieldSection: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  urgencyOptions: {
    gap: spacing.xs,
  },
  urgencyCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  urgencyCardSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: '#F0FDFA',
  },
  urgencyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  urgencyTitle: {
    fontWeight: '600',
  },

  // Step 4 Review styles
  summaryCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTitle: {
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  summaryItem: {
    paddingVertical: spacing.xs,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  symptomsPreview: {
    marginTop: 4,
    lineHeight: 18,
  },
  priceRowSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
  },
  noticeCard: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  noticeIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  noticeTextCol: {
    flex: 1,
  },
  noticeDesc: {
    marginTop: 2,
    lineHeight: 16,
  },
  cancellationNotice: {
    marginTop: 4,
    fontWeight: '500',
  },

  // Step 5 Receipt styles
  receiptContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  successIconWrapper: {
    width: 80,
    height: 80,
    borderRadius: radii.pill,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  receiptTitle: {
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  receiptSubtitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  receiptCard: {
    width: '100%',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  receiptHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  confirmationId: {
    fontWeight: '800',
    marginTop: 2,
  },
  receiptDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  receiptActions: {
    width: '100%',
    gap: spacing.sm,
  },
  actionBtn: {
    width: '100%',
  },
});
