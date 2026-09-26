import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pill, FileDown, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { MedicationItemRow } from '../../src/components/prescriptions/MedicationItemRow';
import { usePrescription } from '../../src/hooks/usePrescriptions';
import { exportPrescriptionPdf } from '../../src/lib/prescriptions/prescriptionPdf';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function PrescriptionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isExporting, setIsExporting] = useState(false);

  const { data: prescription, isLoading, isError, error, refetch } = usePrescription(id || '');

  const handleExportPdf = async () => {
    if (!prescription) return;
    setIsExporting(true);
    try {
      await exportPrescriptionPdf(prescription);
    } catch (err: any) {
      Alert.alert(
        'Export Failed',
        err?.message || 'Could not generate or share prescription PDF. Please try again.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
        <Text variant="bodySm" color={colors.inkSoft} style={styles.loadingText}>
          Retrieving digital prescription...
        </Text>
      </Screen>
    );
  }

  if (isError || !prescription) {
    return (
      <Screen style={styles.container}>
        <EmptyState
          title="Prescription Unavailable"
          description={
            error?.message ||
            'The requested prescription could not be found or you do not have permission to view it.'
          }
          icon={<AlertCircle size={48} color={colors.destructive} />}
        />
        <View style={styles.errorActions}>
          <Button
            title="Try Again"
            onPress={() => refetch()}
            variant="primary"
            style={styles.mbSm}
          />
          <Button title="Go Back" onPress={() => router.back()} variant="outline" />
        </View>
      </Screen>
    );
  }

  const formattedDate = new Date(prescription.created_at).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const formattedTime = new Date(prescription.created_at).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const vetName = prescription.vet?.name || 'Dr. Veterinarian';
  const vetSpecialty = prescription.vet?.specialty || 'General Veterinary Medicine';
  const petName = prescription.pet?.name || 'Pet';
  const petSpecies = prescription.pet?.species || 'Canine';

  return (
    <Screen style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Navigation & Header */}
        <View style={styles.topNav}>
          <Button
            title="Back"
            onPress={() => router.back()}
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={16} color={colors.ink} />}
          />
          <Badge
            variant={prescription.status === 'active' ? 'completed' : 'scheduled'}
            label={prescription.status.toUpperCase()}
          />
        </View>

        <View style={styles.header}>
          <View style={styles.rxIconWrap}>
            <Pill size={24} color={colors.primaryDark} />
          </View>
          <View style={styles.headerTextCol}>
            <Text variant="caption" color={colors.primaryDark} style={styles.rxSub}>
              OFFICIAL DIGITAL RX
            </Text>
            <Heading level={2}>Digital Prescription</Heading>
            <Text variant="caption" color={colors.inkSoft}>
              Ref: {prescription.id.slice(0, 8).toUpperCase()} • {formattedDate}
            </Text>
          </View>
        </View>

        {/* Action: PDF Export */}
        <Card style={styles.exportCard}>
          <View style={styles.exportRow}>
            <View style={styles.exportInfo}>
              <Text variant="headingSm" color={colors.ink}>
                Prescription Document
              </Text>
              <Text variant="caption" color={colors.inkSoft}>
                {"Download formatted PDF for your pet's pharmacy or medical records."}
              </Text>
            </View>
            <Button
              title={isExporting ? 'Generating...' : 'Export PDF'}
              onPress={handleExportPdf}
              variant="primary"
              size="sm"
              disabled={isExporting}
              loading={isExporting}
              leftIcon={<FileDown size={16} color={colors.ink} />}
            />
          </View>
        </Card>

        {/* Patient & Doctor Snapshot */}
        <View style={styles.profileRow}>
          {/* Patient Card */}
          <Card style={styles.profileCardHalf}>
            <Text variant="caption" color={colors.muted} style={styles.profileKicker}>
              PATIENT
            </Text>
            <Text variant="headingSm" color={colors.ink}>
              {petName}
            </Text>
            <Text variant="caption" color={colors.inkSoft}>
              {petSpecies} {prescription.pet?.breed ? `• ${prescription.pet.breed}` : ''}
            </Text>
            {prescription.pet?.age ? (
              <Text variant="caption" color={colors.inkSoft}>
                Age: {prescription.pet.age}
              </Text>
            ) : null}
            {prescription.pet?.weight_kg ? (
              <Text variant="caption" color={colors.inkSoft}>
                Weight: {prescription.pet.weight_kg} kg
              </Text>
            ) : null}
          </Card>

          {/* Veterinarian Card */}
          <Card style={styles.profileCardHalf}>
            <Text variant="caption" color={colors.muted} style={styles.profileKicker}>
              PRESCRIBED BY
            </Text>
            <Text variant="headingSm" color={colors.ink} numberOfLines={1}>
              {vetName}
            </Text>
            <Text variant="caption" color={colors.primaryDark} numberOfLines={1}>
              {vetSpecialty}
            </Text>
            {prescription.vet?.country ? (
              <Text variant="caption" color={colors.inkSoft}>
                {prescription.vet.flag ? `${prescription.vet.flag} ` : ''}
                {prescription.vet.country}
              </Text>
            ) : null}
            <View style={styles.verifiedRow}>
              <ShieldCheck size={12} color={colors.primaryDark} />
              <Text variant="caption" color={colors.primaryDark} style={styles.verifiedText}>
                Verified Practitioner
              </Text>
            </View>
          </Card>
        </View>

        {/* Clinical Assessment */}
        <Card style={styles.sectionCard}>
          <Text variant="caption" color={colors.muted} style={styles.profileKicker}>
            CLINICAL DIAGNOSIS
          </Text>
          <Text variant="headingSm" color={colors.ink} style={styles.diagnosisText}>
            {prescription.diagnosis}
          </Text>

          {prescription.notes ? (
            <View style={styles.notesBox}>
              <Text variant="caption" color={colors.muted} style={styles.notesLabel}>
                Instructions & Clinical Notes:
              </Text>
              <Text variant="bodySm" color={colors.inkSoft}>
                {prescription.notes}
              </Text>
            </View>
          ) : null}

          <View style={styles.refillsRow}>
            <Text variant="caption" color={colors.inkSoft}>
              Refills Authorized:{' '}
            </Text>
            <Text variant="caption" color={colors.ink} style={styles.boldText}>
              {prescription.refills_allowed}{' '}
              {prescription.refills_allowed === 1 ? 'refill' : 'refills'}
            </Text>
          </View>
        </Card>

        {/* Prescribed Medications */}
        <View style={styles.section}>
          <Heading level={3} style={styles.sectionHeading}>
            Prescribed Medications ({prescription.items?.length || 0})
          </Heading>

          {prescription.items && prescription.items.length > 0 ? (
            prescription.items.map((item) => <MedicationItemRow key={item.id} item={item} />)
          ) : (
            <Card style={styles.noMedsCard}>
              <Text variant="bodySm" color={colors.inkSoft}>
                No medication line items listed for this prescription.
              </Text>
            </Card>
          )}
        </View>

        {/* Digital Signature & Authorization */}
        <Card style={styles.signatureCard}>
          <View style={styles.signatureHeader}>
            <ShieldCheck size={18} color={colors.primaryDark} />
            <Text variant="headingSm" color={colors.ink}>
              Digital Authorization
            </Text>
          </View>
          <Text variant="bodySm" color={colors.inkSoft} style={styles.signText}>
            Electronically signed and verified by{' '}
            <Text variant="bodySm" color={colors.ink} style={styles.boldText}>
              {vetName}
            </Text>{' '}
            on {formattedDate} at {formattedTime}.
          </Text>
          <View style={styles.divider} />
          <Text variant="caption" color={colors.inkSoft} style={styles.disclaimerText}>
            Regulatory Disclaimer: Valid only for the patient designated above. Controlled
            substances (Schedules II–V) cannot be prescribed via digital telemedicine consultations.
          </Text>
        </Card>
      </ScrollView>
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
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  rxIconWrap: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextCol: {
    flex: 1,
  },
  rxSub: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  exportCard: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    marginBottom: spacing.md,
  },
  exportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  exportInfo: {
    flex: 1,
  },
  profileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  profileCardHalf: {
    flex: 1,
    padding: spacing.md,
  },
  profileKicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sectionCard: {
    marginBottom: spacing.md,
  },
  diagnosisText: {
    marginVertical: 4,
  },
  notesBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  notesLabel: {
    marginBottom: 2,
    fontWeight: '600',
  },
  refillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  boldText: {
    fontWeight: '700',
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionHeading: {
    marginBottom: spacing.sm,
  },
  noMedsCard: {
    padding: spacing.md,
    alignItems: 'center',
  },
  signatureCard: {
    backgroundColor: '#FAFAFA',
    borderColor: '#E5E7EB',
    marginBottom: spacing.lg,
  },
  signatureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  signText: {
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  disclaimerText: {
    fontStyle: 'italic',
    lineHeight: 16,
  },
  errorActions: {
    marginTop: spacing.lg,
    width: '100%',
  },
  mbSm: {
    marginBottom: spacing.sm,
  },
});
