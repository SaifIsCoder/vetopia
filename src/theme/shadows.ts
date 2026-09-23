import { Platform, ViewStyle } from 'react-native';

/**
 * Vetopia Mobile Design System - Elevation & Shadows
 * Source: mobile/docs/04-ui/design-system.md
 */

export const shadows: Record<string, ViewStyle> = {
  card: Platform.select({
    ios: {
      shadowColor: '#131616',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
    android: {
      elevation: 3,
    },
    default: {
      shadowColor: '#131616',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
    },
  }) as ViewStyle,

  sheet: Platform.select({
    ios: {
      shadowColor: '#131616',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
    android: {
      elevation: 8,
    },
    default: {
      shadowColor: '#131616',
      shadowOffset: { width: 0, height: -6 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
    },
  }) as ViewStyle,
};
