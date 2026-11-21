import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Users,
  MessageSquare,
  BookOpen,
  Calendar,
  Plus,
  ArrowRight,
  Sparkles,
  AlertCircle,
  PenSquare,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { PostCard } from '../../src/components/clubs/PostCard';
import { ClubCard } from '../../src/components/clubs/ClubCard';
import { ArticleCard } from '../../src/components/articles/ArticleCard';
import { EventCard } from '../../src/components/events/EventCard';
import { useAuthStore } from '../../src/store/authStore';
import { useClubs, useCommunityFeed, useJoinClub, useLeaveClub } from '../../src/hooks/useClubs';
import { useArticles } from '../../src/hooks/useArticles';
import { useEvents } from '../../src/hooks/useEvents';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

type CommunityTab = 'overview' | 'feed' | 'clubs' | 'articles' | 'events';

export default function CommunityHubScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<CommunityTab>('overview');

  // React Query cached hooks
  const {
    data: clubs = [],
    isLoading: clubsLoading,
    isError: clubsError,
    refetch: refetchClubs,
  } = useClubs();

  const {
    data: feedData,
    isLoading: feedLoading,
    isError: feedError,
    refetch: refetchFeed,
  } = useCommunityFeed(10);
  const feedPosts = feedData?.posts || [];

  const {
    data: articles = [],
    isLoading: articlesLoading,
    isError: articlesError,
    refetch: refetchArticles,
  } = useArticles();

  const {
    data: events = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useEvents('upcoming');

  const joinClubMutation = useJoinClub();
  const leaveClubMutation = useLeaveClub();

  const joinedClubIds = React.useMemo(() => {
    return new Set(clubs.filter((c) => Boolean(c.is_member)).map((c) => c.id));
  }, [clubs]);

  const isRefreshing = clubsLoading || feedLoading || articlesLoading || eventsLoading;

  const handleRefreshAll = async () => {
    await Promise.all([
      refetchClubs(),
      refetchFeed(),
      refetchArticles(),
      refetchEvents(),
    ]);
  };

  const handleJoinToggle = (clubId: string, isJoining: boolean) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    if (isJoining) {
      joinClubMutation.mutate(clubId);
    } else {
      leaveClubMutation.mutate(clubId);
    }
  };

  const canAuthorContent =
    user?.isVetVerified === true ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('vet');

  const handleCreatePost = () => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    router.push('/community/create-post' as any);
  };

  return (
    <Screen
      scrollable
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefreshAll}
            colors={[colors.primaryDark]}
            tintColor={colors.primaryDark}
          />
        ),
      }}
    >
      {/* 1. Header & Community Title */}
      <View style={styles.header} testID="community-hub-header">
        <View style={styles.headerTitles}>
          <Heading level={1}>Community Hub</Heading>
          <Text variant="bodyMd" color={colors.muted}>
            Clubs, discussions, veterinary blogs & pet events
          </Text>
        </View>

        <TouchableOpacity
          style={styles.createPostBtn}
          onPress={handleCreatePost}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Create community post"
          testID="btn-hub-create-post"
        >
          <Plus size={16} color={colors.ink} />
          <Text variant="bodySm" color={colors.ink} style={styles.createPostBtnText}>
            Post
          </Text>
        </TouchableOpacity>
      </View>

      {/* 2. Veterinarian & Admin Editorial Banner */}
      {canAuthorContent && (
        <Card style={styles.vetBanner} testID="vet-editorial-banner">
          <View style={styles.vetBannerContent}>
            <View style={styles.vetBannerIconBox}>
              <Sparkles size={18} color={colors.ink} />
            </View>
            <View style={{ flex: 1 }}>
              <Heading level={4} style={styles.vetBannerTitle}>
                Verified Clinical Contributor
              </Heading>
              <Text variant="caption" color={colors.inkSoft}>
                Share medical expertise through articles or host community webinars.
              </Text>
            </View>
          </View>
          <View style={styles.vetActionRow}>
            <Button
              title="Write Article"
              size="sm"
              variant="outline"
              leftIcon={<PenSquare size={14} color={colors.ink} />}
              onPress={() => router.push('/articles/create' as any)}
              style={styles.vetActionBtn}
              testID="btn-hub-write-article"
            />
            <Button
              title="Host Event"
              size="sm"
              variant="outline"
              leftIcon={<Calendar size={14} color={colors.ink} />}
              onPress={() => router.push('/events/create' as any)}
              style={styles.vetActionBtn}
              testID="btn-hub-host-event"
            />
          </View>
        </Card>
      )}

      {/* 3. Segmented Navigation Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
        style={styles.tabsContainer}
      >
        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'overview' && styles.tabChipActive]}
          onPress={() => setActiveTab('overview')}
          activeOpacity={0.7}
          testID="tab-community-overview"
        >
          <Text
            variant="bodySm"
            color={activeTab === 'overview' ? colors.ink : colors.muted}
            style={activeTab === 'overview' ? styles.tabTextActive : styles.tabText}
          >
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'feed' && styles.tabChipActive]}
          onPress={() => setActiveTab('feed')}
          activeOpacity={0.7}
          testID="tab-community-feed"
        >
          <MessageSquare
            size={14}
            color={activeTab === 'feed' ? colors.ink : colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text
            variant="bodySm"
            color={activeTab === 'feed' ? colors.ink : colors.muted}
            style={activeTab === 'feed' ? styles.tabTextActive : styles.tabText}
          >
            Discussions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'clubs' && styles.tabChipActive]}
          onPress={() => setActiveTab('clubs')}
          activeOpacity={0.7}
          testID="tab-community-clubs"
        >
          <Users
            size={14}
            color={activeTab === 'clubs' ? colors.ink : colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text
            variant="bodySm"
            color={activeTab === 'clubs' ? colors.ink : colors.muted}
            style={activeTab === 'clubs' ? styles.tabTextActive : styles.tabText}
          >
            Clubs ({clubs.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'articles' && styles.tabChipActive]}
          onPress={() => setActiveTab('articles')}
          activeOpacity={0.7}
          testID="tab-community-articles"
        >
          <BookOpen
            size={14}
            color={activeTab === 'articles' ? colors.ink : colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text
            variant="bodySm"
            color={activeTab === 'articles' ? colors.ink : colors.muted}
            style={activeTab === 'articles' ? styles.tabTextActive : styles.tabText}
          >
            Articles ({articles.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabChip, activeTab === 'events' && styles.tabChipActive]}
          onPress={() => setActiveTab('events')}
          activeOpacity={0.7}
          testID="tab-community-events"
        >
          <Calendar
            size={14}
            color={activeTab === 'events' ? colors.ink : colors.muted}
            style={{ marginRight: 6 }}
          />
          <Text
            variant="bodySm"
            color={activeTab === 'events' ? colors.ink : colors.muted}
            style={activeTab === 'events' ? styles.tabTextActive : styles.tabText}
          >
            Events ({events.length})
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 4. TAB CONTENTS */}

      {/* --- OVERVIEW TAB --- */}
      {activeTab === 'overview' && (
        <View testID="view-community-overview">
          {/* Quick Hub Navigation Cards */}
          <View style={styles.gridSection}>
            <View style={styles.gridRow}>
              {/* Pet Clubs */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => setActiveTab('clubs')}
                activeOpacity={0.8}
                testID="card-shortcut-clubs"
              >
                <Card style={styles.shortcutCard}>
                  <View style={[styles.shortcutIconBox, { backgroundColor: '#E8F5E9' }]}>
                    <Users size={20} color="#2E7D32" />
                  </View>
                  <Heading level={4} style={styles.shortcutTitle}>
                    Animal Clubs
                  </Heading>
                  <Text variant="caption" color={colors.inkSoft}>
                    6 species clubs & breed groups
                  </Text>
                </Card>
              </TouchableOpacity>

              {/* Discussions Feed */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => setActiveTab('feed')}
                activeOpacity={0.8}
                testID="card-shortcut-feed"
              >
                <Card style={styles.shortcutCard}>
                  <View style={[styles.shortcutIconBox, { backgroundColor: '#E3F2FD' }]}>
                    <MessageSquare size={20} color="#1565C0" />
                  </View>
                  <Heading level={4} style={styles.shortcutTitle}>
                    Discussions
                  </Heading>
                  <Text variant="caption" color={colors.inkSoft}>
                    Global feed & community stories
                  </Text>
                </Card>
              </TouchableOpacity>
            </View>

            <View style={styles.gridRow}>
              {/* Articles */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => setActiveTab('articles')}
                activeOpacity={0.8}
                testID="card-shortcut-articles"
              >
                <Card style={styles.shortcutCard}>
                  <View style={[styles.shortcutIconBox, { backgroundColor: '#FFF3E0' }]}>
                    <BookOpen size={20} color="#E65100" />
                  </View>
                  <Heading level={4} style={styles.shortcutTitle}>
                    Vet Articles
                  </Heading>
                  <Text variant="caption" color={colors.inkSoft}>
                    Clinical wellness & pet guides
                  </Text>
                </Card>
              </TouchableOpacity>

              {/* Events */}
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => setActiveTab('events')}
                activeOpacity={0.8}
                testID="card-shortcut-events"
              >
                <Card style={styles.shortcutCard}>
                  <View style={[styles.shortcutIconBox, { backgroundColor: '#F3E5F5' }]}>
                    <Calendar size={20} color="#7B1FA2" />
                  </View>
                  <Heading level={4} style={styles.shortcutTitle}>
                    Events
                  </Heading>
                  <Text variant="caption" color={colors.inkSoft}>
                    Webinars, clinics & meetups
                  </Text>
                </Card>
              </TouchableOpacity>
            </View>
          </View>

          {/* Section: Animal Clubs Spotlight */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Heading level={3}>Animal Clubs</Heading>
                <Text variant="caption" color={colors.muted}>
                  Find breed-specific tips and like-minded guardians
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/clubs' as any)}
                activeOpacity={0.7}
                testID="btn-see-all-clubs"
              >
                <View style={styles.seeAllRow}>
                  <Text variant="caption" color={colors.primaryDark} style={styles.seeAllText}>
                    See All
                  </Text>
                  <ArrowRight size={14} color={colors.primaryDark} />
                </View>
              </TouchableOpacity>
            </View>

            {clubsLoading ? (
              <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.md }} />
            ) : clubs.length > 0 ? (
              <View style={styles.clubsList}>
                {clubs.slice(0, 3).map((club) => (
                  <ClubCard
                    key={club.id}
                    club={club}
                    onJoinToggle={handleJoinToggle}
                    isJoiningLoading={joinClubMutation.isPending || leaveClubMutation.isPending}
                  />
                ))}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text variant="bodySm" color={colors.muted}>
                  No animal clubs currently available.
                </Text>
              </Card>
            )}
          </View>

          {/* Section: Recent Discussions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Heading level={3}>Recent Discussions</Heading>
                <Text variant="caption" color={colors.muted}>
                  Latest posts from pet parents & veterinarians
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/community/feed' as any)}
                activeOpacity={0.7}
                testID="btn-see-all-feed"
              >
                <View style={styles.seeAllRow}>
                  <Text variant="caption" color={colors.primaryDark} style={styles.seeAllText}>
                    Full Feed
                  </Text>
                  <ArrowRight size={14} color={colors.primaryDark} />
                </View>
              </TouchableOpacity>
            </View>

            {feedLoading ? (
              <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.md }} />
            ) : feedPosts.length > 0 ? (
              <View style={styles.feedList}>
                {feedPosts.slice(0, 3).map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    isMember={!post.club_id || joinedClubIds.has(post.club_id)}
                  />
                ))}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text variant="bodySm" color={colors.muted}>
                  No community posts yet. Be the first to start a discussion!
                </Text>
                <Button
                  title="Create First Post"
                  size="sm"
                  onPress={handleCreatePost}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            )}
          </View>

          {/* Section: Educational Articles */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Heading level={3}>Veterinary Insights</Heading>
                <Text variant="caption" color={colors.muted}>
                  Evidence-based pet health & wellness articles
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/articles' as any)}
                activeOpacity={0.7}
                testID="btn-see-all-articles"
              >
                <View style={styles.seeAllRow}>
                  <Text variant="caption" color={colors.primaryDark} style={styles.seeAllText}>
                    All Articles
                  </Text>
                  <ArrowRight size={14} color={colors.primaryDark} />
                </View>
              </TouchableOpacity>
            </View>

            {articlesLoading ? (
              <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.md }} />
            ) : articles.length > 0 ? (
              <View style={styles.articlesList}>
                {articles.slice(0, 2).map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text variant="bodySm" color={colors.muted}>
                  No educational articles found.
                </Text>
              </Card>
            )}
          </View>

          {/* Section: Upcoming Events */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Heading level={3}>Community Events</Heading>
                <Text variant="caption" color={colors.muted}>
                  Upcoming webinars, clinics & pet meetups
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/events' as any)}
                activeOpacity={0.7}
                testID="btn-see-all-events"
              >
                <View style={styles.seeAllRow}>
                  <Text variant="caption" color={colors.primaryDark} style={styles.seeAllText}>
                    All Events
                  </Text>
                  <ArrowRight size={14} color={colors.primaryDark} />
                </View>
              </TouchableOpacity>
            </View>

            {eventsLoading ? (
              <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.md }} />
            ) : events.length > 0 ? (
              <View style={styles.eventsList}>
                {events.slice(0, 2).map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </View>
            ) : (
              <Card style={styles.emptyCard}>
                <Text variant="bodySm" color={colors.muted}>
                  No upcoming community events scheduled right now.
                </Text>
              </Card>
            )}
          </View>
        </View>
      )}

      {/* --- DISCUSSIONS (FEED) TAB --- */}
      {activeTab === 'feed' && (
        <View testID="view-community-feed-tab">
          <View style={styles.feedHeaderRow}>
            <View style={{ flex: 1 }}>
              <Heading level={3}>Community Discussions</Heading>
              <Text variant="bodySm" color={colors.muted}>
                Live conversation across all clubs and general pet parenthood
              </Text>
            </View>
            <Button
              title="Full Screen Feed"
              size="sm"
              variant="outline"
              onPress={() => router.push('/community/feed' as any)}
              testID="btn-open-full-feed"
            />
          </View>

          {feedLoading ? (
            <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.xl }} />
          ) : feedError ? (
            <Card style={styles.errorCard}>
              <AlertCircle size={20} color={colors.destructive} />
              <Text variant="bodySm" color={colors.destructive} style={{ marginTop: spacing.xs }}>
                Unable to load community discussions.
              </Text>
              <Button title="Retry" size="sm" variant="outline" onPress={() => refetchFeed()} style={{ marginTop: spacing.sm }} />
            </Card>
          ) : feedPosts.length > 0 ? (
            <View style={styles.feedList}>
              {feedPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  isMember={!post.club_id || joinedClubIds.has(post.club_id)}
                />
              ))}
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Text variant="bodySm" color={colors.muted}>
                No discussions in the community feed yet.
              </Text>
              <Button
                title="Start a Discussion"
                size="sm"
                onPress={handleCreatePost}
                style={{ marginTop: spacing.md }}
              />
            </Card>
          )}
        </View>
      )}

      {/* --- CLUBS TAB --- */}
      {activeTab === 'clubs' && (
        <View testID="view-community-clubs-tab">
          <View style={styles.feedHeaderRow}>
            <View style={{ flex: 1 }}>
              <Heading level={3}>All Animal Clubs</Heading>
              <Text variant="bodySm" color={colors.muted}>
                Join clubs matching your companions to unlock specialized feeds
              </Text>
            </View>
            <Button
              title="Clubs Directory"
              size="sm"
              variant="outline"
              onPress={() => router.push('/clubs' as any)}
              testID="btn-open-clubs-dir"
            />
          </View>

          {clubsLoading ? (
            <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.xl }} />
          ) : clubsError ? (
            <Card style={styles.errorCard}>
              <AlertCircle size={20} color={colors.destructive} />
              <Text variant="bodySm" color={colors.destructive} style={{ marginTop: spacing.xs }}>
                Unable to load animal clubs.
              </Text>
              <Button title="Retry" size="sm" variant="outline" onPress={() => refetchClubs()} style={{ marginTop: spacing.sm }} />
            </Card>
          ) : clubs.length > 0 ? (
            <View style={styles.clubsList}>
              {clubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  onJoinToggle={handleJoinToggle}
                  isJoiningLoading={joinClubMutation.isPending || leaveClubMutation.isPending}
                />
              ))}
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Text variant="bodySm" color={colors.muted}>
                No clubs found.
              </Text>
            </Card>
          )}
        </View>
      )}

      {/* --- ARTICLES TAB --- */}
      {activeTab === 'articles' && (
        <View testID="view-community-articles-tab">
          <View style={styles.feedHeaderRow}>
            <View style={{ flex: 1 }}>
              <Heading level={3}>Veterinary Educational Articles</Heading>
              <Text variant="bodySm" color={colors.muted}>
                Care guidelines verified by licensed practitioners
              </Text>
            </View>
            <Button
              title="Articles Directory"
              size="sm"
              variant="outline"
              onPress={() => router.push('/articles' as any)}
              testID="btn-open-articles-dir"
            />
          </View>

          {articlesLoading ? (
            <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.xl }} />
          ) : articlesError ? (
            <Card style={styles.errorCard}>
              <AlertCircle size={20} color={colors.destructive} />
              <Text variant="bodySm" color={colors.destructive} style={{ marginTop: spacing.xs }}>
                Unable to load educational articles.
              </Text>
              <Button title="Retry" size="sm" variant="outline" onPress={() => refetchArticles()} style={{ marginTop: spacing.sm }} />
            </Card>
          ) : articles.length > 0 ? (
            <View style={styles.articlesList}>
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Text variant="bodySm" color={colors.muted}>
                No educational articles available.
              </Text>
            </Card>
          )}
        </View>
      )}

      {/* --- EVENTS TAB --- */}
      {activeTab === 'events' && (
        <View testID="view-community-events-tab">
          <View style={styles.feedHeaderRow}>
            <View style={{ flex: 1 }}>
              <Heading level={3}>Community Events & Webinars</Heading>
              <Text variant="bodySm" color={colors.muted}>
                Upcoming live sessions and local pet community gatherings
              </Text>
            </View>
            <Button
              title="Events Directory"
              size="sm"
              variant="outline"
              onPress={() => router.push('/events' as any)}
              testID="btn-open-events-dir"
            />
          </View>

          {eventsLoading ? (
            <ActivityIndicator size="small" color={colors.primaryDark} style={{ padding: spacing.xl }} />
          ) : eventsError ? (
            <Card style={styles.errorCard}>
              <AlertCircle size={20} color={colors.destructive} />
              <Text variant="bodySm" color={colors.destructive} style={{ marginTop: spacing.xs }}>
                Unable to load community events.
              </Text>
              <Button title="Retry" size="sm" variant="outline" onPress={() => refetchEvents()} style={{ marginTop: spacing.sm }} />
            </Card>
          ) : events.length > 0 ? (
            <View style={styles.eventsList}>
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Text variant="bodySm" color={colors.muted}>
                No upcoming community events found.
              </Text>
            </Card>
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
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
    paddingTop: spacing.xs,
  },
  headerTitles: {
    flex: 1,
    marginRight: spacing.sm,
  },
  createPostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  createPostBtnText: {
    fontWeight: '700',
    marginLeft: 4,
  },
  vetBanner: {
    backgroundColor: '#EBF8D3',
    borderColor: colors.primaryDark,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  vetBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  vetBannerIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  vetBannerTitle: {
    color: colors.ink,
  },
  vetActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  vetActionBtn: {
    flex: 1,
    backgroundColor: colors.white,
  },
  tabsContainer: {
    marginBottom: spacing.xl,
  },
  tabsScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  tabText: {
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
    color: colors.ink,
  },
  gridSection: {
    marginBottom: spacing.xl,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  gridCard: {
    flex: 1,
  },
  shortcutCard: {
    padding: spacing.md,
    height: 120,
    justifyContent: 'space-between',
  },
  shortcutIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutTitle: {
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing['2xl'],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  seeAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 4,
  },
  seeAllText: {
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  clubsList: {
    gap: spacing.md,
  },
  feedList: {
    gap: spacing.md,
  },
  articlesList: {
    gap: spacing.md,
  },
  eventsList: {
    gap: spacing.md,
  },
  feedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
  },
  errorCard: {
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
});
