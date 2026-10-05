/**
 * Notification Service (MVP-08)
 * Handles Expo push token registration, notification permissions,
 * in-app notification queries, read status, and deep link routing.
 */

import { Platform } from 'react-native';
import { Notifications } from './safeNotifications';
import Constants from 'expo-constants';
import { supabase } from '../supabase/client';
import { ApiError } from '../api/errors';
import type {
  AppNotification,
  DevicePlatform,
  NotificationPayloadData,
  DeviceToken,
} from '../../types/notification';

// Configure default foreground notification behavior
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (err) {
  console.warn('[NotificationService] Failed to initialize notification handler:', err);
}

class NotificationService {
  private currentPushToken: string | null = null;

  /**
   * Configure Android notification channels for urgency distinction
   */
  async configureNotificationChannels(): Promise<void> {
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync('consultations', {
          name: 'Consultation & Emergency Alerts',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#84CC16',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('messages_general', {
          name: 'Clinical Messages & General',
          importance: Notifications.AndroidImportance.DEFAULT,
          sound: 'default',
        });
      } catch (err) {
        console.warn('[NotificationService] Failed to configure Android channels:', err);
      }
    }
  }

  /**
   * Request push permission and obtain Expo push token
   */
  async registerForPushNotificationsAsync(): Promise<string | null> {
    try {
      await this.configureNotificationChannels();

      // Gracefully bypass remote push token in Expo Go on Android where native development build is required
      if (Constants.appOwnership === 'expo' && Platform.OS === 'android') {
        console.info(
          '[NotificationService] Running in Expo Go on Android. Remote push tokens require an Expo Development Build (Option A).',
        );
        return null;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return null;
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      this.currentPushToken = tokenData.data;
      return tokenData.data;
    } catch (err: any) {
      // Gracefully handle simulator, web, or missing push credentials
      console.warn('[NotificationService] Push token acquisition failed:', err?.message || err);
      return null;
    }
  }

  /**
   * Register or update the device push token on the server
   */
  async registerDeviceToken(token: string): Promise<DeviceToken> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new ApiError(
          'User must be authenticated to register device token.',
          401,
          'UNAUTHENTICATED',
        );
      }

      const platform: DevicePlatform =
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

      const { data, error } = await supabase.rpc('register_device_token', {
        p_token: token,
        p_platform: platform,
      });

      if (error) {
        // Fallback to direct upsert if RPC is unavailable
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('device_tokens')
          .upsert(
            {
              user_id: session.user.id,
              token,
              platform,
              is_active: true,
              updated_at: new Date().toISOString(),
              last_used_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,token' },
          )
          .select()
          .single();

        if (fallbackError) {
          throw this.sanitizeError(fallbackError);
        }

        this.currentPushToken = token;
        return fallbackData as DeviceToken;
      }

      this.currentPushToken = token;
      return data as DeviceToken;
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Deactivate push token on logout
   */
  async deactivateDeviceToken(token?: string): Promise<boolean> {
    try {
      const tokenToDeactivate = token || this.currentPushToken;
      if (!tokenToDeactivate) return true;

      const { error } = await supabase.rpc('deactivate_device_token', {
        p_token: tokenToDeactivate,
      });

      if (error) {
        // Fallback direct update
        await supabase
          .from('device_tokens')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('token', tokenToDeactivate);
      }

      this.currentPushToken = null;
      return true;
    } catch (err) {
      console.warn('[NotificationService] Deactivate token error:', err);
      return false;
    }
  }

  /**
   * Retrieve in-app notifications history for authenticated user
   */
  async getNotifications(): Promise<AppNotification[]> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return [];
      }

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw this.sanitizeError(error);
      }

      return (data || []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        type: row.type,
        title: row.title,
        body: row.body,
        data: row.data || {},
        read: row.read,
        created_at: row.created_at,
        read_at: row.read_at,
      }));
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Get unread notifications count for badge rendering
   */
  async getUnreadCount(): Promise<number> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        return 0;
      }

      const { data, error } = await supabase.rpc('get_unread_notification_count');

      if (!error && typeof data === 'number') {
        return data;
      }

      // Fallback query
      const { count, error: countErr } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('read', false);

      if (countErr) {
        return 0;
      }

      return count || 0;
    } catch {
      return 0;
    }
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('mark_notification_read', {
        p_notification_id: notificationId,
      });

      if (error) {
        await supabase
          .from('notifications')
          .update({ read: true, read_at: new Date().toISOString() })
          .eq('id', notificationId);
      }

      return true;
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Mark all unread notifications as read
   */
  async markAllAsRead(): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('mark_all_notifications_read');

      if (!error && typeof data === 'number') {
        return data;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        await supabase
          .from('notifications')
          .update({ read: true, read_at: new Date().toISOString() })
          .eq('user_id', session.user.id)
          .eq('read', false);
      }

      return 1;
    } catch (err) {
      throw this.sanitizeError(err);
    }
  }

  /**
   * Resolve an in-app destination route from a notification payload
   */
  resolveRouteFromData(data?: NotificationPayloadData): string {
    if (!data) return '/(tabs)';

    // 1. Direct explicit deepLink: 'vetopia://...' -> strip scheme
    if (data.deepLink && typeof data.deepLink === 'string') {
      const path = data.deepLink.replace(/^vetopia:\/\//, '/');
      if (path.startsWith('/')) return path;
      return `/${path}`;
    }

    // 2. Direct route property
    if (data.route && typeof data.route === 'string') {
      return data.route.startsWith('/') ? data.route : `/${data.route}`;
    }

    // 3. Resolve by kind / type
    const kind = data.kind;
    switch (kind) {
      case 'appointment_confirmed':
      case 'appointment_cancelled':
        return '/appointments';
      case 'appointment_reminder':
      case 'doctor_entered_consultation':
        return data.appointmentId ? `/consult/${data.appointmentId}` : '/appointments';
      case 'new_message':
        return data.conversationId ? `/messages/${data.conversationId}` : '/(tabs)/messages';
      case 'prescription_issued':
        return data.prescriptionId ? `/prescriptions/${data.prescriptionId}` : '/(tabs)/care';
      default:
        return '/(tabs)';
    }
  }

  private sanitizeError(err: any): ApiError {
    if (err instanceof ApiError) return err;

    const message = err?.message || 'A notification service error occurred.';
    const code = err?.code || 'NOTIFICATION_ERROR';
    const status = err?.status || 500;

    return new ApiError(message, status, code);
  }
}

export const notificationService = new NotificationService();
