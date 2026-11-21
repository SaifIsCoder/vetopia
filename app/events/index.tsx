import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Plus, Calendar } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Chip } from '../../src/components/ui/Chip';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { EventCard } from '../../src/components/events/EventCard';
import { useEvents } from '../../src/hooks/useEvents';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

const EVENT_CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'Webinar', label: 'Webinars' },
  { id: 'Vaccination Clinic', label: 'Vaccination Clinics' },
  { id: 'Adoption Fair', label: 'Adoption Fairs' },
  { id: 'Breed Meetup', label: 'Breed Meetups' },
  { id: 'Training Workshop', label: 'Training Workshops' },
];

export default function EventsDirectoryScreen() {
  const router = useRouter();
  const { user, role } = useAuthStore();
  const [filterMode, setFilterMode] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const {
    data: events = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useEvents(filterMode, selectedCategory);

  const canCreate =
    role === 'admin' ||
    user?.isVet === true ||
    user?.isVetVerified === true ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('vet');

  const handleRefresh = async () => {
    await refetch();
  };

  const handleCreateEvent = () => {
    router.push('/events/create' as any);
  };

  if (isLoading) {
    return (
      <Screen scrollable testID="events-loading-screen">
        <View style={styles.header}>
          <Skeleton width={140} height={28} />
          <Skeleton width={100} height={32} style={{ borderRadius: radii.pill }} />
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <Skeleton width="100%" height={180} style={{ borderRadius: radii.md }} />
          <Skeleton width="100%" height={180} style={{ borderRadius: radii.md }} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scrollable testID="events-error-screen">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={2}>Community Events</Heading>
        </View>
        <ErrorState
          title="Could not load events"
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
      testID="events-directory-screen"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="btn-events-back"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Heading level={2} style={styles.title}>
            Community Events
          </Heading>
          <Text variant="caption" color={colors.muted}>
            Webinars, outreach clinics & pet meetups
          </Text>
        </View>

        {canCreate ? (
          <Button
            title="Create"
            variant="primary"
            size="sm"
            onPress={handleCreateEvent}
            leftIcon={<Plus size={14} color={colors.ink} />}
            style={styles.createBtn}
            testID="btn-create-event"
          />
        ) : null}
      </View>

      {/* Filter Mode Tabs (Upcoming vs Past) */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabBtn, filterMode === 'upcoming' && styles.tabBtnActive]}
          onPress={() => setFilterMode('upcoming')}
          accessibilityRole="button"
          accessibilityLabel="Show upcoming events"
          testID="tab-upcoming-events"
        >
          <Text
            variant="bodySm"
            color={filterMode === 'upcoming' ? colors.primaryDark : colors.muted}
            style={filterMode === 'upcoming' ? styles.tabTextActive : styles.tabText}
          >
            Upcoming Events
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, filterMode === 'past' && styles.tabBtnActive]}
          onPress={() => setFilterMode('past')}
          accessibilityRole="button"
          accessibilityLabel="Show past events"
          testID="tab-past-events"
        >
          <Text
            variant="bodySm"
            color={filterMode === 'past' ? colors.primaryDark : colors.muted}
            style={filterMode === 'past' ? styles.tabTextActive : styles.tabText}
          >
            Past Archive
          </Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {EVENT_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Chip
                key={cat.id}
                label={cat.label}
                selected={isSelected}
                onPress={() => setSelectedCategory(cat.id)}
                testID={`chip-event-category-${cat.id}`}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Events List */}
      {events.length === 0 ? (
        <EmptyState
          title={filterMode === 'upcoming' ? 'No Upcoming Events' : 'No Past Events'}
          description={
            filterMode === 'upcoming'
              ? 'There are no upcoming scheduled events in this category right now. Check back soon or explore webinars!'
              : 'There are no past events archived in this category.'
          }
          icon={<Calendar size={48} color={colors.muted} />}
          actionTitle={selectedCategory !== 'all' ? 'View All Categories' : undefined}
          onAction={selectedCategory !== 'all' ? () => setSelectedCategory('all') : undefined}
        />
      ) : (
        <View style={styles.eventsList}>
          {events.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
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
    minWidth: 84,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    padding: 3,
    marginBottom: spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  tabBtnActive: {
    backgroundColor: colors.white,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontWeight: '500',
  },
  tabTextActive: {
    fontWeight: '700',
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  eventsList: {
    marginTop: spacing.xs,
  },
});
