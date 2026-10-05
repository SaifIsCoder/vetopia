/**
 * Notification Preferences Storage & Management (MVP-10)
 * Vetopia Mobile
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const NOTIF_PREFS_KEY = 'vetopia_notification_preferences';

export interface NotificationPreferences {
  consultationReminders: boolean;
  clinicalMessages: boolean;
  prescriptionAlerts: boolean;
  generalAnnouncements: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  consultationReminders: true,
  clinicalMessages: true,
  prescriptionAlerts: true,
  generalAnnouncements: true,
};

let memoryPreferences: NotificationPreferences = { ...DEFAULT_NOTIFICATION_PREFERENCES };

/**
 * Loads notification preferences from secure storage with safe defaults.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  if (Platform.OS === 'web') {
    return memoryPreferences;
  }

  try {
    const raw = await SecureStore.getItemAsync(NOTIF_PREFS_KEY);
    if (!raw) {
      return { ...DEFAULT_NOTIFICATION_PREFERENCES };
    }
    const parsed = JSON.parse(raw);
    return {
      consultationReminders: parsed.consultationReminders ?? true,
      clinicalMessages: parsed.clinicalMessages ?? true,
      prescriptionAlerts: parsed.prescriptionAlerts ?? true,
      generalAnnouncements: parsed.generalAnnouncements ?? true,
    };
  } catch {
    return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  }
}

/**
 * Saves all notification preferences.
 */
export async function setNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  memoryPreferences = { ...prefs };
  if (Platform.OS === 'web') return;

  try {
    await SecureStore.setItemAsync(NOTIF_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('[NotificationPreferences] Failed to persist preferences:', error);
  }
}

/**
 * Updates a single notification preference key and persists the result.
 */
export async function updateNotificationPreference(
  key: keyof NotificationPreferences,
  value: boolean,
): Promise<NotificationPreferences> {
  const current = await getNotificationPreferences();
  const updated: NotificationPreferences = {
    ...current,
    [key]: value,
  };
  await setNotificationPreferences(updated);
  return updated;
}
