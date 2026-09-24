import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Star, Globe } from 'lucide-react-native';
import { VetProfile } from '../../types/vet';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface VetCardProps {
  vet: VetProfile;
  onPress: (vet: VetProfile) => void;
}

export const VetCard: React.FC<VetCardProps> = ({ vet, onPress }) => {
  const languagesList =
    Array.isArray(vet.languages) && vet.languages.length > 0 ? vet.languages.join(', ') : 'English';

  const priceText = `$${Number(vet.price_usd || 29).toFixed(0)}`;
  const slotMinutesText = `${vet.slot_minutes || 30}m`;
  const ratingText = typeof vet.rating === 'number' ? vet.rating.toFixed(1) : '5.0';
  const reviewsCount = typeof vet.reviews === 'number' ? vet.reviews : 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Doctor ${vet.name}, ${vet.specialty}`}
      accessibilityHint="Navigates to doctor profile and bookable slots"
      onPress={() => onPress(vet)}
      style={({ pressed }) => [styles.wrapper, pressed && styles.pressed]}
    >
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Avatar name={vet.name} size={56} style={styles.avatar} />

          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text variant="headingSm" color={colors.ink} numberOfLines={1} style={styles.name}>
                {vet.name}
              </Text>
              {vet.verified ? (
                <Badge variant="verified" label="Verified" style={styles.verifiedBadge} />
              ) : null}
            </View>

            <Text
              variant="caption"
              color={colors.primaryDark}
              numberOfLines={1}
              style={styles.specialty}
            >
              {vet.specialty}
            </Text>

            <View style={styles.metaRow}>
              <Text variant="caption" color={colors.inkSoft}>
                {vet.flag ? `${vet.flag} ` : ''}
                {vet.country || 'Global'}
              </Text>
              <Text variant="caption" color={colors.muted} style={styles.dot}>
                •
              </Text>
              <View style={styles.ratingBox}>
                <Star size={13} color="#EAB308" fill="#EAB308" />
                <Text variant="caption" color={colors.ink} style={styles.ratingText}>
                  {ratingText}
                </Text>
                <Text variant="caption" color={colors.muted}>
                  ({reviewsCount})
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.detailsRow}>
          <View style={styles.languagesBox}>
            <Globe size={13} color={colors.muted} />
            <Text
              variant="caption"
              color={colors.inkSoft}
              numberOfLines={1}
              style={styles.languagesText}
            >
              {languagesList}
            </Text>
          </View>

          <View style={styles.statusPillBox}>
            {vet.accepting ? (
              <View style={styles.acceptingPill}>
                <View style={styles.acceptingDot} />
                <Text variant="caption" color="#166534" style={styles.statusText}>
                  Accepting
                </Text>
              </View>
            ) : (
              <View style={styles.notAcceptingPill}>
                <Text variant="caption" color={colors.muted} style={styles.statusText}>
                  Not Accepting
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.footerRow}>
          <View style={styles.priceContainer}>
            <Text variant="headingSm" color={colors.ink}>
              {priceText}
            </Text>
            <Text variant="caption" color={colors.muted} style={styles.perSlot}>
              {' '}
              / {slotMinutesText}
            </Text>
          </View>

          <View style={styles.ctaButton}>
            <Text variant="caption" color={colors.ink} style={styles.ctaText}>
              View Profile & Slots →
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.md,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  card: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: spacing.md,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  name: {
    flex: 1,
    fontWeight: '700',
    marginRight: spacing.xs,
  },
  verifiedBadge: {
    paddingVertical: 2,
    paddingHorizontal: spacing.xs,
  },
  specialty: {
    fontWeight: '600',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    marginHorizontal: spacing.xs,
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingText: {
    fontWeight: '600',
    marginLeft: 2,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  languagesBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: spacing.sm,
  },
  languagesText: {
    flex: 1,
  },
  statusPillBox: {
    flexShrink: 0,
  },
  acceptingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  acceptingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
    marginRight: 4,
  },
  notAcceptingPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 11,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  perSlot: {
    fontSize: 12,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  ctaText: {
    fontWeight: '700',
  },
});
