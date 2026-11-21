import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  PenSquare,
  Users,
  Compass,
  Check,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { PostCard } from '../../src/components/clubs/PostCard';
import { useCommunityFeed, useJoinedClubs } from '../../src/hooks/useClubs';
import { clubService } from '../../src/lib/clubs/clubService';
import { useAuthStore } from '../../src/store/authStore';
import { ClubPost } from '../../src/types/club';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function CommunityFeedScreen() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [extraPosts, setExtraPosts] = useState<ClubPost[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMorePages, setHasMorePages] = useState<boolean | null>(null);

  const {
    data: feedData,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useCommunityFeed();

  const { data: joinedClubs = [] } = useJoinedClubs();
  const joinedClubIds = React.useMemo(
    () => new Set(joinedClubs.map((c) => c.id)),
    [joinedClubs],
  );

  const initialPosts = feedData?.posts || [];
  const allPosts = [...initialPosts, ...extraPosts];
  const hasMore = hasMorePages !== null ? hasMorePages : Boolean(feedData?.hasMore);

  const handleCreatePost = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to share a discussion post.');
      return;
    }
    router.push('/community/create-post' as any);
  };

  const handleEditPostPress = (post: ClubPost) => {
    router.push({
      pathname: '/community/create-post' as any,
      params: {
        postId: post.id,
        initialContent: post.content || post.caption || '',
        initialImage: post.image_url || '',
        initialClubId: post.club_id || '',
      },
    });
  };

  const handleRefresh = async () => {
    setExtraPosts([]);
    setHasMorePages(null);
    await refetch();
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || allPosts.length === 0) return;
    const lastPost = allPosts[allPosts.length - 1];
    setIsLoadingMore(true);
    try {
      const response = await clubService.getCommunityFeed(20, lastPost.created_at);
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

  if (isLoading) {
    return (
      <Screen scrollable testID="community-feed-loading">
        <View style={styles.header}>
          <Skeleton width={120} height={28} />
          <Skeleton width={80} height={32} style={{ borderRadius: radii.pill }} />
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <Skeleton width="100%" height={160} style={{ borderRadius: radii.md }} />
          <Skeleton width="100%" height={200} style={{ borderRadius: radii.md }} />
          <Skeleton width="100%" height={140} style={{ borderRadius: radii.md }} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scrollable testID="community-feed-error">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={2}>Community Feed</Heading>
        </View>
        <ErrorState
          title="Could not load community feed"
          message={(error as Error)?.message || 'Please check your connection and try again.'}
          onRetry={handleRefresh}
        />
      </Screen>
    );
  }

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
      testID="community-feed-screen"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="btn-feed-back"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Heading level={2} style={styles.title}>
            Community Feed
          </Heading>
          <Text variant="caption" color={colors.muted}>
            Discussions & stories across all Vetopia clubs
          </Text>
        </View>

        <Button
          title="Post"
          variant="primary"
          size="sm"
          onPress={handleCreatePost}
          leftIcon={<PenSquare size={14} color={colors.ink} />}
          style={styles.createBtn}
          testID="btn-create-post"
        />
      </View>

      {/* Clubs Discovery Banner */}
      <Card style={styles.clubBanner}>
        <View style={styles.clubBannerRow}>
          <View style={styles.clubBannerIconContainer}>
            <Compass size={20} color="#15803D" />
          </View>
          <View style={styles.clubBannerContent}>
            <Heading level={4}>Explore Animal Clubs</Heading>
            <Text variant="caption" color={colors.inkSoft}>
              Join breed clubs for dogs, cats, birds, horses, and farm animals.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/clubs' as any)}
            style={styles.exploreClubsBtn}
            accessibilityRole="button"
            accessibilityLabel="View all pet clubs"
            testID="btn-explore-clubs"
          >
            <Users size={14} color={colors.primaryDark} style={{ marginRight: 4 }} />
            <Text variant="caption" color={colors.primaryDark} style={styles.exploreClubsText}>
              Clubs
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Posts List */}
      {allPosts.length === 0 ? (
        <EmptyState
          title="No Discussions Yet"
          description="Be the first to share an update, tip, or question with the Vetopia pet community."
          actionTitle="Create First Post"
          onAction={handleCreatePost}
        />
      ) : (
        <View style={styles.postsList}>
          {allPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isMember={!post.club_id || joinedClubIds.has(post.club_id)}
              onEditPress={handleEditPostPress}
            />
          ))}

          {/* Cursor Pagination Controls */}
          {hasMore ? (
            <View style={styles.loadMoreContainer}>
              <Button
                title={isLoadingMore ? 'Loading discussions...' : 'Load More Discussions'}
                variant="outline"
                size="md"
                onPress={handleLoadMore}
                loading={isLoadingMore}
                disabled={isLoadingMore}
                testID="btn-load-more"
                style={styles.loadMoreBtn}
              />
            </View>
          ) : (
            <View style={styles.endOfFeedContainer}>
              <Check size={16} color={colors.muted} style={{ marginRight: 6 }} />
              <Text variant="caption" color={colors.muted}>
                {"You're all caught up with recent discussions"}
              </Text>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
  },
  createBtn: {
    minWidth: 78,
  },
  clubBanner: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  clubBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  clubBannerIconContainer: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  clubBannerContent: {
    flex: 1,
    marginRight: spacing.xs,
  },
  exploreClubsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  exploreClubsText: {
    fontWeight: '700',
  },
  postsList: {
    marginTop: spacing.xs,
  },
  loadMoreContainer: {
    marginVertical: spacing.md,
    alignItems: 'center',
  },
  loadMoreBtn: {
    width: '100%',
  },
  endOfFeedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
});
