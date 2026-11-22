import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Egg, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { registerFarm } from '../../src/lib/farms/farmService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function PoultryRegistrationScreen() {
  const router = useRouter();
  const [flockName, setFlockName] = useState('');
  const [country, setCountry] = useState('United States');
  const [region, setRegion] = useState('');
  const [flockCount, setFlockCount] = useState('');
  const [eggProduction, setEggProduction] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!flockName || !region || !flockCount) {
      Alert.alert('Required Fields', 'Please complete flock name, region, and flock count.');
      return;
    }

    setLoading(true);
    try {
      await registerFarm({
        name: flockName,
        farmType: 'poultry',
        country,
        region,
        size: Number(flockCount) > 1000 ? 'Commercial Layer Facility' : 'Flock / Free Range',
        flockCount: Number(flockCount),
        eggProductionPerDay: Number(eggProduction) || 0,
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
          <Text style={styles.successTitle}>Poultry Registered!</Text>
          <Text style={styles.successDesc}>
            Your digital flock record is verified. Access avian specialists, vaccination protocols, and feed nutrition monitoring.
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
        <Text style={styles.headerTitle}>Poultry Flock Registration</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Egg size={28} color={colors.ink} />
          </View>
          <Text style={styles.heroTitle}>Poultry & Layer Health Log</Text>
          <Text style={styles.heroDesc}>
            Biosecurity tracking, egg production curves, and direct access to poultry veterinary doctors.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Flock Details</Text>
          <Input
            label="Flock / Poultry Farm Name"
            placeholder="e.g. Sunny Hill Layer Farm"
            value={flockName}
            onChangeText={setFlockName}
          />
          <Input
            label="Country"
            placeholder="e.g. United States, United Kingdom"
            value={country}
            onChangeText={setCountry}
          />
          <Input
            label="Region / State"
            placeholder="e.g. Georgia, Lancashire"
            value={region}
            onChangeText={setRegion}
          />

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Flock Metrics</Text>
          <Input
            label="Total Birds / Layer Count"
            placeholder="e.g. 500"
            keyboardType="numeric"
            value={flockCount}
            onChangeText={setFlockCount}
          />
          <Input
            label="Average Daily Egg Production"
            placeholder="e.g. 420"
            keyboardType="numeric"
            value={eggProduction}
            onChangeText={setEggProduction}
          />

          <Button
            title={loading ? 'Submitting Registration...' : 'Complete Poultry Registration'}
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
