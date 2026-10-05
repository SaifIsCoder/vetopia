import React from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, BellOff, CheckCheck } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../src/components/ui/Heading';
import { Text } from '../src/components/ui/Text';
import { Card } from '../src/components/ui/Card';
import { NotificationItem } from '../src/components/notifications/NotificationItem';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../src/hooks/useNotifications';
import { notificationService } from '../src/lib/notifications/notificationService';
import { colors } from '../src/theme/colors';
import { spacing } from '../src/theme/spacing';
import type { AppNotification } from '../src/types/notification';

export default function NotificationsScreen() {
  const router = useRouter();
  const {
    data: notifications = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllReadMutation = useMarkAllNotificationsRead();

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationPress = async (notification: AppNotification) => {
    if (!notification.read) {
      markReadMutation.mutate(notification.id);
    }

    const route = notificationService.resolveRouteFromData(notification.data);
    router.push(route as any);
  };

  const handleMarkAllRead = () => {
    if (unreadCount > 0) {
      markAllReadMutation.mutate();
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ArrowLeft size={22} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Heading level={2} style={styles.headerTitle}>
            Notifications
          </Heading>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount} new</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={styles.markAllButton}
            accessibilityRole="button"
            accessibilityLabel="Mark all as read"
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck size={18} color={colors.primaryDark} />
            <Text variant="caption" style={styles.markAllText}>
              Read all
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Body States */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <Card style={styles.errorCard}>
            <Heading level={4} style={styles.errorTitle}>
              Failed to load notifications
            </Heading>
            <Text variant="bodySm" color={colors.inkSoft} style={styles.errorSubtitle}>
              Please check your network connection and try again.
            </Text>
            <TouchableOpacity onPress={() => refetch()} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </Card>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <BellOff size={32} color={colors.muted} />
          </View>
          <Heading level={3} style={styles.emptyTitle}>
            No Notifications Yet
          </Heading>
          <Text variant="bodySm" color={colors.inkSoft} style={styles.emptySubtitle}>
            You will be alerted here for consultation confirmations, 15-minute reminders, doctor
            arrivals, and clinical messages.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <NotificationItem notification={item} onPress={handleNotificationPress} />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primaryDark}
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    fontSize: 18,
    color: colors.ink,
  },
  unreadBadge: {
    backgroundColor: colors.primaryDark,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  markAllText: {
    color: colors.ink,
    fontWeight: '600',
  },
  placeholder: {
    width: 32,
  },
  listContent: {
    paddingBottom: spacing['2xl'],
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorCard: {
    alignItems: 'center',
    padding: spacing.xl,
    width: '100%',
  },
  errorTitle: {
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  retryText: {
    color: colors.ink,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    textAlign: 'center',
    lineHeight: 20,
  },
});
