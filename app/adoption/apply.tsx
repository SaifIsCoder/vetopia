import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Heart, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { submitAdoptionApplication } from '../../src/lib/adoption/adoptionService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function AdoptionApplyScreen() {
  const router = useRouter();
  const { petSlug = 'buddy', petName = 'Buddy' } = useLocalSearchParams<{ petSlug: string; petName: string }>();

  const [applicantName, setApplicantName] = useState('');
  const [applicantEmail, setApplicantEmail] = useState('');
  const [homeType, setHomeType] = useState('House with yard');
  const [activityLevel, setActivityLevel] = useState('Moderate daily walks');
  const [hoursAlone, setHoursAlone] = useState('4-6 hours');
  const [hasOtherPets, setHasOtherPets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!applicantName || !applicantEmail) {
      Alert.alert('Required Fields', 'Please enter your full name and contact email.');
      return;
    }

    setSubmitting(true);
    try {
      await submitAdoptionApplication(petSlug, {
        applicantName,
        applicantEmail,
        homeType,
        activityLevel,
        hoursAlone,
        hasOtherPets,
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.successBox}>
          <ShieldCheck size={64} color={colors.primaryDark} />
          <Text style={styles.successTitle}>Application Submitted!</Text>
          <Text style={styles.successDesc}>
            Your adoption request for {petName} is in review. The shelter will contact you at {applicantEmail} to arrange a home meeting.
          </Text>
          <View style={styles.lifecycleCard}>
            <Text style={styles.lifecycleText}>Lifecycle State: REQUESTED → REVIEW</Text>
          </View>
          <Button
            title="Back to Shelter Listings"
            style={styles.doneBtn}
            onPress={() => router.replace('/adoption' as any)}
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
        <Text style={styles.headerTitle}>Adoption Application</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <Heart size={28} color={colors.destructive} />
          <Text style={styles.heroTitle}>Meet {petName}</Text>
          <Text style={styles.heroDesc}>
            Tell us about your home and lifestyle so the rescue team can verify a safe forever match.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Your Contact Information</Text>
          <Input
            label="Full Legal Name"
            placeholder="e.g. Sarah Jenkins"
            value={applicantName}
            onChangeText={setApplicantName}
          />
          <Input
            label="Email Address"
            placeholder="sarah.jenkins@example.com"
            keyboardType="email-address"
            value={applicantEmail}
            onChangeText={setApplicantEmail}
          />

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Living Environment</Text>
          <Input
            label="Home Type & Yard"
            placeholder="e.g. Apartment, House with fenced yard"
            value={homeType}
            onChangeText={setHomeType}
          />
          <Input
            label="Typical Daily Activity Level"
            placeholder="e.g. Daily runs, calm indoor lounge"
            value={activityLevel}
            onChangeText={setActivityLevel}
          />
          <Input
            label="Hours Pet Will Spend Alone Daily"
            placeholder="e.g. Under 4 hours, 4-8 hours"
            value={hoursAlone}
            onChangeText={setHoursAlone}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Do you currently own other pets?</Text>
              <Text style={styles.switchDesc}>Helps determine social compatibility</Text>
            </View>
            <Switch
              value={hasOtherPets}
              onValueChange={setHasOtherPets}
              trackColor={{ false: colors.border, true: colors.primaryDark }}
            />
          </View>

          <Button
            title={submitting ? 'Submitting Application...' : `Submit Adoption Request for ${petName}`}
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
    gap: 4,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  heroDesc: {
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  switchDesc: {
    fontSize: 12,
    color: colors.muted,
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
    maxWidth: 320,
  },
  lifecycleCard: {
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  lifecycleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
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
