import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Stethoscope, Sparkles, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

const SLIDES = [
  {
    icon: <Stethoscope size={48} color={colors.primaryDark} />,
    title: 'Online Vet Consultations',
    description:
      'Connect with certified veterinarians in 11 languages via HD video, audio, or secure messaging.',
  },
  {
    icon: <Sparkles size={48} color={colors.primaryDark} />,
    title: '24/7 AI Symptom Triage',
    description:
      'Instant clinical assessment and red-flag emergency detection for peace of mind anytime.',
  },
  {
    icon: <ShieldCheck size={48} color={colors.primaryDark} />,
    title: 'Digital Pet Passport',
    description:
      'Complete medical records, vaccination timelines, and instant prescriptions always in your pocket.',
  },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Text variant="caption" color={colors.inkSoft} style={styles.kicker}>
          THE PETS CLUB
        </Text>
        <Heading level={1} style={styles.brandTitle}>
          Vetopia
        </Heading>
      </View>

      <View style={styles.carouselContainer}>
        <Card style={styles.carouselCard}>
          <View style={styles.iconCircle}>{SLIDES[activeSlide].icon}</View>
          <Heading level={2} style={styles.slideTitle}>
            {SLIDES[activeSlide].title}
          </Heading>
          <Text variant="bodyMd" color={colors.muted} style={styles.slideDesc}>
            {SLIDES[activeSlide].description}
          </Text>
        </Card>

        {/* Carousel Indicators */}
        <View style={styles.indicators}>
          {SLIDES.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setActiveSlide(index)}
              style={[styles.dot, activeSlide === index ? styles.activeDot : styles.inactiveDot]}
              accessibilityLabel={`Slide ${index + 1}`}
              accessibilityRole="button"
            />
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <Button
          title="Get Started"
          onPress={() => router.push('/(auth)/register')}
          variant="primary"
          style={styles.button}
        />
        <Button
          title="I already have an account"
          onPress={() => router.push('/(auth)/login')}
          variant="outline"
          style={styles.button}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: spacing['2xl'],
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  kicker: {
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  brandTitle: {
    fontSize: 34,
    color: colors.ink,
  },
  carouselContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.lg,
  },
  carouselCard: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  slideTitle: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  slideDesc: {
    textAlign: 'center',
    lineHeight: 22,
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.primaryDark,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: colors.border,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  button: {
    width: '100%',
  },
});
