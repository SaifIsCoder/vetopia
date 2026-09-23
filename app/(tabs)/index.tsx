import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Sparkles, Calendar, Stethoscope, PawPrint } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function HomeScreen() {
  return (
    <Screen scrollable>
      {/* Brand Header */}
      <View style={styles.header}>
        <View>
          <Text variant="caption" color={colors.inkSoft}>
            THE PETS CLUB
          </Text>
          <Heading level={1} style={styles.brandTitle}>
            Vetopia
          </Heading>
        </View>
        <Badge variant="verified" label="Foundation" />
      </View>

      {/* Emergency & AI Triage Banner Shell */}
      <Card style={styles.triageBanner} elevated={false}>
        <View style={styles.bannerIconContainer}>
          <Sparkles size={20} color={colors.ink} />
        </View>
        <View style={styles.bannerContent}>
          <Heading level={4} style={styles.bannerTitle}>
            24/7 AI Veterinary Triage
          </Heading>
          <Text variant="bodySm" color={colors.inkSoft}>
            Instant emergency symptom assessment & guidance.
          </Text>
        </View>
      </Card>

      {/* Quick Status Cards */}
      <View style={styles.section}>
        <Heading level={3} style={styles.sectionTitle}>
          Clinical Portal
        </Heading>

        <Card style={styles.featureCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Calendar size={18} color={colors.ink} />
            </View>
            <View style={styles.cardHeaderText}>
              <Heading level={4}>Upcoming Appointments</Heading>
              <Text variant="bodySm" color={colors.muted}>
                MVP-04 Telemedicine consultations
              </Text>
            </View>
          </View>
          <Text variant="bodySm" color={colors.inkSoft} style={styles.statusNote}>
            Appointments module connects in Phase 5.
          </Text>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <PawPrint size={18} color={colors.ink} />
            </View>
            <View style={styles.cardHeaderText}>
              <Heading level={4}>Pet Health Passport</Heading>
              <Text variant="bodySm" color={colors.muted}>
                MVP-02 Pet profiles & offline records
              </Text>
            </View>
          </View>
          <Text variant="bodySm" color={colors.inkSoft} style={styles.statusNote}>
            Pet management connects in Phase 3.
          </Text>
        </Card>

        <Card style={styles.featureCard}>
          <View style={styles.cardHeader}>
            <View style={styles.iconCircle}>
              <Stethoscope size={18} color={colors.ink} />
            </View>
            <View style={styles.cardHeaderText}>
              <Heading level={4}>Doctor Directory</Heading>
              <Text variant="bodySm" color={colors.muted}>
                MVP-03 Multi-language vet discovery
              </Text>
            </View>
          </View>
          <Text variant="bodySm" color={colors.inkSoft} style={styles.statusNote}>
            Vet discovery connects in Phase 4.
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  brandTitle: {
    color: colors.ink,
  },
  triageBanner: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  bannerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: colors.ink,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  featureCard: {
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  cardHeaderText: {
    flex: 1,
  },
  statusNote: {
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
});
