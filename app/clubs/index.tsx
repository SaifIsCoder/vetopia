import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Globe } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { Chip } from '../../src/components/ui/Chip';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { ClubCard } from '../../src/components/clubs/ClubCard';
import { useClubs, useJoinedClubs, useJoinClub, useLeaveClub } from '../../src/hooks/useClubs';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

const CLUB_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'Dogs', label: 'Dogs' },
  { id: 'Cats', label: 'Cats' },
  { id: 'Birds', label: 'Birds' },
  { id: 'Horses', label: 'Horses' },
  { id: 'Farm Animals', label: 'Farm Animals' },
  { id: 'Poultry', label: 'Poultry' },
];

export default function ClubsHomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const {
    data: clubs = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useClubs(searchQuery, selectedCategory);

  const { data: joinedClubs = [], refetch: refetchJoined } = useJoinedClubs();

  const joinMutation = useJoinClub();
  const leaveMutation = useLeaveClub();

  const handleJoinToggle = async (clubId: string, isJoining: boolean) => {
    if (!user) {
      Alert.alert(
        'Sign In Required',
        'Please sign in to join clubs and participate in discussions.',
      );
      return;
    }

    const targetClub = clubs.find((c) => c.id === clubId);

    if (!isJoining) {
      Alert.alert(
        'Leave Club',
        `Are you sure you want to leave ${targetClub?.name || 'this club'}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: async () => {
              try {
                await leaveMutation.mutateAsync(clubId);
              } catch (err: any) {
                Alert.alert('Action Failed', err?.message || 'Could not update membership.');
              }
            },
          },
        ],
      );
      return;
    }

    try {
      await joinMutation.mutateAsync(clubId);
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not update membership.');
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refetch(), refetchJoined()]);
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

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
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Heading level={1} style={styles.title}>
            Pet Clubs
          </Heading>
          <Text variant="bodySm" color={colors.muted}>
            Connect with dedicated animal communities & veterinarians
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/community/feed' as any)}
          style={styles.feedBtn}
          accessibilityLabel="Open global community feed"
          accessibilityRole="button"
          testID="btn-open-community-feed"
        >
          <Globe size={16} color={colors.primaryDark} style={{ marginRight: 4 }} />
          <Text variant="caption" color={colors.primaryDark} style={styles.feedBtnText}>
            Feed
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="Search dogs, cats, equine, poultry..."
        />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CLUB_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Chip
                key={cat.id}
                label={cat.label}
                selected={isSelected}
                onPress={() => setSelectedCategory(cat.id)}
                testID={`category-chip-${cat.id.toLowerCase().replace(/\s+/g, '-')}`}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${cat.label}`}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Loading Skeletons */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map((key) => (
            <ClubCard.Skeleton key={key} />
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title="Could not load Pet Clubs"
          message={error?.message || 'Please check your connection and try again.'}
          onRetry={refetch}
        />
      ) : (
        <>
          {/* Joined Clubs Horizontal Section (if user has joined any and not actively searching/filtering) */}
          {!searchQuery && selectedCategory === 'all' && joinedClubs.length > 0 ? (
            <View style={styles.joinedSection}>
              <View style={styles.sectionHeader}>
                <Heading level={3}>My Joined Clubs</Heading>
                <Badge variant="verified" label={`${joinedClubs.length} Active`} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.joinedScroll}
              >
                {joinedClubs.map((club) => (
                  <TouchableOpacity
                    key={club.id}
                    onPress={() => router.push(`/clubs/${club.id}` as any)}
                    style={styles.joinedChip}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={`Open joined club: ${club.name}`}
                  >
                    <Avatar
                      name={club.name}
                      source={club.cover_image || undefined}
                      size={36}
                    />
                    <View style={styles.joinedChipInfo}>
                      <Text variant="bodySm" style={styles.joinedChipName} numberOfLines={1}>
                        {club.name}
                      </Text>
                      <Text variant="caption" color={colors.muted}>
                        {club.member_count} members
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Explore All Clubs Section */}
          <View style={styles.allSection}>
            <View style={styles.sectionHeader}>
              <Heading level={3}>
                {searchQuery
                  ? `Search Results (${clubs.length})`
                  : selectedCategory !== 'all'
                    ? `${selectedCategory} Clubs (${clubs.length})`
                    : 'Explore All Clubs'}
              </Heading>
              {!searchQuery && selectedCategory === 'all' ? (
                <Text variant="caption" color={colors.inkSoft}>
                  6 Specialized Communities
                </Text>
              ) : null}
            </View>

            {clubs.length === 0 ? (
              <EmptyState
                title="No Pet Clubs Found"
                description={
                  searchQuery || selectedCategory !== 'all'
                    ? `No clubs matching "${searchQuery || selectedCategory}". Try selecting another category or clearing filters.`
                    : 'No pet clubs are currently available.'
                }
                actionTitle={
                  searchQuery || selectedCategory !== 'all' ? 'Clear Filters' : undefined
                }
                onAction={
                  searchQuery || selectedCategory !== 'all' ? handleClearFilters : undefined
                }
              />
            ) : (
              clubs.map((club) => (
                <ClubCard
                  key={club.id}
                  club={club}
                  onJoinToggle={handleJoinToggle}
                  isJoiningLoading={
                    (joinMutation.isPending && joinMutation.variables === club.id) ||
                    (leaveMutation.isPending && leaveMutation.variables === club.id)
                  }
                />
              ))
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    marginRight: spacing.sm,
    marginTop: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  headerTitleContainer: {
    flex: 1,
  },
  title: {
    marginBottom: 2,
  },
  feedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
    marginTop: 4,
  },
  feedBtnText: {
    fontWeight: '700',
  },
  searchSection: {
    marginBottom: spacing.sm,
  },
  categorySection: {
    marginBottom: spacing.lg,
  },
  categoryScroll: {
    paddingRight: spacing.md,
    gap: spacing.xs,
  },
  loadingContainer: {
    gap: spacing.md,
  },
  joinedSection: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  joinedScroll: {
    paddingRight: spacing.md,
    gap: spacing.sm,
  },
  joinedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 160,
    maxWidth: 200,
  },
  joinedChipInfo: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  joinedChipName: {
    fontWeight: '600',
  },
  allSection: {
    marginBottom: spacing.xl,
  },
});
