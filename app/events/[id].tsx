import React from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Linking,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Video,
  ShieldCheck,
  Edit2,
  Trash2,
  Share2,
  ExternalLink,
  XCircle,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Button } from '../../src/components/ui/Button';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import {
  useEvent,
  useCancelEvent,
  useDeleteEvent,
} from '../../src/hooks/useEvents';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, role } = useAuthStore();

  const { data: event, isLoading, isError, error, refetch } = useEvent(id || '');
  const cancelMutation = useCancelEvent();
  const deleteMutation = useDeleteEvent();

  const isOrganizer = user?.id === event?.organizer_id;
  const isAdmin = role === 'admin';
  const canManage = isOrganizer || isAdmin;

  const isPast = event?.status === 'completed';
  const isCancelled = event?.status === 'cancelled';

  const formatEventDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatEventTime = (startStr: string, endStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const startTime = start.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      const endTime = end.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      });
      return `${startTime} – ${endTime}`;
    } catch {
      return '';
    }
  };

  const handleShare = async () => {
    if (!event) return;
    try {
      await Share.share({
        title: event.title,
        message: `${event.title}\n\nDate: ${formatEventDate(event.start_time)}\n${event.description}`,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleJoinVirtual = async () => {
    if (!event?.location_or_url) return;
    let url = event.location_or_url.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to Open Link', `Cannot open the virtual meeting link: ${url}`);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not open meeting link.');
    }
  };

  const handleOpenMaps = async () => {
    if (!event?.location_or_url) return;
    const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(
      event.location_or_url.trim(),
    )}`;
    try {
      await Linking.openURL(mapUrl);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not open map navigation.');
    }
  };

  const handleEditPress = () => {
    if (!event) return;
    router.push({
      pathname: '/events/create' as any,
      params: { eventId: event.id },
    });
  };

  const handleCancelPress = () => {
    if (!event) return;
    Alert.alert(
      'Cancel Event',
      `Are you sure you want to cancel "${event.title}"? Attendees will be informed that this event is cancelled.`,
      [
        { text: 'Keep Active', style: 'cancel' },
        {
          text: 'Cancel Event',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelMutation.mutateAsync(event.id);
              Alert.alert('Event Cancelled', 'The event status has been set to cancelled.');
            } catch (err: any) {
              Alert.alert('Failed to Cancel', err?.message || 'Could not cancel event.');
            }
          },
        },
      ],
    );
  };

  const handleDeletePress = () => {
    if (!event) return;
    Alert.alert(
      'Delete Event',
      `Are you sure you want to permanently delete "${event.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(event.id);
              Alert.alert('Event Deleted', 'The event has been permanently removed.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Could not delete event.');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <Screen scrollable testID="event-detail-loading">
        <Skeleton width="100%" height={220} style={{ borderRadius: radii.md }} />
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Skeleton width="40%" height={24} />
          <Skeleton width="90%" height={32} />
          <Skeleton width="70%" height={24} />
          <Skeleton width="100%" height={100} style={{ marginTop: spacing.md }} />
        </View>
      </Screen>
    );
  }

  if (isError || !event) {
    return (
      <Screen scrollable testID="event-detail-error">
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={2}>Event</Heading>
        </View>
        <ErrorState
          title="Event Not Found"
          message={(error as Error)?.message || 'The requested event could not be loaded.'}
          onRetry={refetch}
        />
      </Screen>
    );
  }

  return (
    <Screen scrollable testID="event-detail-screen">
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="btn-event-back"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.navRightControls}>
          <TouchableOpacity
            onPress={handleShare}
            style={styles.controlBtn}
            accessibilityLabel="Share event"
            accessibilityRole="button"
            testID="btn-share-event"
          >
            <Share2 size={16} color={colors.ink} />
          </TouchableOpacity>

          {canManage ? (
            <View style={styles.actionControls}>
              <TouchableOpacity
                onPress={handleEditPress}
                style={styles.controlBtn}
                accessibilityLabel="Edit event"
                accessibilityRole="button"
                testID="btn-edit-event"
              >
                <Edit2 size={16} color={colors.ink} />
              </TouchableOpacity>

              {!isCancelled && event.status !== 'completed' ? (
                <TouchableOpacity
                  onPress={handleCancelPress}
                  style={[styles.controlBtn, { backgroundColor: '#FEF3C7' }]}
                  accessibilityLabel="Cancel event"
                  accessibilityRole="button"
                  testID="btn-cancel-event"
                >
                  <XCircle size={16} color="#D97706" />
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                onPress={handleDeletePress}
                style={[styles.controlBtn, { backgroundColor: '#FEE2E2' }]}
                accessibilityLabel="Delete event"
                accessibilityRole="button"
                testID="btn-delete-event"
              >
                <Trash2 size={16} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </View>

      {/* Hero Cover Image */}
      {event.cover_image ? (
        <View style={styles.coverImageContainer}>
          <Image
            source={{ uri: event.cover_image }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Event Header & Badges */}
      <View style={styles.headerSection}>
        <View style={styles.badgeRow}>
          <View style={styles.categoryBadge}>
            <Text variant="caption" style={styles.categoryBadgeText}>
              {event.category}
            </Text>
          </View>
          <View style={styles.formatBadge}>
            <Text variant="caption" style={styles.formatBadgeText}>
              {event.event_type === 'virtual' ? 'Virtual Webinar' : 'In-Person'}
            </Text>
          </View>
          {isCancelled ? (
            <Badge variant="cancelled" label="CANCELLED" />
          ) : isPast ? (
            <Badge variant="completed" label="PAST EVENT" />
          ) : event.status === 'draft' ? (
            <Badge variant="pending" label="DRAFT" />
          ) : (
            <Badge variant="verified" label="UPCOMING" />
          )}
        </View>

        <Heading level={1} style={styles.eventTitle}>
          {event.title}
        </Heading>

        {isCancelled ? (
          <Card style={styles.cancelledBanner}>
            <View style={styles.alertHeader}>
              <XCircle size={18} color={colors.destructive} />
              <Heading level={4} style={{ color: colors.destructive }}>
                Event Cancelled
              </Heading>
            </View>
            <Text variant="bodySm" color={colors.destructive}>
              This event was cancelled by the organizer. Scheduled sessions and registrations are suspended.
            </Text>
          </Card>
        ) : null}
      </View>

      {/* Date, Time & Logistics Card */}
      <Card style={styles.logisticsCard}>
        <View style={styles.logisticItem}>
          <View style={styles.logisticIconContainer}>
            <Calendar size={20} color={colors.primary} />
          </View>
          <View style={styles.logisticText}>
            <Heading level={4}>{formatEventDate(event.start_time)}</Heading>
            <Text variant="bodySm" color={colors.inkSoft}>
              {formatEventTime(event.start_time, event.end_time)}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.logisticItem}>
          <View style={styles.logisticIconContainer}>
            {event.event_type === 'virtual' ? (
              <Video size={20} color={colors.primary} />
            ) : (
              <MapPin size={20} color={colors.primary} />
            )}
          </View>
          <View style={styles.logisticText}>
            <Heading level={4}>
              {event.event_type === 'virtual' ? 'Online Live Session' : 'Event Location'}
            </Heading>
            <Text variant="bodySm" color={colors.inkSoft} numberOfLines={2}>
              {event.location_or_url}
            </Text>
          </View>
        </View>

        {/* Action Button for Logistics */}
        {!isCancelled && (
          <View style={{ marginTop: spacing.md }}>
            {event.event_type === 'virtual' ? (
              <Button
                title="Join Virtual Meeting"
                onPress={handleJoinVirtual}
                testID="btn-join-virtual"
                leftIcon={<ExternalLink size={16} color={colors.ink} />}
              />
            ) : (
              <Button
                title="Open Location in Maps"
                variant="outline"
                onPress={handleOpenMaps}
                testID="btn-open-maps"
                leftIcon={<MapPin size={16} color={colors.primary} />}
              />
            )}
          </View>
        )}
      </Card>

      {/* Event Description Section */}
      <View style={styles.descriptionSection}>
        <Heading level={3} style={styles.sectionHeading}>
          About This Event
        </Heading>
        <Text variant="bodyMd" color={colors.ink} style={styles.descriptionText}>
          {event.description}
        </Text>
      </View>

      {/* Organizer Profile Card */}
      <Card style={styles.organizerCard}>
        <Heading level={4} style={{ marginBottom: spacing.sm }}>
          Organized By
        </Heading>
        <View style={styles.organizerRow}>
          <Avatar
            name={event.organizer_name || 'Event Organizer'}
            source={event.organizer?.avatar_url || undefined}
            size={48}
          />
          <View style={styles.organizerMeta}>
            <View style={styles.organizerNameRow}>
              <Heading level={4}>{event.organizer_name}</Heading>
              {event.is_vet_verified ? (
                <View style={styles.vetBadge}>
                  <ShieldCheck size={12} color="#15803D" />
                  <Text variant="caption" style={styles.vetBadgeText}>
                    Verified Vet
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" color={colors.inkSoft}>
              Community Event Organizer
            </Text>
          </View>
        </View>
      </Card>

      <View style={{ height: spacing['2xl'] }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  headerSection: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  categoryBadge: {
    backgroundColor: `${colors.primary}25`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  formatBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formatBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  eventTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  cancelledBanner: {
    marginTop: spacing.sm,
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    padding: spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 4,
  },
  logisticsCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  logisticItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logisticIconContainer: {
    width: 42,
    height: 42,
    borderRadius: radii.md,
    backgroundColor: `${colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  logisticText: {
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  descriptionSection: {
    marginBottom: spacing.md,
  },
  sectionHeading: {
    marginBottom: spacing.xs,
  },
  descriptionText: {
    lineHeight: 24,
  },
  organizerCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerMeta: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  organizerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  vetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    gap: 3,
  },
  vetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
});
