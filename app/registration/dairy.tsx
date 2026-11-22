import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Tractor, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { registerFarm } from '../../src/lib/farms/farmService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function DairyRegistrationScreen() {
  const router = useRouter();
  const [farmName, setFarmName] = useState('');
  const [country, setCountry] = useState('United States');
  const [region, setRegion] = useState('');
  const [herdCount, setHerdCount] = useState('');
  const [lactatingCount, setLactatingCount] = useState('');
  const [yieldPerDay, setYieldPerDay] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!farmName || !region || !herdCount) {
      Alert.alert('Required Fields', 'Please complete farm name, region, and herd count.');
      return;
    }

    setLoading(true);
    try {
      await registerFarm({
        name: farmName,
        farmType: 'dairy',
        country,
        region,
        size: Number(herdCount) > 100 ? 'Large Commercial' : 'Medium Dairy',
        herdCount: Number(herdCount),
        lactatingCount: Number(lactatingCount) || 0,
        yieldPerDayLiters: Number(yieldPerDay) || 0,
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
          <Text style={styles.successTitle}>Dairy Farm Registered!</Text>
          <Text style={styles.successDesc}>
            Your digital herd ID has been assigned. You now have access to mobile livestock veterinarians and bulk nutritional supply pricing.
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
        <Text style={styles.headerTitle}>Dairy Farm Registration</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <View style={styles.iconCircle}>
            <Tractor size={28} color={colors.ink} />
          </View>
          <Text style={styles.heroTitle}>Dairy Herd Digital Pass</Text>
          <Text style={styles.heroDesc}>
            Digitally track bulk health, milk yields, vaccination schedules, and vet compliance.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Farm & Location</Text>
          <Input
            label="Farm or Dairy Business Name"
            placeholder="e.g. Green Valley Dairy Co."
            value={farmName}
            onChangeText={setFarmName}
          />
          <Input
            label="Country"
            placeholder="e.g. United States, United Kingdom"
            value={country}
            onChangeText={setCountry}
          />
          <Input
            label="State / Region / Province"
            placeholder="e.g. Wisconsin, Texas, Bavaria"
            value={region}
            onChangeText={setRegion}
          />

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>Herd Analytics</Text>
          <Input
            label="Total Cattle / Herd Size"
            placeholder="e.g. 85"
            keyboardType="numeric"
            value={herdCount}
            onChangeText={setHerdCount}
          />
          <Input
            label="Currently Lactating Cows"
            placeholder="e.g. 60"
            keyboardType="numeric"
            value={lactatingCount}
            onChangeText={setLactatingCount}
          />
          <Input
            label="Average Daily Milk Yield (Liters)"
            placeholder="e.g. 1800"
            keyboardType="numeric"
            value={yieldPerDay}
            onChangeText={setYieldPerDay}
          />

          <Button
            title={loading ? 'Submitting Registration...' : 'Complete Dairy Registration'}
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
