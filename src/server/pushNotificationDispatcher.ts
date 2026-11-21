/**
 * Server-Side Push Notification Dispatcher (MVP-08)
 * Handles Expo push notification delivery, invalid token deactivation,
 * multi-device delivery, and the 15-minute consultation reminder worker.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

  constructor(supabaseClient: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Send push messages to active device tokens of a user
   */
  async dispatchPushToUser(
    userId: string,
    payload: PushNotificationPayload,
  ): Promise<{ sentCount: number; failedTokens: string[]; retry: boolean }> {
    try {
      // 1. Fetch active device tokens for the recipient user
      const { data: tokens, error } = await this.supabase
        .from('device_tokens')
        .select('token, platform')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;
      if (!tokens?.length) {
        return { sentCount: 0, failedTokens: [], retry: false };
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
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        console.warn(`[PushDispatcher] Expo Push Gateway responded with ${response.status}`);
        return { sentCount: 0, failedTokens: [], retry: true };
      }

      const result = await response.json();
      const tickets: ExpoPushTicket[] = result.data || [];
      const failedTokens: string[] = [];
      let sentCount = 0;
      let retry = false;

      for (const [index, { token }] of tokens.entries()) {
        const ticket = tickets[index];
        if (ticket?.status === 'ok') {
          sentCount++;
          continue;
        }

        failedTokens.push(token);
        if (ticket?.details?.error === 'DeviceNotRegistered') {
          await this.deactivateInvalidToken(token);
        } else {
          retry = true;
        }
      }

      return { sentCount, failedTokens, retry };
    } catch (err) {
      console.warn('[PushDispatcher] Push dispatch error:', err);
      return { sentCount: 0, failedTokens: [], retry: true };
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

  /** Enqueue reminders once. Push delivery uses the same outbox as other notifications. */
  async runAppointmentReminderWorker(): Promise<number> {
    const { data, error } = await this.supabase.rpc('process_appointment_reminders');
    if (error) throw error;
    return data;
  }

  async dispatchPendingNotifications(limit = 20): Promise<number> {
    const { data: pending, error } = await this.supabase.rpc('claim_pending_push_notifications', {
      p_limit: Math.min(limit, 20),
    });
    if (error) throw error;

    let processed = 0;
    for (const notification of pending) {
      const highPriority =
        notification.type === 'doctor_entered_consultation' ||
        notification.type === 'appointment_reminder';
      const result = await this.dispatchPushToUser(notification.user_id, {
        title: notification.title,
        body: notification.body,
        data: notification.data,
        priority: highPriority ? 'high' : 'default',
        channelId: highPriority ? 'consultations' : 'messages_general',
      });
      if (result.retry) continue;

      const { data: completed, error: updateError } = await this.supabase
        .from('notifications')
        .update({
          pushed_at: new Date().toISOString(),
          push_claim_id: null,
          push_claim_until: null,
        })
        .eq('id', notification.id)
        .eq('push_claim_id', notification.push_claim_id)
        .select('id')
        .maybeSingle();
      if (updateError) throw updateError;
      if (completed) processed++;
    }
    return processed;
  }
}

const workerUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const workerKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
export const pushDispatcher =
  workerUrl && workerKey
    ? new PushNotificationDispatcher(
        createClient(workerUrl, workerKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        }),
      )
    : null;
