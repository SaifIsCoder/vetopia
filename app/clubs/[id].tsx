import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Plus,
  Check,
  Share2,
  Info,
  PenSquare,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { PostCard } from '../../src/components/clubs/PostCard';
import {
  useClub,
  useClubFeed,
  useJoinClub,
  useLeaveClub,
} from '../../src/hooks/useClubs';
import { clubService } from '../../src/lib/clubs/clubService';
import { useAuthStore } from '../../src/store/authStore';
import { ClubPost } from '../../src/types/club';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function ClubDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [extraPosts, setExtraPosts] = useState<ClubPost[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState<boolean | null>(null);

  const {
    data: club,
    isLoading: clubLoading,
    isError: clubError,
    error: clubErrorObj,
    refetch: refetchClub,
  } = useClub(id);

  const {
    data: feedData,
    isLoading: feedLoading,
    isError: feedError,
    refetch: refetchFeed,
    isRefetching,
  } = useClubFeed(id);

  const joinMutation = useJoinClub();
  const leaveMutation = useLeaveClub();

  const initialPosts = feedData?.posts || [];
  const allPosts = [...initialPosts, ...extraPosts];
  const hasMore = hasMorePages !== null ? hasMorePages : Boolean(feedData?.hasMore);

  const handleJoinToggle = async () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to join clubs and create posts.');
      return;
    }
    if (!club) return;

    try {
      if (club.is_member) {
        Alert.alert(
          'Leave Club',
          `Are you sure you want to leave ${club.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Leave',
              style: 'destructive',
              onPress: async () => {
                await leaveMutation.mutateAsync(club.id);
              },
            },
          ],
        );
      } else {
        await joinMutation.mutateAsync(club.id);
      }
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not update membership.');
    }
  };

  const handleCreatePostPress = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to post in this club.');
      return;
    }
    if (!club?.is_member) {
      Alert.alert('Membership Required', 'You must join this Pet Club before posting.');
      return;
    }
    router.push(`/clubs/${club.id}/create-post` as any);
  };

  const handleEditPostPress = (post: ClubPost) => {
    router.push({
      pathname: `/clubs/${club?.id}/create-post` as any,
      params: {
        postId: post.id,
        initialContent: post.content || post.caption || '',
        initialImage: post.image_url || '',
      },
    });
  };

  const handleRefresh = async () => {
    setExtraPosts([]);
    setHasMorePages(null);
    await Promise.all([refetchClub(), refetchFeed()]);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || allPosts.length === 0 || !club?.id) return;
    const lastPost = allPosts[allPosts.length - 1];
    setIsLoadingMore(true);
    try {
      const response = await clubService.getClubFeed(club.id, 20, lastPost.created_at);
      if (response?.posts && response.posts.length > 0) {
        setExtraPosts((prev: ClubPost[]) => [...prev, ...response.posts]);
        setHasMorePages(response.hasMore);
      } else {
        setHasMorePages(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not load older posts.');
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (clubLoading) {
    return (
      <Screen scrollable>
        <Skeleton width="100%" height={180} style={{ borderRadius: radii.md }} />
        <View style={{ marginTop: spacing.md }}>
          <Skeleton width="70%" height={24} />
          <Skeleton width="90%" height={16} style={{ marginTop: spacing.xs }} />
          <Skeleton width="50%" height={16} style={{ marginTop: spacing.xs }} />
        </View>
      </Screen>
    );
  }

  if (clubError || !club) {
    return (
      <Screen>
        <ErrorState
          title="Club Not Found"
          message={clubErrorObj?.message || 'We could not locate this pet club.'}
          onRetry={refetchClub}
          retryTitle="Try Again"
        />
      </Screen>
    );
  }

  const fallbackCover =
    'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=800&q=80';

  return (
    <Screen
      scrollable
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primaryDark}
            colors={[colors.primaryDark]}
          />
        ),
      }}
    >
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.navBtn}
          accessibilityLabel="Back to clubs"
          accessibilityRole="button"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Heading level={3} numberOfLines={1} style={styles.navTitle}>
          {club.name}
        </Heading>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => {
            Alert.alert('Share Club', `Share ${club.name} with fellow pet owners!`);
          }}
          accessibilityLabel="Share club"
        >
          <Share2 size={18} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {/* Club Hero Card */}
      <Card style={styles.heroCard}>
        <View style={styles.heroImageContainer}>
          <Image
            source={{ uri: club.cover_image || fallbackCover }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroBadge}>
            <Badge variant="verified" label={club.category} />
          </View>
        </View>

        <View style={styles.heroBody}>
          <Heading level={2} style={styles.heroTitle}>
            {club.name}
          </Heading>
          <Text variant="bodyMd" color={colors.inkSoft} style={styles.heroDescription}>
            {club.description}
          </Text>

          {/* Stats Bar */}
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Users size={16} color={colors.inkSoft} style={{ marginRight: 6 }} />
              <Text variant="bodySm" color={colors.ink} style={styles.heroStatValue}>
                {club.member_count}
              </Text>
              <Text variant="caption" color={colors.muted} style={{ marginLeft: 4 }}>
                {club.member_count === 1 ? 'Member' : 'Members'}
              </Text>
            </View>

            <View style={styles.statDot} />

            <View style={styles.heroStatItem}>
              <Text variant="bodySm" color={colors.ink} style={styles.heroStatValue}>
                {club.post_count}
              </Text>
              <Text variant="caption" color={colors.muted} style={{ marginLeft: 4 }}>
                {club.post_count === 1 ? 'Discussion' : 'Discussions'}
              </Text>
            </View>
          </View>

          {/* Action Row */}
          <View style={styles.heroActions}>
            {club.is_member ? (
              <Button
                title="Joined"
                variant="outline"
                leftIcon={<Check size={16} color={colors.ink} />}
                onPress={handleJoinToggle}
                loading={leaveMutation.isPending}
                style={styles.membershipBtn}
              />
            ) : (
              <Button
                title="Join Pet Club"
                variant="primary"
                leftIcon={<Plus size={16} color={colors.ink} />}
                onPress={handleJoinToggle}
                loading={joinMutation.isPending}
                style={styles.membershipBtn}
              />
            )}

            <Button
              title="Post"
              variant="primary"
              leftIcon={<PenSquare size={16} color={colors.ink} />}
              onPress={handleCreatePostPress}
              style={styles.postBtn}
              accessibilityLabel="Create post in this club"
              testID="btn-create-post-trigger"
            />
          </View>
        </View>
      </Card>

      {/* Non-Member Participation Banner */}
      {!club.is_member ? (
        <Card style={styles.nonMemberBanner}>
          <View style={styles.nonMemberRow}>
            <Info size={18} color={colors.primaryDark} style={{ marginRight: 8, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Heading level={4}>Public Viewing Mode</Heading>
              <Text variant="caption" color={colors.muted} style={{ marginTop: 2 }}>
                You are viewing discussions as a guest. Join this club to publish posts, like content, and participate in comments.
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Club Discussions Feed */}
      <View style={styles.feedSection}>
        <View style={styles.feedHeader}>
          <Heading level={3}>Club Discussions</Heading>
          <Text variant="caption" color={colors.muted}>
            Newest First
          </Text>
        </View>

        {feedLoading ? (
          <View style={{ gap: spacing.md }}>
            {[1, 2].map((k) => (
              <Card key={k} style={{ padding: spacing.md }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Skeleton width={42} height={42} style={{ borderRadius: 21 }} />
                  <View style={{ marginLeft: spacing.sm, flex: 1 }}>
                    <Skeleton width={120} height={16} />
                    <Skeleton width={80} height={12} style={{ marginTop: 4 }} />
                  </View>
                </View>
                <Skeleton width="100%" height={60} style={{ marginTop: spacing.md }} />
              </Card>
            ))}
          </View>
        ) : feedError ? (
          <ErrorState
            title="Failed to Load Feed"
            message="Could not retrieve recent club discussions. Please try again."
            onRetry={refetchFeed}
          />
        ) : allPosts.length === 0 ? (
          <EmptyState
            title="No Posts Yet"
            description="Be the first pet parent to ask a question, share a milestone, or start a discussion in this club!"
            actionTitle={club.is_member ? 'Create First Post' : 'Join to Post'}
            onAction={club.is_member ? handleCreatePostPress : handleJoinToggle}
          />
        ) : (
          <>
            {allPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                clubName={club.name}
                isMember={club.is_member}
                onEditPress={handleEditPostPress}
              />
            ))}

            {hasMore ? (
              <View style={styles.loadMoreContainer}>
                <Button
                  title="Load More Discussions"
                  variant="outline"
                  size="sm"
                  onPress={handleLoadMore}
                  loading={isLoadingMore}
                  testID="btn-load-more-posts"
                  style={styles.loadMoreBtn}
                />
              </View>
            ) : (
              <View style={styles.feedEndContainer}>
                <Text variant="caption" color={colors.muted} style={styles.feedEndText}>
                  {"✓ You're all caught up with recent discussions"}
                </Text>
              </View>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  navTitle: {
    flex: 1,
    marginHorizontal: spacing.sm,
  },
  heroCard: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroImageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
  },
  heroBody: {
    padding: spacing.lg,
  },
  heroTitle: {
    marginBottom: spacing.xs,
  },
  heroDescription: {
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  heroStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStatValue: {
    fontWeight: '700',
  },
  statDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  membershipBtn: {
    flex: 1,
  },
  postBtn: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  nonMemberBanner: {
    backgroundColor: '#F7FEE7',
    borderColor: '#D9F99D',
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  nonMemberRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  feedSection: {
    marginBottom: spacing.xl,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  loadMoreContainer: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  loadMoreBtn: {
    minWidth: 200,
  },
  feedEndContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  feedEndText: {
    textAlign: 'center',
  },
});
