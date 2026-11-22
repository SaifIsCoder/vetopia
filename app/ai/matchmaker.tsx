import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, Heart, CheckCircle2, RotateCcw } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { apiClient } from '../../src/lib/api';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

const QUESTIONS = [
  {
    key: 'species',
    title: 'Which pet companion are you looking for?',
    options: ['any', 'Dogs', 'Cats', 'Birds', 'Other'],
  },
  {
    key: 'home',
    title: 'What does your home environment look like?',
    options: ['Apartment', 'House with small yard', 'House with large yard', 'Farm / Acreage'],
  },
  {
    key: 'activity',
    title: 'How would you describe your typical activity level?',
    options: ['Low (Indoor relaxing)', 'Moderate (Daily walks)', 'High (Hikes & sports)'],
  },
  {
    key: 'hoursAlone',
    title: 'How many hours will the pet be home alone?',
    options: ['Under 4 hours', '4-8 hours', 'More than 8 hours'],
  },
  {
    key: 'experience',
    title: 'What is your level of pet ownership experience?',
    options: ['First-time pet parent', 'Some experience', 'Experienced lifelong owner'],
  },
];

export default function MatchmakerScreen() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const handleSelectOption = (option: string) => {
    const qKey = QUESTIONS[currentStep].key;
    const nextAnswers = { ...answers, [qKey]: option };
    setAnswers(nextAnswers);

    if (currentStep < QUESTIONS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      calculateMatches(nextAnswers);
    }
  };

  const calculateMatches = async (finalAnswers: Record<string, string>) => {
    setLoading(true);
    try {
      const res = await apiClient.request<any[]>('ai/matchmaking', {
        method: 'POST',
        body: finalAnswers,
        requiresAuth: false,
      });
      setResults(res.data || []);
    } catch {
      // Fallback result scoring
      setResults([
        { petSlug: 'buddy', petName: 'Buddy', species: 'Dogs', score: 96, matchReason: 'Great match for outdoor activity & family presence.' },
        { petSlug: 'luna', petName: 'Luna', species: 'Cats', score: 92, matchReason: 'Quiet apartment fit with independent personality.' },
        { petSlug: 'kiwi', petName: 'Kiwi', species: 'Birds', score: 85, matchReason: 'Social companion with moderate space needs.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setAnswers({});
    setCurrentStep(0);
    setResults(null);
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Adoption Matchmaker</Text>
        {results ? (
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <RotateCcw size={18} color={colors.ink} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!results && !loading && (
          <View>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${((currentStep + 1) / QUESTIONS.length) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.stepCounter}>
                Question {currentStep + 1} of {QUESTIONS.length}
              </Text>
            </View>

            <View style={styles.questionBox}>
              <View style={styles.iconBadge}>
                <Sparkles size={20} color={colors.ink} />
              </View>
              <Text style={styles.questionTitle}>{QUESTIONS[currentStep].title}</Text>
            </View>

            <View style={styles.optionsList}>
              {QUESTIONS[currentStep].options.map((option, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.optionCard}
                  activeOpacity={0.8}
                  onPress={() => handleSelectOption(option)}
                >
                  <Text style={styles.optionText}>{option}</Text>
                  <CheckCircle2 size={18} color={colors.border} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingBox}>
            <Sparkles size={40} color={colors.primaryDark} />
            <Text style={styles.loadingTitle}>Analyzing Compatibility...</Text>
            <Text style={styles.loadingSubtitle}>
              Matching your lifestyle against verified shelter pets.
            </Text>
          </View>
        )}

        {results && (
          <View style={styles.resultsBox}>
            <View style={styles.resultsHeader}>
              <Sparkles size={24} color={colors.primaryDark} />
              <Text style={styles.resultsTitle}>Your Top Matches</Text>
              <Text style={styles.resultsSubtitle}>
                Based on your space, daily schedule, and activity preferences.
              </Text>
            </View>

            {results.map((match, idx) => (
              <Card key={idx} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <View>
                    <Text style={styles.matchPetName}>{match.petName}</Text>
                    <Text style={styles.matchSpecies}>{match.species}</Text>
                  </View>
                  <View style={styles.scorePill}>
                    <Text style={styles.scoreVal}>{match.score}%</Text>
                    <Text style={styles.scoreLabel}>Match</Text>
                  </View>
                </View>

                <Text style={styles.matchReason}>{match.matchReason}</Text>

                <Button
                  title={`Meet ${match.petName} →`}
                  style={styles.viewPetBtn}
                  onPress={() => router.push(`/adoption/${match.petSlug}` as any)}
                />
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
  resetBtn: {
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
  progressContainer: {
    marginBottom: spacing.lg,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  stepCounter: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '600',
  },
  questionBox: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.sm,
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    fontFamily: typography.displayMd.fontFamily,
    maxWidth: 300,
  },
  optionsList: {
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  loadingBox: {
    paddingTop: 80,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  loadingSubtitle: {
    fontSize: 13,
    color: colors.muted,
  },
  resultsBox: {
    gap: spacing.md,
  },
  resultsHeader: {
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: 4,
  },
  resultsTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
  },
  resultsSubtitle: {
    fontSize: 13,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  matchCard: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderColor: colors.border,
  },
  matchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  matchPetName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  matchSpecies: {
    fontSize: 13,
    color: colors.muted,
  },
  scorePill: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  scoreVal: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  scoreLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.ink,
    textTransform: 'uppercase',
  },
  matchReason: {
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  viewPetBtn: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
  },
  viewPetBtnText: {
    color: colors.ink,
    fontWeight: '700',
  },
});
