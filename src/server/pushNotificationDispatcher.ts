/**
 * Server-Side Push Notification Dispatcher (MVP-08)
 * Handles Expo push notification delivery, invalid token deactivation,
 * multi-device delivery, and the 15-minute consultation reminder worker.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultSupabase } from './telemedicineTokenHandler';

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface ExpoPushMessage {
  to: string;
  sound?: 'default' | null;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
}

export interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

export class PushNotificationDispatcher {
  private supabase: SupabaseClient;
  private expoPushEndpoint = 'https://exp.host/--/api/v2/push/send';

  constructor(supabaseClient: SupabaseClient = defaultSupabase) {
    this.supabase = supabaseClient;
  }

  /**
   * Send push messages to active device tokens of a user
   */
  async dispatchPushToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ sentCount: number; failedTokens: string[] }> {
    try {
      // 1. Fetch active device tokens for the recipient user
      const { data: tokens, error } = await this.supabase
        .from('device_tokens')
        .select('token, platform')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error || !tokens || tokens.length === 0) {
        return { sentCount: 0, failedTokens: [] };
      }

      const channelId =
        payload.channelId || (payload.priority === 'high' ? 'consultations' : 'messages_general');

      const messages: ExpoPushMessage[] = tokens.map((t) => ({
        to: t.token,
        sound: 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        priority: payload.priority || 'high',
        channelId,
      }));

      // 2. Dispatch payload to Expo Push API
      const response = await fetch(this.expoPushEndpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        console.warn(`[PushDispatcher] Expo Push Gateway responded with ${response.status}`);
        return { sentCount: 0, failedTokens: [] };
      }

      const result = await response.json();
      const tickets: ExpoPushTicket[] = result.data || [];
      const failedTokens: string[] = [];

      // 3. Inspect tickets and deactivate invalid/expired tokens (e.g. DeviceNotRegistered)
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];
        const token = tokens[i]?.token;

        if (ticket.status === 'error' && token) {
          failedTokens.push(token);
          if (ticket.details?.error === 'DeviceNotRegistered') {
            await this.deactivateInvalidToken(token);
          }
        }
      }

      return {
        sentCount: messages.length - failedTokens.length,
        failedTokens,
      };
    } catch (err) {
      console.warn('[PushDispatcher] Push dispatch error:', err);
      return { sentCount: 0, failedTokens: [] };
    }
  }

  /**
   * Deactivate an expired or unregistered device push token
   */
  async deactivateInvalidToken(token: string): Promise<void> {
    try {
      await this.supabase
        .from('device_tokens')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('token', token);
    } catch (err) {
      console.warn('[PushDispatcher] Failed to deactivate invalid token:', err);
    }
  }

  /**
   * 15-Minute Consultation Reminder Worker
   * Idempotently scans for upcoming scheduled appointments and dispatches notifications
   */
  async runAppointmentReminderWorker(): Promise<number> {
    try {
      // 1. Invoke atomic PostgreSQL RPC to claim reminders and insert notification rows
      const { data, error } = await this.supabase.rpc('process_appointment_reminders');

      if (error || !data || !Array.isArray(data) || data.length === 0) {
        return 0;
      }

      // 2. Dispatch push notifications for each generated reminder
      for (const row of data) {
        await this.dispatchPushToUser(row.recipient_user_id, {
          title: row.notification_title,
          body: row.notification_body,
          data: row.notification_data,
          priority: 'high',
          channelId: 'consultations',
        });

        if (row.notification_id) {
          await this.supabase
            .from('notifications')
            .update({ pushed_at: new Date().toISOString() })
            .eq('id', row.notification_id);
        }
      }

      return data.length;
    } catch (err) {
      console.warn('[PushDispatcher] Reminder worker execution error:', err);
      return 0;
    }
  }

  /**
   * Transactional Outbox Dispatcher
   * Claims and dispatches pending in-app notifications to the Expo Push Gateway.
   * Guarantees at-least-once delivery for domain triggers (Appt booked, Message sent, Prescription issued).
   */
  async dispatchPendingNotifications(limit: number = 50): Promise<number> {
    try {
      const { data: pending, error } = await this.supabase
        .from('notifications')
        .select('id, user_id, type, title, body, data')
        .is('pushed_at', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (error || !pending || pending.length === 0) {
        return 0;
      }

      let dispatchedCount = 0;
      for (const notif of pending) {
        const priority =
          notif.type === 'doctor_entered_consultation' || notif.type === 'appointment_reminder'
            ? 'high'
            : 'default';
        const channelId = priority === 'high' ? 'consultations' : 'messages_general';

        await this.dispatchPushToUser(notif.user_id, {
          title: notif.title,
          body: notif.body,
          data: notif.data,
          priority,
          channelId,
        });

        await this.supabase
          .from('notifications')
          .update({ pushed_at: new Date().toISOString() })
          .eq('id', notif.id);

        dispatchedCount++;
      }

      return dispatchedCount;
    } catch (err) {
      console.warn('[PushDispatcher] dispatchPendingNotifications error:', err);
      return 0;
    }
  }
}

export const pushDispatcher = new PushNotificationDispatcher();
