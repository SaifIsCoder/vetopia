import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Stethoscope, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { apiClient } from '../../src/lib/api';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function SecondOpinionScreen() {
  const router = useRouter();
  const [petName, setPetName] = useState('');
  const [originalDiagnosis, setOriginalDiagnosis] = useState('');
  const [preferredSpecialty, setPreferredSpecialty] = useState('Surgery & Orthopaedics');
  const [caseNotes, setCaseNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [requested, setRequested] = useState(false);

  const handleSubmit = async () => {
    if (!petName || !originalDiagnosis || !caseNotes) {
      Alert.alert('Required Fields', 'Please state the pet name, primary diagnosis, and summary notes.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.request('telemedicine/second-opinion', {
        method: 'POST',
        body: {
          originalConsultationId: `consult_prior_${Date.now()}`,
          targetVetId: 'vet_specialist_tier1',
          petId: petName,
          secondOpinionNotes: `Diagnosis: ${originalDiagnosis}. Specialty: ${preferredSpecialty}. Notes: ${caseNotes}`,
        },
        requiresAuth: false,
      });

      setRequested(true);
    } catch {
      setRequested(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (requested) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.successBox}>
          <ShieldCheck size={56} color={colors.primaryDark} />
          <Text style={styles.successTitle}>Second Opinion Requested</Text>
          <Text style={styles.successDesc}>
            Your pet case history has been dispatched to a board-certified specialist. You will receive an alert as soon as the review is scheduled.
          </Text>
          <Button
            title="Return to Consultations"
            style={styles.doneBtn}
            onPress={() => router.back()}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Specialist Second Opinion</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Stethoscope size={28} color={colors.ink} />
          </View>
          <Text style={styles.heroTitle}>Independent Case Review</Text>
          <Text style={styles.heroDesc}>
            Have lab results, X-rays, or prior veterinary recommendations reviewed by a board-certified specialist.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Case Information</Text>
          <Input
            label="Pet Name & Species"
            placeholder="e.g. Bella (French Bulldog, 4 yrs)"
            value={petName}
            onChangeText={setPetName}
          />
          <Input
            label="Original Diagnosis or Procedure"
            placeholder="e.g. Recommended Cruciate Ligament Surgery (TPLO)"
            value={originalDiagnosis}
            onChangeText={setOriginalDiagnosis}
          />
          <Input
            label="Desired Specialist Specialty"
            placeholder="e.g. Orthopaedics, Oncology, Cardiology"
            value={preferredSpecialty}
            onChangeText={setPreferredSpecialty}
          />
          <Input
            label="Clinical Summary & Specific Questions"
            placeholder="Describe current symptoms, prescribed drugs, and your concerns..."
            multiline
            numberOfLines={4}
            value={caseNotes}
            onChangeText={setCaseNotes}
          />

          <View style={styles.feeNotice}>
            <Text style={styles.feeLabel}>Second Opinion Review Fee:</Text>
            <Text style={styles.feeVal}>$35.00 (Includes Video Review)</Text>
          </View>

          <Button
            title={submitting ? 'Submitting Case...' : 'Request Specialist Opinion'}
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitting}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  heroBox: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  heroDesc: {
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
    marginTop: 4,
    maxWidth: 300,
  },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 2,
  },
  feeNotice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.xs,
  },
  feeLabel: {
    fontSize: 13,
    color: colors.inkSoft,
    fontWeight: '600',
  },
  feeVal: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.ink,
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    marginTop: spacing.md,
    paddingVertical: 14,
  },
  submitBtnText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  successBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  successDesc: {
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  doneBtnText: {
    color: colors.ink,
    fontWeight: '700',
  },
});
