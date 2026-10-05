/**
 * Safe Notifications Wrapper (MVP-08)
 * Prevents Expo Go on Android from throwing module-level errors due to the removal of
 * remote push notifications in Expo Go SDK 53+.
 *
 * In Expo Development Builds (Option A) and on iOS/Web:
 * Directly delegates to native `expo-notifications` with full functionality.
 *
 * In Expo Go on Android:
 * Provides a graceful no-op compatibility layer to prevent app startup crashes.
 */

import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';

const isExpoGoAndroid =
  Platform.OS === 'android' &&
  (Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === 'expo');

// Determine if running under a Jest test environment
const isTesting =
  typeof process !== 'undefined' &&
  (process.env.JEST_WORKER_ID !== undefined || process.env.NODE_ENV?.toLowerCase() === 'test');

export const AndroidImportance = {
  UNKNOWN: 0,
  MIN: 1,
  LOW: 2,
  DEFAULT: 3,
  HIGH: 4,
  MAX: 5,
};

export interface SafeSubscription {
  remove: () => void;
}

// Fallback stub for Expo Go Android
const expoGoAndroidStub = {
  AndroidImportance,
  setNotificationHandler: (_handler: any) => {
    // No-op in Expo Go Android
  },
  setNotificationChannelAsync: async (_channelId: string, _channel: any) => {
    return null;
  },
  getPermissionsAsync: async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  }),
  requestPermissionsAsync: async () => ({
    status: 'granted',
    granted: true,
    canAskAgain: true,
    expires: 'never',
  }),
  getExpoPushTokenAsync: async () => {
    console.info(
      '[safeNotifications] Push tokens require an Expo Development Build (Option A). Running in Expo Go.',
    );
    return { data: '' };
  },
  getDevicePushTokenAsync: async () => {
    return { data: '', type: 'android' };
  },
  getLastNotificationResponseAsync: async () => {
    return null;
  },
  addNotificationResponseReceivedListener: (
    _listener: (response: any) => void,
  ): SafeSubscription => {
    return { remove: () => {} };
  },
  addNotificationReceivedListener: (_listener: (notification: any) => void): SafeSubscription => {
    return { remove: () => {} };
  },
  removeNotificationSubscription: (subscription: SafeSubscription) => {
    subscription?.remove?.();
  },
  scheduleNotificationAsync: async () => '',
  cancelScheduledNotificationAsync: async () => {},
  cancelAllScheduledNotificationsAsync: async () => {},
  setBadgeCountAsync: async () => false,
  getBadgeCountAsync: async () => 0,
};

let resolvedNotifications: typeof import('expo-notifications') = expoGoAndroidStub as any;

if (!isExpoGoAndroid || isTesting) {
  try {
    // Only require expo-notifications when NOT running in Expo Go on Android
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    resolvedNotifications = require('expo-notifications');
  } catch (err) {
    console.warn('[safeNotifications] Failed to load native expo-notifications module:', err);
    resolvedNotifications = expoGoAndroidStub as any;
  }
} else {
  console.info(
    '[safeNotifications] Running inside Expo Go on Android. Native remote notifications are safely stubbed. To enable full remote push notifications, launch an Expo Development Build (Option A).',
  );
}

export const Notifications = resolvedNotifications;
export default Notifications;
