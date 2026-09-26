import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pill, Plus, AlertCircle, Calendar, User, CheckCircle2 } from 'lucide-react-native';
import { Screen } from '../../../src/components/layout/Screen';
import { Heading } from '../../../src/components/ui/Heading';
import { Text } from '../../../src/components/ui/Text';
import { Card } from '../../../src/components/ui/Card';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Badge } from '../../../src/components/ui/Badge';
import { EmptyState } from '../../../src/components/feedback/EmptyState';
import { MedicationFormModal } from '../../../src/components/prescriptions/MedicationFormModal';
import { MedicationItemRow } from '../../../src/components/prescriptions/MedicationItemRow';
import { useAppointment } from '../../../src/hooks/useAppointments';
import {
  useCreatePrescription,
  useAppointmentPrescription,
} from '../../../src/hooks/usePrescriptions';
import { useAuthStore } from '../../../src/store/authStore';
import { CreatePrescriptionItemDTO } from '../../../src/types/prescription';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';

export default function CreatePrescriptionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, role } = useAuthStore();
  const isVet = user?.isVet === true || role === 'vet';

  const appointmentId = id || '';
  const {
    data: appointment,
    isLoading: loadingAppt,
    isError: errorAppt,
  } = useAppointment(appointmentId);
  const { data: existingPrescription, isLoading: loadingPrescription } =
    useAppointmentPrescription(appointmentId);
  const createMutation = useCreatePrescription();

  // Form State
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [refillsAllowed, setRefillsAllowed] = useState('0');
  const [medications, setMedications] = useState<CreatePrescriptionItemDTO[]>([]);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Validation Errors
  const [diagnosisError, setDiagnosisError] = useState<string | null>(null);
  const [medicationError, setMedicationError] = useState<string | null>(null);

  // Loading State
  if (loadingAppt || loadingPrescription) {
    return (
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
        <Text variant="bodySm" color={colors.inkSoft} style={styles.loadingText}>
          Loading consultation context...
        </Text>
      </Screen>
    );
  }

  // Appointment Error / Missing
  if (errorAppt || !appointment) {
    return (
      <Screen style={styles.container}>
        <EmptyState
          title="Consultation Not Found"
          description="Could not load the consultation record for this prescription."
          icon={<AlertCircle size={48} color={colors.destructive} />}
        />
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="outline"
          style={styles.backBtn}
        />
      </Screen>
    );
  }

  // RBAC Guard: Only Veterinarian can create prescriptions
  if (!isVet) {
    return (
      <Screen style={styles.container}>
        <EmptyState
          title="Access Restricted"
          description="Only licensed veterinarians may create and issue digital prescriptions."
          icon={<AlertCircle size={48} color={colors.destructive} />}
        />
        <Button
          title="Go Back"
          onPress={() => router.back()}
          variant="outline"
          style={styles.backBtn}
        />
      </Screen>
    );
  }

  // Precondition: Appointment MUST be completed
  if (appointment.status !== 'completed') {
    return (
      <Screen style={styles.container}>
        <EmptyState
          title="Appointment Incomplete"
          description={`Prescriptions can only be issued for completed consultations. Current status: ${appointment.status.toUpperCase()}.`}
          icon={<AlertCircle size={48} color={colors.warning} />}
        />
        <Button
          title="Return to Consult Room"
          onPress={() => router.replace(`/consult/${appointmentId}`)}
          variant="primary"
          style={styles.actionBtn}
        />
        <Button
          title="Back to Appointments"
          onPress={() => router.replace('/(tabs)/appointments')}
          variant="outline"
        />
      </Screen>
    );
  }

  // Duplicate Check: Already has prescription
  if (existingPrescription) {
    return (
      <Screen style={styles.container}>
        <EmptyState
          title="Prescription Already Issued"
          description="A digital prescription has already been created for this completed consultation."
          icon={<CheckCircle2 size={48} color={colors.primaryDark} />}
        />
        <Button
          title="View Existing Prescription"
          onPress={() => router.replace(`/prescriptions/${existingPrescription.id}`)}
          variant="primary"
          style={styles.actionBtn}
        />
        <Button
          title="Back to Appointments"
          onPress={() => router.replace('/(tabs)/appointments')}
          variant="outline"
        />
      </Screen>
    );
  }

  // Handlers for medications
  const handleOpenAdd = () => {
    setEditingIndex(null);
    setIsModalOpen(true);
  };

  const handleEditMedication = (index: number) => {
    setEditingIndex(index);
    setIsModalOpen(true);
  };

  const handleSaveMedication = (item: CreatePrescriptionItemDTO) => {
    if (editingIndex !== null) {
      const updated = [...medications];
      updated[editingIndex] = item;
      setMedications(updated);
    } else {
      setMedications([...medications, item]);
    }
    setMedicationError(null);
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  // Submit Handler
  const handleSubmit = async () => {
    // Validate diagnosis
    let valid = true;
    if (!diagnosis.trim()) {
      setDiagnosisError('Diagnosis is required.');
      valid = false;
    } else if (diagnosis.trim().length < 3) {
      setDiagnosisError('Diagnosis must be at least 3 characters.');
      valid = false;
    } else {
      setDiagnosisError(null);
    }

    // Validate medications
    if (medications.length === 0) {
      setMedicationError('At least one medication is required.');
      valid = false;
    } else {
      setMedicationError(null);
    }

    if (!valid) {
      return;
    }

    const refills = parseInt(refillsAllowed, 10);
    const parsedRefills = isNaN(refills) || refills < 0 ? 0 : refills;

    try {
      const response = await createMutation.mutateAsync({
        appointment_id: appointmentId,
        diagnosis: diagnosis.trim(),
        notes: notes.trim() || undefined,
        refills_allowed: parsedRefills,
        items: medications,
      });

      Alert.alert(
        'Prescription Issued',
        'Digital prescription created successfully and available for download.',
        [
          {
            text: 'View Prescription',
            onPress: () => router.replace(`/prescriptions/${response.prescription_id}`),
          },
        ],
      );
    } catch (err: any) {
      Alert.alert(
        'Prescription Creation Failed',
        err?.message ||
          'Could not issue digital prescription. Please verify the clinical details and try again.',
      );
    }
  };

  const formattedDate = new Date(appointment.starts_at).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <Heading level={2}>Create Prescription</Heading>
          <Text variant="bodySm" color={colors.inkSoft}>
            Issue an authoritative digital prescription for this completed consultation.
          </Text>
        </View>

        {/* Consultation Context Banner */}
        <Card style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <View style={styles.iconCircle}>
              <Pill size={18} color={colors.primaryDark} />
            </View>
            <View style={styles.contextInfo}>
              <Text variant="headingSm" color={colors.ink}>
                Patient: {appointment.pet_name || 'Pet'}{' '}
                {appointment.species ? `(${appointment.species})` : ''}
              </Text>
              <View style={styles.metaRow}>
                <Calendar size={12} color={colors.inkSoft} />
                <Text variant="caption" color={colors.inkSoft}>
                  {formattedDate}
                </Text>
                <Text variant="caption" color={colors.inkSoft}>
                  •
                </Text>
                <User size={12} color={colors.inkSoft} />
                <Text variant="caption" color={colors.inkSoft}>
                  {appointment.vet?.name || 'Dr. Veterinarian'}
                </Text>
              </View>
            </View>
            <Badge variant="completed" label="COMPLETED" />
          </View>
        </Card>

        {/* Clinical Form */}
        <View style={styles.section}>
          <Heading level={3} style={styles.sectionTitle}>
            Clinical Assessment
          </Heading>

          <Input
            label="Primary Diagnosis *"
            placeholder="e.g., Canine Otitis Externa, Feline Upper Respiratory Infection"
            value={diagnosis}
            onChangeText={(text) => {
              setDiagnosis(text);
              if (diagnosisError) setDiagnosisError(null);
            }}
            error={diagnosisError || undefined}
          />

          <Input
            label="Clinical Instructions / Notes"
            placeholder="Additional advice for pet parent, follow-up timelines, wound care..."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={3}
            style={styles.textArea}
          />

          <Input
            label="Refills Allowed"
            placeholder="0"
            value={refillsAllowed}
            onChangeText={setRefillsAllowed}
            keyboardType="number-pad"
            helperText="Number of allowable prescription refills (0 for single-course prescriptions)"
          />
        </View>

        {/* Medication List Section */}
        <View style={styles.section}>
          <View style={styles.medicationHeader}>
            <View>
              <Heading level={3}>Prescribed Medications *</Heading>
              <Text variant="caption" color={colors.inkSoft}>
                At least one medication is required (no controlled substances).
              </Text>
            </View>
            <Button
              title="Add Drug"
              onPress={handleOpenAdd}
              variant="outline"
              size="sm"
              leftIcon={<Plus size={16} color={colors.primaryDark} />}
            />
          </View>

          {medicationError ? (
            <View style={styles.errorBox}>
              <AlertCircle size={14} color={colors.destructive} />
              <Text variant="caption" color={colors.destructive}>
                {medicationError}
              </Text>
            </View>
          ) : null}

          {medications.length === 0 ? (
            <Card style={styles.emptyMedCard}>
              <Pill size={32} color={colors.muted} />
              <Text variant="bodySm" color={colors.inkSoft} style={styles.emptyMedText}>
                {
                  'No medications added yet. Tap "Add Drug" to include medication, dosage, and frequency.'
                }
              </Text>
            </Card>
          ) : (
            medications.map((item, index) => (
              <MedicationItemRow
                key={`${item.medication_name}-${index}`}
                item={item}
                index={index}
                isEditable={true}
                onEdit={() => handleEditMedication(index)}
                onRemove={() => handleRemoveMedication(index)}
              />
            ))
          )}
        </View>

        {/* Regulatory Notice */}
        <Card style={styles.noticeCard}>
          <Text variant="caption" color={colors.inkSoft} style={styles.noticeText}>
            Veterinary Prescription Notice: In accordance with veterinary regulations, controlled
            substances (Schedules II–V) cannot be prescribed via digital telemedicine consultations.
          </Text>
        </Card>

        {/* Actions */}
        <View style={styles.actionRow}>
          <Button
            title={
              createMutation.isPending ? 'Issuing Prescription...' : 'Issue Digital Prescription'
            }
            onPress={handleSubmit}
            variant="primary"
            disabled={createMutation.isPending}
            loading={createMutation.isPending}
            style={styles.submitBtn}
          />
          <Button
            title="Cancel"
            onPress={() => router.back()}
            variant="ghost"
            disabled={createMutation.isPending}
          />
        </View>
      </ScrollView>

      {/* Medication Entry Modal */}
      <MedicationFormModal
        visible={isModalOpen}
        initialItem={editingIndex !== null ? medications[editingIndex] : undefined}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMedication}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  scrollContent: {
    paddingBottom: spacing['2xl'],
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
  },
  header: {
    marginBottom: spacing.md,
  },
  contextCard: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    marginBottom: spacing.lg,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contextInfo: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 80,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
    padding: spacing.xs,
  },
  emptyMedCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  emptyMedText: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  noticeCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    marginBottom: spacing.lg,
  },
  noticeText: {
    fontStyle: 'italic',
    lineHeight: 18,
  },
  actionRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  submitBtn: {
    width: '100%',
  },
  actionBtn: {
    marginBottom: spacing.sm,
  },
  backBtn: {
    marginTop: spacing.md,
  },
});
