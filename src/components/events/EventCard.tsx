import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Calendar, Clock, Video, MapPin, ShieldCheck } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { CommunityEvent } from '../../types/event';
import { Card } from '../ui/Card';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface EventCardProps {
  event: CommunityEvent;
  onPress?: (event: CommunityEvent) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onPress }) => {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress(event);
    } else {
      router.push(`/events/${event.id}` as any);
    }
  };

  const formatEventDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      const day = d.getDate();
      return { month, day };
    } catch {
      return { month: 'EVT', day: '--' };
    }
  };

  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const dateObj = formatEventDate(event.start_time);
  const timeStr = `${formatTime(event.start_time)} – ${formatTime(event.end_time)}`;
  const isVirtual = event.event_type === 'virtual';

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Event: ${event.title}. ${isVirtual ? 'Virtual webinar' : 'In-person event'}. Starts ${dateObj.month} ${dateObj.day}.`}
      testID={`event-card-${event.id}`}
    >
      <Card style={styles.card}>
        {/* Cover Image / Visual Header */}
        <View style={styles.imageContainer}>
          {event.cover_image ? (
            <Image
              source={{ uri: event.cover_image }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <Calendar size={36} color={colors.primaryDark} />
            </View>
          )}

          {/* Date Badge Overlay */}
          <View style={styles.dateBadge}>
            <Text variant="caption" color={colors.white} style={styles.dateMonth}>
              {dateObj.month}
            </Text>
            <Text variant="caption" color={colors.white} style={styles.dateDay}>
              {dateObj.day}
            </Text>
          </View>

          {/* Badges Overlay */}
          <View style={styles.badgeOverlay}>
            <View style={styles.categoryBadge}>
              <Text variant="caption" style={styles.categoryBadgeText}>
                {event.category}
              </Text>
            </View>
            <View style={styles.formatBadge}>
              <Text variant="caption" style={styles.formatBadgeText}>
                {isVirtual ? 'Virtual' : 'In-Person'}
              </Text>
            </View>
            {event.status !== 'published' ? (
              <Badge
                variant={
                  event.status === 'completed'
                    ? 'completed'
                    : event.status === 'cancelled'
                    ? 'cancelled'
                    : 'pending'
                }
                label={event.status.toUpperCase()}
              />
            ) : null}
          </View>
        </View>

        {/* Content Body */}
        <View style={styles.content}>
          <Heading level={4} numberOfLines={2} style={styles.title}>
            {event.title}
          </Heading>

          <Text variant="bodySm" color={colors.inkSoft} numberOfLines={2} style={styles.description}>
            {event.description}
          </Text>

          {/* Timing & Location Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Clock size={13} color={colors.muted} style={styles.detailIcon} />
              <Text variant="caption" color={colors.inkSoft}>
                {timeStr}
              </Text>
            </View>

            <View style={styles.detailRow}>
              {isVirtual ? (
                <Video size={13} color="#2563EB" style={styles.detailIcon} />
              ) : (
                <MapPin size={13} color="#DC2626" style={styles.detailIcon} />
              )}
              <Text
                variant="caption"
                color={isVirtual ? '#2563EB' : colors.inkSoft}
                numberOfLines={1}
                style={styles.locationText}
              >
                {event.location_or_url}
              </Text>
            </View>
          </View>

          {/* Footer: Organizer */}
          <View style={styles.footer}>
            <Text variant="caption" color={colors.muted}>
              Organized by
            </Text>
            <View style={styles.organizerRow}>
              <Text variant="caption" color={colors.ink} style={styles.organizerName} numberOfLines={1}>
                {event.organizer_name || 'Veterinary Specialist'}
              </Text>
              {event.is_vet_verified ? (
                <ShieldCheck size={13} color="#15803D" style={{ marginLeft: 3 }} />
              ) : null}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(21, 128, 61, 0.92)',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
    minWidth: 44,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateDay: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  badgeOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  formatBadge: {
    backgroundColor: `${colors.primary}30`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  formatBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  description: {
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  detailsContainer: {
    backgroundColor: colors.surface,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
    gap: 4,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    marginRight: 6,
  },
  locationText: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  organizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizerName: {
    fontWeight: '600',
    fontSize: 12,
  },
});
