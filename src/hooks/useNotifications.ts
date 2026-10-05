/**
 * Notification React Query Hooks (MVP-08)
 * Vetopia Mobile
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationService } from '../lib/notifications/notificationService';
import type { AppNotification } from '../types/notification';

export const NOTIFICATION_KEYS = {
  all: ['notifications'] as const,
  list: () => [...NOTIFICATION_KEYS.all, 'list'] as const,
  unreadCount: () => [...NOTIFICATION_KEYS.all, 'unreadCount'] as const,
};

/**
 * Hook to retrieve user notifications list
 */
export function useNotifications() {
  return useQuery<AppNotification[], Error>({
    queryKey: NOTIFICATION_KEYS.list(),
    queryFn: () => notificationService.getNotifications(),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to fetch total unread notifications count for badge display
 */
export function useUnreadNotificationCount() {
  return useQuery<number, Error>({
    queryKey: NOTIFICATION_KEYS.unreadCount(),
    queryFn: () => notificationService.getUnreadCount(),
    staleTime: 1000 * 15, // 15 seconds
    refetchInterval: 1000 * 60, // Poll every 1 minute as liveness fallback
  });
}

/**
 * Hook to mark a single notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation<boolean, Error, string>({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: (_, notificationId) => {
      // Optimistically update notifications list cache
      queryClient.setQueryData<AppNotification[]>(NOTIFICATION_KEYS.list(), (old) => {
        if (!old) return [];
        return old.map((n) =>
          n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n,
        );
      });

      // Update unread count cache
      queryClient.setQueryData<number>(NOTIFICATION_KEYS.unreadCount(), (old) =>
        Math.max(0, (old || 1) - 1),
      );

      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation<number, Error, void>({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      // Optimistically mark all in cache as read
      queryClient.setQueryData<AppNotification[]>(NOTIFICATION_KEYS.list(), (old) => {
        if (!old) return [];
        return old.map((n) => ({ ...n, read: true, read_at: new Date().toISOString() }));
      });

      queryClient.setQueryData<number>(NOTIFICATION_KEYS.unreadCount(), 0);
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.all });
    },
  });
}

/**
 * Hook to register device token
 */
export function useRegisterDeviceToken() {
  return useMutation({
    mutationFn: (token: string) => notificationService.registerDeviceToken(token),
  });
}
