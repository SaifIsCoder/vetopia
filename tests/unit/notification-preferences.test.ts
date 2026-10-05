/**
 * Notification Preferences Unit Tests (MVP-10)
 * Vetopia Mobile
 */

import * as SecureStore from 'expo-secure-store';
import {
  getNotificationPreferences,
  setNotificationPreferences,
  updateNotificationPreference,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../src/lib/notifications/notificationPreferences';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

describe('Notification Preferences (SecureStore Persistence)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Returns default preferences when SecureStore returns null', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(null);

    const prefs = await getNotificationPreferences();
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(SecureStore.getItemAsync).toHaveBeenCalledWith('vetopia_notification_preferences');
  });

  test('Parses stored preferences correctly from SecureStore', async () => {
    const customPrefs = {
      consultationReminders: false,
      clinicalMessages: true,
      prescriptionAlerts: false,
      generalAnnouncements: true,
    };
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(JSON.stringify(customPrefs));

    const prefs = await getNotificationPreferences();
    expect(prefs).toEqual(customPrefs);
  });

  test('Falls back to defaults when stored value is malformed JSON', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce('INVALID_JSON');

    const prefs = await getNotificationPreferences();
    expect(prefs).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });

  test('setNotificationPreferences saves JSON serialized data to SecureStore', async () => {
    const newPrefs = {
      consultationReminders: false,
      clinicalMessages: false,
      prescriptionAlerts: true,
      generalAnnouncements: false,
    };

    await setNotificationPreferences(newPrefs);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'vetopia_notification_preferences',
      JSON.stringify(newPrefs),
    );
  });

  test('updateNotificationPreference updates a specific key and saves', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES),
    );

    const result = await updateNotificationPreference('consultationReminders', false);
    expect(result.consultationReminders).toBe(false);
    expect(result.clinicalMessages).toBe(true);

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      'vetopia_notification_preferences',
      expect.stringContaining('"consultationReminders":false'),
    );
  });
});
