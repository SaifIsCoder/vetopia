/**
 * Notification & Device Token Domain Types (MVP-08)
 * Vetopia Mobile
 */

export type NotificationType =
  | 'appointment_confirmed'
  | 'appointment_reminder'
  | 'doctor_entered_consultation'
  | 'new_message'
  | 'prescription_issued'
  | 'appointment_cancelled';

export type DevicePlatform = 'ios' | 'android' | 'web';

export interface DeviceToken {
  id: string;
  user_id: string;
  token: string;
  platform: DevicePlatform;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string;
}

export interface NotificationPayloadData {
  kind?: NotificationType | string;
  deepLink?: string;
  route?: string;
  notificationId?: string;
  entityId?: string;
  appointmentId?: string;
  prescriptionId?: string;
  conversationId?: string;
  messageId?: string;
  [key: string]: unknown;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationPayloadData;
  read: boolean;
  created_at: string;
  read_at?: string | null;
  pushed_at?: string | null;
}

export interface RegisterTokenDTO {
  token: string;
  platform: DevicePlatform;
}

export interface PushMessagePayload {
  to: string | string[];
  title: string;
  body: string;
  data?: NotificationPayloadData;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
  channelId?: string;
  badge?: number;
}
