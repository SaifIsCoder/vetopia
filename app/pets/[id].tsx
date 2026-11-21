import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  PawPrint,
  Weight,
  Calendar,
  Heart,
  FileText,
  AlertCircle,
  ShieldCheck,
  Pill,
  Syringe,
  WifiOff,
  Plus,
  Stethoscope,
  X,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { Input } from '../../src/components/ui/Input';
import { PrescriptionCard } from '../../src/components/prescriptions/PrescriptionCard';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import {
  usePetPassport,
  useDeletePet,
  useCreateVaccination,
  useDeleteVaccination,
} from '../../src/hooks/usePets';
import { petPassportCache } from '../../src/lib/pets/petPassportCache';
import { PetVaccination } from '../../src/types/pet';
import { Appointment } from '../../src/types/appointment';

export default function PetPassportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    data: passport,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = usePetPassport(id || '');

  const pet = passport?.pet;
  const vaccinations = passport?.vaccinations || [];
  const prescriptions = passport?.prescriptions || [];
  const consultations = passport?.consultations || [];
  const isOffline = passport?.isOffline || false;
  const cachedAt = passport?.cachedAt;

  const deletePetMutation = useDeletePet();
  const createVaccinationMutation = useCreateVaccination();
  const deleteVaccinationMutation = useDeleteVaccination(id || '');

  const [isDeleting, setIsDeleting] = useState(false);

  // Add Vaccination Modal State
  const [isAddVaccineModalOpen, setIsAddVaccineModalOpen] = useState(false);
  const [vacName, setVacName] = useState('');
  const [vacAdministeredAt, setVacAdministeredAt] = useState(
    new Date().toISOString().split('T')[0],
  );
  const [vacNextDueAt, setVacNextDueAt] = useState('');
  const [vacBatchNumber, setVacBatchNumber] = useState('');
  const [vacAdministeredBy, setVacAdministeredBy] = useState('');
  const [vacNotes, setVacNotes] = useState('');
  const [vacFormError, setVacFormError] = useState<string | null>(null);

  const confirmDelete = () => {
    Alert.alert(
      'Delete Pet Profile',
      `Are you sure you want to remove ${pet?.name || 'this pet'} from your passport? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setIsDeleting(true);
            try {
              await deletePetMutation.mutateAsync(id);
              router.replace('/(tabs)/care');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete pet.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const handleOpenAddVaccine = () => {
    setVacName('');
    setVacAdministeredAt(new Date().toISOString().split('T')[0]);
    setVacNextDueAt('');
    setVacBatchNumber('');
    setVacAdministeredBy('');
    setVacNotes('');
    setVacFormError(null);
    setIsAddVaccineModalOpen(true);
  };

  const handleSaveVaccine = async () => {
    if (!id) return;
    if (!vacName.trim()) {
      setVacFormError('Vaccine name is required.');
      return;
    }
    if (!vacAdministeredAt.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(vacAdministeredAt.trim())) {
      setVacFormError('Administered date must be YYYY-MM-DD.');
      return;
    }
    if (vacNextDueAt.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(vacNextDueAt.trim())) {
        setVacFormError('Next due date must be YYYY-MM-DD.');
        return;
      }
      if (new Date(vacNextDueAt.trim()) <= new Date(vacAdministeredAt.trim())) {
        setVacFormError('Next due date must be after administered date.');
        return;
      }
    }

    try {
      setVacFormError(null);
      await createVaccinationMutation.mutateAsync({
        pet_id: id,
        vaccine_name: vacName.trim(),
        administered_at: vacAdministeredAt.trim(),
        next_due_at: vacNextDueAt.trim() || null,
        batch_number: vacBatchNumber.trim() || null,
        administered_by: vacAdministeredBy.trim() || null,
        notes: vacNotes.trim() || null,
      });
      setIsAddVaccineModalOpen(false);
    } catch (err: any) {
      setVacFormError(err?.message || 'Failed to save vaccination.');
    }
  };

  const confirmDeleteVaccine = (vac: PetVaccination) => {
    Alert.alert(
      'Remove Vaccination',
      `Delete ${vac.vaccine_name} from ${pet?.name || 'pet'}'s health passport?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteVaccinationMutation.mutateAsync(vac.id);
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete vaccination.');
            }
          },
        },
      ],
    );
  };

  if (isLoading && !passport) {
    return (
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
        <Text variant="bodyMd" color={colors.muted} style={styles.loadingText}>
          Loading pet health passport...
        </Text>
      </Screen>
    );
  }

  if ((error && !passport) || !pet) {
    return (
      <Screen style={styles.centerContainer}>
        <AlertCircle size={48} color={colors.destructive} />
        <Heading level={2} style={styles.errorTitle}>
          Pet Not Found
        </Heading>
        <Text variant="bodyMd" color={colors.muted} style={styles.errorSubtitle}>
          {error?.message ||
            'This pet profile could not be loaded or you do not have permission to view it.'}
        </Text>
        <Button title="Back to Care Hub" onPress={() => router.back()} variant="outline" />
      </Screen>
    );
  }

  const formatSex = (sex?: string | null): string => {
    if (!sex) return 'Unknown';
    if (sex === 'neutered_male') return 'Neutered Male';
    if (sex === 'spayed_female') return 'Spayed Female';
    if (sex === 'male') return 'Male';
    if (sex === 'female') return 'Female';
    return sex;
  };

  const getVaccineStatusBadge = (nextDueAt?: string | null) => {
    if (!nextDueAt) return null;
    const dueDate = new Date(nextDueAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <Badge variant="cancelled" label={`Overdue: ${nextDueAt}`} />;
    } else if (diffDays <= 30) {
      return <Badge variant="pending" label={`Due Soon: ${nextDueAt}`} />;
    }
    return <Badge variant="completed" label={`Next: ${nextDueAt}`} />;
  };

  return (
    <Screen style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={colors.primaryDark}
            colors={[colors.primaryDark]}
          />
        }
      >
        {/* Top Navigation Bar */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.iconButton}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={22} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/pets/edit', params: { id: pet.id } })}
              style={styles.iconButton}
              accessibilityLabel="Edit pet details"
              accessibilityRole="button"
            >
              <Edit2 size={20} color={colors.ink} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmDelete}
              style={[styles.iconButton, styles.deleteIconButton]}
              accessibilityLabel="Delete pet"
              accessibilityRole="button"
              disabled={isDeleting}
            >
              <Trash2 size={20} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Offline Cache Indicator Banner (NFR-REL-002) */}
        {isOffline && (
          <Card style={styles.offlineBanner}>
            <View style={styles.offlineRow}>
              <WifiOff size={22} color="#B45309" style={{ marginTop: 2 }} />
              <View style={styles.offlineTextWrap}>
                <Text variant="bodySm" color="#92400E" style={{ fontWeight: '700' }}>
                  Offline Mode — Cached Health Passport
                </Text>
                <Text variant="caption" color="#B45309" style={{ marginTop: 2 }}>
                  {cachedAt
                    ? `Viewing records cached on ${petPassportCache.formatLastUpdated(cachedAt)}. Reconnection required to update records.`
                    : 'Showing locally cached health passport records.'}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Hero Profile Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Avatar name={pet.name} source={pet.photo_url} size={88} style={styles.avatarBorder} />
            <Heading level={1} style={styles.petName}>
              {pet.name}
            </Heading>
            <Text variant="bodyMd" color={colors.inkSoft} style={styles.speciesText}>
              {pet.species} {pet.breed ? `• ${pet.breed}` : ''}
            </Text>

            <View style={styles.badgeRow}>
              <Badge variant="verified" label="Digital Health Passport" />
            </View>
          </View>
        </Card>

        {/* Clinical Metrics & Biometrics Grid */}
        <View style={styles.section}>
          <Heading level={3} style={styles.sectionTitle}>
            Biometrics & Identification
          </Heading>

          <View style={styles.metricsGrid}>
            <Card style={styles.metricCard}>
              <Weight size={20} color={colors.primaryDark} style={styles.metricIcon} />
              <Text variant="caption" color={colors.muted}>
                WEIGHT
              </Text>
              <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
                {pet.weight_kg ? `${pet.weight_kg} kg` : 'Not recorded'}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Calendar size={20} color={colors.primaryDark} style={styles.metricIcon} />
              <Text variant="caption" color={colors.muted}>
                AGE / DOB
              </Text>
              <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
                {pet.age || pet.dob || 'Not recorded'}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <Heart size={20} color={colors.primaryDark} style={styles.metricIcon} />
              <Text variant="caption" color={colors.muted}>
                SEX
              </Text>
              <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
                {formatSex(pet.sex)}
              </Text>
            </Card>

            <Card style={styles.metricCard}>
              <PawPrint size={20} color={colors.primaryDark} style={styles.metricIcon} />
              <Text variant="caption" color={colors.muted}>
                COLOR / COAT
              </Text>
              <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
                {pet.color || 'Not specified'}
              </Text>
            </Card>
          </View>
        </View>

        {/* Bio, Allergies & Clinical Notes */}
        <View style={styles.section}>
          <Heading level={3} style={styles.sectionTitle}>
            Clinical Notes & Allergies
          </Heading>

          <Card style={styles.bioCard}>
            <View style={styles.bioHeader}>
              <FileText size={18} color={colors.inkSoft} style={{ marginRight: spacing.xs }} />
              <Text variant="bodySm" color={colors.ink} style={{ fontWeight: '600' }}>
                Known Conditions & Behavioral Notes
              </Text>
            </View>
            <Text variant="bodyMd" color={colors.inkSoft} style={styles.bioText}>
              {pet.bio || 'No medical conditions, allergies, or notes recorded for this pet yet.'}
            </Text>
          </Card>
        </View>

        {/* Vaccination History (FR-PET-002, NFR-REL-002) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <Heading level={3} style={styles.sectionTitle}>
                Vaccination History
              </Heading>
              {vaccinations.length > 0 && (
                <Badge variant="verified" label={`${vaccinations.length} Recorded`} />
              )}
            </View>

            <Button
              title="Add Vaccine"
              size="sm"
              variant="outline"
              leftIcon={<Plus size={14} color={colors.ink} />}
              onPress={handleOpenAddVaccine}
              disabled={isOffline}
              accessibilityLabel="Add new vaccination record"
            />
          </View>

          {vaccinations.length > 0 ? (
            vaccinations.map((vac) => (
              <Card key={vac.id} style={styles.vaccineCard}>
                <View style={styles.vaccineHeader}>
                  <View style={styles.vaccineInfo}>
                    <View style={styles.vaccineNameRow}>
                      <Syringe size={16} color={colors.primaryDark} style={{ marginRight: 6 }} />
                      <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                        {vac.vaccine_name}
                      </Text>
                    </View>
                    <Text variant="caption" color={colors.inkSoft} style={{ marginTop: 2 }}>
                      Administered on {vac.administered_at}
                    </Text>
                  </View>

                  <View style={styles.vaccineActions}>
                    {getVaccineStatusBadge(vac.next_due_at)}
                    <TouchableOpacity
                      onPress={() => confirmDeleteVaccine(vac)}
                      style={styles.vacDeleteBtn}
                      accessibilityLabel={`Delete ${vac.vaccine_name}`}
                      accessibilityRole="button"
                      disabled={isOffline}
                    >
                      <Trash2 size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>

                {(vac.administered_by || vac.batch_number) && (
                  <View style={styles.vaccineMetaRow}>
                    {vac.administered_by && (
                      <Text variant="caption" color={colors.inkSoft}>
                        Clinic/Vet: {vac.administered_by}
                      </Text>
                    )}
                    {vac.batch_number && (
                      <Text variant="caption" color={colors.muted}>
                        Lot #{vac.batch_number}
                      </Text>
                    )}
                  </View>
                )}

                {vac.notes && (
                  <Text variant="caption" color={colors.inkSoft} style={styles.vaccineNotes}>
                    Notes: {vac.notes}
                  </Text>
                )}
              </Card>
            ))
          ) : (
            <Card style={styles.emptyPrescriptionCard}>
              <Syringe size={24} color={colors.muted} />
              <Text variant="caption" color={colors.inkSoft} style={{ marginTop: 6 }}>
                No vaccination records logged yet for {pet.name}.
              </Text>
            </Card>
          )}
        </View>

        {/* Telemedicine Consultations & Clinical History */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <Heading level={3} style={styles.sectionTitle}>
                Consultation Records
              </Heading>
              {consultations.length > 0 && (
                <Badge variant="completed" label={`${consultations.length} Visits`} />
              )}
            </View>
          </View>

          {consultations.length > 0 ? (
            consultations.map((c: Appointment) => (
              <Card key={c.id} style={styles.consultCard}>
                <View style={styles.consultHeader}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
                      {c.vet?.name || 'Veterinarian Consultation'}
                    </Text>
                    <Text variant="caption" color={colors.inkSoft}>
                      {c.vet?.specialty || 'General Practice'} • {new Date(c.starts_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                  </View>
                  <Badge
                    variant={c.status === 'completed' ? 'completed' : 'pending'}
                    label={c.status.toUpperCase()}
                  />
                </View>

                {c.symptoms && (
                  <View style={styles.consultSymptomsRow}>
                    <Text variant="caption" color={colors.ink} style={{ fontWeight: '600' }}>
                      Presented Symptoms:
                    </Text>
                    <Text variant="caption" color={colors.inkSoft} style={{ marginTop: 2 }}>
                      {c.symptoms}
                    </Text>
                  </View>
                )}
              </Card>
            ))
          ) : (
            <Card style={styles.emptyPrescriptionCard}>
              <Stethoscope size={24} color={colors.muted} />
              <Text variant="caption" color={colors.inkSoft} style={{ marginTop: 6 }}>
                No telemedicine consultation notes recorded yet for {pet.name}.
              </Text>
            </Card>
          )}
        </View>

        {/* Digital Prescriptions History (FR-PRES-002) */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleWrap}>
              <Heading level={3} style={styles.sectionTitle}>
                Digital Prescriptions
              </Heading>
              {prescriptions.length > 0 && (
                <Badge variant="completed" label={`${prescriptions.length} Active`} />
              )}
            </View>
          </View>

          {prescriptions.length > 0 ? (
            prescriptions.map((rx) => <PrescriptionCard key={rx.id} prescription={rx} />)
          ) : (
            <Card style={styles.emptyPrescriptionCard}>
              <Pill size={24} color={colors.muted} />
              <Text variant="caption" color={colors.inkSoft} style={{ marginTop: 6 }}>
                No digital prescriptions issued for {pet.name} yet.
              </Text>
            </Card>
          )}
        </View>

        {/* Passport Verification Guarantee */}
        <Card style={styles.guaranteeCard}>
          <View style={styles.guaranteeRow}>
            <ShieldCheck size={24} color={colors.primaryDark} style={styles.guaranteeIcon} />
            <View style={styles.guaranteeText}>
              <Text variant="bodySm" color={colors.ink} style={{ fontWeight: '700' }}>
                Owner-Verified Security & Offline Availability
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                This digital passport is securely cached for offline access and protected by
                PostgreSQL Row Level Security. Only you and authorized consulting veterinarians have
                access to clinical records.
              </Text>
            </View>
          </View>
        </Card>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <Button
            title="Edit Details"
            onPress={() => router.push({ pathname: '/pets/edit', params: { id: pet.id } })}
            variant="outline"
            leftIcon={<Edit2 size={16} color={colors.ink} />}
            disabled={isOffline}
          />
          <Button
            title={isDeleting ? 'Deleting...' : 'Delete Pet Profile'}
            onPress={confirmDelete}
            variant="destructive"
            disabled={isDeleting || isOffline}
            leftIcon={<Trash2 size={16} color={colors.cream} />}
          />
        </View>
      </ScrollView>

      {/* Modal: Add Vaccination Record */}
      <Modal
        visible={isAddVaccineModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAddVaccineModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Heading level={3}>Add Vaccination Record</Heading>
              <TouchableOpacity
                onPress={() => setIsAddVaccineModalOpen(false)}
                style={styles.modalCloseBtn}
                accessibilityLabel="Close add vaccination modal"
                accessibilityRole="button"
              >
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {vacFormError && (
                <View style={styles.errorBox}>
                  <AlertCircle size={14} color={colors.destructive} />
                  <Text variant="caption" color={colors.destructive} style={{ marginLeft: 6 }}>
                    {vacFormError}
                  </Text>
                </View>
              )}

              <Text variant="caption" color={colors.ink} style={styles.inputLabel}>
                VACCINE NAME *
              </Text>
              <Input
                placeholder="e.g. Rabies 3-Year, DHPP, Bordetella"
                value={vacName}
                onChangeText={setVacName}
              />

              <Text variant="caption" color={colors.ink} style={styles.inputLabel}>
                ADMINISTERED DATE (YYYY-MM-DD) *
              </Text>
              <Input
                placeholder="2026-10-24"
                value={vacAdministeredAt}
                onChangeText={setVacAdministeredAt}
              />

              <Text variant="caption" color={colors.ink} style={styles.inputLabel}>
                NEXT DUE DATE (YYYY-MM-DD)
              </Text>
              <Input
                placeholder="2027-10-24"
                value={vacNextDueAt}
                onChangeText={setVacNextDueAt}
              />

              <Text variant="caption" color={colors.ink} style={styles.inputLabel}>
                ADMINISTERED BY / CLINIC
              </Text>
              <Input
                placeholder="e.g. City Vet Care Clinic, Dr. Sarah"
                value={vacAdministeredBy}
                onChangeText={setVacAdministeredBy}
              />

              <Text variant="caption" color={colors.ink} style={styles.inputLabel}>
                LOT / BATCH NUMBER
              </Text>
              <Input
                placeholder="e.g. LOT-84920B"
                value={vacBatchNumber}
                onChangeText={setVacBatchNumber}
              />

              <Text variant="caption" color={colors.ink} style={styles.inputLabel}>
                CLINICAL NOTES
              </Text>
              <Input
                placeholder="Dosage notes, reaction observation, etc."
                value={vacNotes}
                onChangeText={setVacNotes}
                multiline
                numberOfLines={3}
                style={styles.textArea}
              />

              <View style={styles.modalFooter}>
                <Button
                  title="Save Vaccination"
                  onPress={handleSaveVaccine}
                  loading={createVaccinationMutation.isPending}
                  disabled={createVaccinationMutation.isPending}
                  variant="primary"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  errorTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  deleteIconButton: {
    backgroundColor: '#FEE2E2',
  },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  offlineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  offlineTextWrap: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  heroCard: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  heroContent: {
    alignItems: 'center',
  },
  avatarBorder: {
    borderWidth: 3,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  petName: {
    marginBottom: spacing.xs,
  },
  speciesText: {
    marginBottom: spacing.sm,
  },
  badgeRow: {
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
  },
  metricIcon: {
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontWeight: '700',
    marginTop: 2,
  },
  bioCard: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
  },
  bioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bioText: {
    lineHeight: 22,
  },
  vaccineCard: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  vaccineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  vaccineInfo: {
    flex: 1,
  },
  vaccineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vaccineActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  vacDeleteBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaccineMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  vaccineNotes: {
    marginTop: spacing.xs,
    fontStyle: 'italic',
  },
  consultCard: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    marginBottom: spacing.xs,
  },
  consultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consultSymptomsRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  guaranteeCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guaranteeIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  guaranteeText: {
    flex: 1,
  },
  footerActions: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  emptyPrescriptionCard: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  boldText: {
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalFooter: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
});
