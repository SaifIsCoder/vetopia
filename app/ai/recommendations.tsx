import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, Check, Stethoscope } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { apiClient } from '../../src/lib/api';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

const SPECIES = ['Dogs', 'Cats', 'Birds', 'Farm'];
const LIFE_STAGES = ['puppy', 'adult', 'senior'];
const GOALS = ['joints', 'weight', 'coat', 'dental', 'calm'];

export default function RecommendationsScreen() {
  const router = useRouter();
  const [selectedSpecies, setSelectedSpecies] = useState('Dogs');
  const [selectedStage, setSelectedStage] = useState('adult');
  const [selectedGoals, setSelectedGoals] = useState<string[]>(['joints']);
  const [recommendations, setRecommendations] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const toggleGoal = (goal: string) => {
    setSelectedGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]
    );
  };

  const generateRecommendations = async () => {
    setLoading(true);
    try {
      const res = await apiClient.request<any>('ai/recommendations', {
        method: 'POST',
        body: {
          species: selectedSpecies,
          lifeStage: selectedStage,
          goals: selectedGoals,
          budget: 'balanced',
        },
        requiresAuth: false,
      });
      setRecommendations(res.data);
    } catch {
      setRecommendations({
        title: `AI Curated Care Plan for ${selectedSpecies}`,
        reason: `Optimized for ${selectedStage} stage with focus on ${selectedGoals.join(', ')}.`,
        recommendedProducts: [
          { name: 'Premium Kibble (5kg) — High Protein Vet Formula', slug: 'premium-kibble-5kg', priceUsd: 42, matchScore: 98, badge: 'Vet Approved' },
          { name: 'Joint Support Glucosamine Chews', slug: 'joint-support-chews', priceUsd: 28, matchScore: 95, badge: 'Target Goal' },
        ],
        vetSpecialtyRecommendation: 'General Veterinary Medicine',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Smart Care Recommendations</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <Sparkles size={28} color={colors.primaryDark} />
          <Text style={styles.heroTitle}>AI Tailored Pet Plan</Text>
          <Text style={styles.heroDesc}>
            Select your pet's life stage and health priorities to generate veterinary nutrition and care suggestions.
          </Text>
        </View>

        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>1. Select Pet Species</Text>
          <View style={styles.pillsRow}>
            {SPECIES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.pill, selectedSpecies === s && styles.pillActive]}
                onPress={() => setSelectedSpecies(s)}
              >
                <Text style={[styles.pillText, selectedSpecies === s && styles.pillTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>2. Life Stage</Text>
          <View style={styles.pillsRow}>
            {LIFE_STAGES.map((stage) => (
              <TouchableOpacity
                key={stage}
                style={[styles.pill, selectedStage === stage && styles.pillActive]}
                onPress={() => setSelectedStage(stage)}
              >
                <Text style={[styles.pillText, selectedStage === stage && styles.pillTextActive]}>
                  {stage.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.md }]}>3. Primary Health Goals</Text>
          <View style={styles.pillsRow}>
            {GOALS.map((goal) => {
              const active = selectedGoals.includes(goal);
              return (
                <TouchableOpacity
                  key={goal}
                  style={[styles.pill, active && styles.pillActive]}
                  onPress={() => toggleGoal(goal)}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {goal.charAt(0).toUpperCase() + goal.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            title={loading ? 'Consulting Knowledge Graph...' : 'Generate Care Plan'}
            style={styles.genBtn}
            onPress={generateRecommendations}
            disabled={loading}
          />
        </Card>

        {recommendations && (
          <View style={styles.resultsBox}>
            <View style={styles.resultTitleBox}>
              <Text style={styles.recTitle}>{recommendations.title}</Text>
              <Text style={styles.recReason}>{recommendations.reason}</Text>
            </View>

            {recommendations.vetSpecialtyRecommendation && (
              <Card style={styles.vetCard}>
                <Stethoscope size={20} color={colors.primaryDark} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.vetCardTitle}>Recommended Specialist</Text>
                  <Text style={styles.vetCardSpec}>{recommendations.vetSpecialtyRecommendation}</Text>
                </View>
                <TouchableOpacity
                  style={styles.bookVetBtn}
                  onPress={() => router.push('/(tabs)/vets' as any)}
                >
                  <Text style={styles.bookVetText}>Find Vet</Text>
                </TouchableOpacity>
              </Card>
            )}

            <Text style={styles.productsHeading}>Suggested Products</Text>
            {recommendations.recommendedProducts?.map((item: any, idx: number) => (
              <Card key={idx} style={styles.prodCard}>
                <View style={styles.prodHeader}>
                  <Text style={styles.prodName}>{item.name}</Text>
                  <Text style={styles.prodPrice}>${item.priceUsd}</Text>
                </View>
                <View style={styles.prodFooter}>
                  <View style={styles.matchPill}>
                    <Text style={styles.matchText}>{item.matchScore}% Compatibility</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.shopBtn}
                    onPress={() => router.push(`/marketplace/${item.slug}` as any)}
                  >
                    <Text style={styles.shopBtnText}>View Item →</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}
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
    maxWidth: 320,
  },
  card: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  pillTextActive: {
    color: colors.cream,
    fontWeight: '700',
  },
  genBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    marginTop: spacing.lg,
    paddingVertical: 14,
  },
  genBtnText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  resultsBox: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  resultTitleBox: {
    gap: 4,
  },
  recTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  recReason: {
    fontSize: 13,
    color: colors.inkSoft,
  },
  vetCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
  },
  vetCardTitle: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  vetCardSpec: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  bookVetBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  bookVetText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  productsHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginTop: spacing.xs,
  },
  prodCard: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.xs,
  },
  prodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  prodName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
    paddingRight: spacing.sm,
  },
  prodPrice: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  prodFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  matchPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  matchText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  shopBtn: {
    paddingVertical: 2,
  },
  shopBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
