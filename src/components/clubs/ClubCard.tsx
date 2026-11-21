import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, FileText, Check, Plus } from 'lucide-react-native';
import { Club } from '../../types/club';
import { Card } from '../ui/Card';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Skeleton } from '../ui/Skeleton';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface ClubCardProps {
  club: Club;
  onJoinToggle?: (clubId: string, isJoining: boolean) => void;
  isJoiningLoading?: boolean;
}

export const ClubCardSkeleton: React.FC = () => (
  <Card style={styles.card} testID="club-card-skeleton">
    <Skeleton width="100%" height={120} style={{ borderRadius: 0 }} />
    <View style={styles.body}>
      <Skeleton width="60%" height={22} />
      <Skeleton width="90%" height={14} style={{ marginTop: spacing.xs }} />
      <Skeleton width="50%" height={14} style={{ marginTop: spacing.xs }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm }}>
        <Skeleton width="30%" height={14} />
        <View style={styles.statDivider} />
        <Skeleton width="25%" height={14} />
      </View>
      <Skeleton
        width="100%"
        height={44}
        style={{ marginTop: spacing.sm, borderRadius: radii.md }}
      />
    </View>
  </Card>
);

export const ClubCard: React.FC<ClubCardProps> & { Skeleton: typeof ClubCardSkeleton } = ({
  club,
  onJoinToggle,
  isJoiningLoading = false,
}) => {
  const router = useRouter();

  const handleCardPress = () => {
    router.push(`/clubs/${club.id}` as any);
  };

  const handleJoinPress = (e: any) => {
    e?.stopPropagation?.();
    if (onJoinToggle) {
      onJoinToggle(club.id, !club.is_member);
    }
  };

  const fallbackImage =
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80';

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={`Pet club: ${club.name}`}
      testID={`club-card-${club.slug}`}
      style={styles.touchable}
    >
      <Card style={styles.card}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: club.cover_image || fallbackImage }}
            style={styles.coverImage}
            resizeMode="cover"
          />
          <View style={styles.badgeOverlay}>
            <Badge variant="verified" label={club.category} />
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.headerRow}>
            <Heading level={3} style={styles.name} numberOfLines={1}>
              {club.name}
            </Heading>
          </View>

          <Text variant="bodySm" color={colors.muted} numberOfLines={2} style={styles.description}>
            {club.description}
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Users size={14} color={colors.inkSoft} style={{ marginRight: 4 }} />
              <Text variant="caption" color={colors.inkSoft} style={styles.statText}>
                {club.member_count} {club.member_count === 1 ? 'member' : 'members'}
              </Text>
            </View>

            <View style={styles.statDivider} />

            <View style={styles.statItem}>
              <FileText size={14} color={colors.inkSoft} style={{ marginRight: 4 }} />
              <Text variant="caption" color={colors.inkSoft} style={styles.statText}>
                {club.post_count} {club.post_count === 1 ? 'post' : 'posts'}
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            {club.is_member ? (
              <Button
                title="Joined"
                size="sm"
                variant="outline"
                leftIcon={<Check size={14} color={colors.ink} />}
                onPress={handleJoinPress}
                loading={isJoiningLoading}
                style={styles.joinedBtn}
                accessibilityLabel={`Joined ${club.name}. Tap to leave.`}
                accessibilityHint="Leaves this pet club"
                testID={`club-join-btn-${club.slug}`}
              />
            ) : (
              <Button
                title="Join Club"
                size="sm"
                variant="primary"
                leftIcon={<Plus size={14} color={colors.ink} />}
                onPress={handleJoinPress}
                loading={isJoiningLoading}
                style={styles.joinBtn}
                accessibilityLabel={`Join ${club.name}`}
                accessibilityHint="Joins this pet club"
                testID={`club-join-btn-${club.slug}`}
              />
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

ClubCard.Skeleton = ClubCardSkeleton;

const styles = StyleSheet.create({
  touchable: {
    marginBottom: spacing.md,
  },
  card: {
    padding: 0,
    overflow: 'hidden',
  },
  imageContainer: {
    height: 120,
    width: '100%',
    backgroundColor: colors.surface,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  badgeOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  body: {
    padding: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  name: {
    flex: 1,
  },
  description: {
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDivider: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  statText: {
    fontWeight: '500',
  },
  actionRow: {
    marginTop: spacing.xs,
  },
  joinBtn: {
    width: '100%',
    minHeight: 44,
  },
  joinedBtn: {
    width: '100%',
    backgroundColor: colors.surface,
    minHeight: 44,
  },
});
