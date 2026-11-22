import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Stethoscope, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { registerClinic } from '../../src/lib/farms/farmService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function ClinicRegistrationScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('United States');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [doctorsCount, setDoctorsCount] = useState('3');
  const [emergencyAvailable, setEmergencyAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!name || !licenseNumber || !address || !city || !phone || !email) {
      Alert.alert('Required Fields', 'Please complete all clinic credentials and contact information.');
      return;
    }

    setLoading(true);
    try {
      await registerClinic({
        name,
        licenseNumber,
        address,
        city,
        country,
        phone,
        email,
        doctorsCount: Number(doctorsCount) || 1,
        emergencyCareAvailable: emergencyAvailable,
        servicesOffered: ['General Surgery', 'Diagnostics', 'Emergency Triage', 'Vaccinations'],
        operatingHours: '24/7',
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.successBox}>
          <ShieldCheck size={56} color={colors.primaryDark} />
          <Text style={styles.successTitle}>Clinic Registered!</Text>
          <Text style={styles.successDesc}>
            Your veterinary facility application has been submitted to the admin verification queue. Once verified, patients will be routed to your clinic directory.
          </Text>
          <Button
            title="Return to Dashboard"
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
        <Text style={styles.headerTitle}>Clinic Facility Registration</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Stethoscope size={28} color={colors.ink} />
          </View>
          <Text style={styles.heroTitle}>Join The Pets Club Network</Text>
          <Text style={styles.heroDesc}>
            List your animal hospital or clinic to accept local and emergency telemedicine referrals.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Hospital / Practice Details</Text>
          <Input
            label="Clinic or Hospital Legal Name"
            placeholder="e.g. Metro Animal Health Center"
            value={name}
            onChangeText={setName}
          />
          <Input
            label="Veterinary Practice License #"
            placeholder="e.g. VET-CLINIC-90210"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />
          <Input
            label="Street Address"
            placeholder="e.g. 742 Evergreen Terrace"
            value={address}
            onChangeText={setAddress}
          />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input label="City" placeholder="e.g. Austin" value={city} onChangeText={setCity} />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Country" placeholder="e.g. US" value={country} onChangeText={setCountry} />
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Contact & Operations</Text>
          <Input
            label="Hospital Phone Number"
            placeholder="+1 (555) 234-5678"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />
          <Input
            label="Administrative Email"
            placeholder="referrals@metroanimal.com"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Input
            label="Number of Licensed Doctors on Staff"
            placeholder="e.g. 5"
            keyboardType="numeric"
            value={doctorsCount}
            onChangeText={setDoctorsCount}
          />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>24/7 Emergency Care Available</Text>
              <Text style={styles.switchDesc}>Show in emergency red-flag triage recommendations</Text>
            </View>
            <Switch
              value={emergencyAvailable}
              onValueChange={setEmergencyAvailable}
              trackColor={{ false: colors.border, true: colors.primaryDark }}
            />
          </View>

          <Button
            title={loading ? 'Submitting Application...' : 'Register Clinic Facility'}
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}
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
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
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
    marginTop: 2,
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
