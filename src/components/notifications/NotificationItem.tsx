import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Calendar,
  Clock,
  Video,
  MessageCircle,
  FileText,
  Bell,
  ChevronRight,
} from 'lucide-react-native';
import { Text } from '../ui/Text';
import { Heading } from '../ui/Heading';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';
import type { AppNotification, NotificationType } from '../../types/notification';

interface NotificationItemProps {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
}

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case 'appointment_confirmed':
      return <Calendar size={20} color={colors.ink} />;
    case 'appointment_reminder':
      return <Clock size={20} color="#D97706" />;
    case 'doctor_entered_consultation':
      return <Video size={20} color="#16A34A" />;
    case 'new_message':
      return <MessageCircle size={20} color="#2563EB" />;
    case 'prescription_issued':
      return <FileText size={20} color="#7C3AED" />;
    default:
      return <Bell size={20} color={colors.ink} />;
  }
}

function formatRelativeTime(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHr / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;

    return new Date(dateString).toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const isUnread = !notification.read;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.container, isUnread && styles.unreadContainer]}
      onPress={() => onPress(notification)}
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}, ${notification.body}`}
    >
      <View style={styles.iconContainer}>{getNotificationIcon(notification.type)}</View>

      <View style={styles.contentContainer}>
        <View style={styles.headerRow}>
          <Heading level={4} style={[styles.title, isUnread && styles.unreadTitle]}>
            {notification.title}
          </Heading>
          {isUnread && <View style={styles.unreadDot} />}
        </View>

        <Text variant="bodySm" color={colors.inkSoft} style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>

        <Text variant="caption" color={colors.muted} style={styles.timestamp}>
          {formatRelativeTime(notification.created_at)}
        </Text>
      </View>

      <ChevronRight size={16} color={colors.muted} style={styles.chevron} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  unreadContainer: {
    backgroundColor: '#F8FAFC',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  title: {
    fontSize: 14,
    color: colors.ink,
    flex: 1,
    marginRight: spacing.xs,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
});
