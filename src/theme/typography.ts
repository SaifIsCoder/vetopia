import { Platform, TextStyle } from 'react-native';

/**
 * Vetopia Mobile Design System - Typography Tokens
 * Source: mobile/docs/04-ui/design-system.md
 */

export const fontFamilies = {
  display: Platform.select({
    ios: 'SpaceGrotesk-Bold',
    android: 'SpaceGrotesk-Bold',
    default: 'sans-serif',
  }),
  sans: Platform.select({
    ios: 'Inter',
    android: 'Inter',
    default: 'sans-serif',
  }),
};

export const typography: Record<string, TextStyle> = {
  displayLg: {
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    fontFamily: fontFamilies.display,
  },
  displayMd: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    fontFamily: fontFamilies.display,
  },
  headingLg: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: fontFamilies.display,
  },
  headingMd: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    fontFamily: fontFamilies.sans,
  },
  bodyLg: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '400',
    fontFamily: fontFamilies.sans,
  },
  bodyMd: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: fontFamilies.sans,
  },
  bodySm: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    fontFamily: fontFamilies.sans,
  },
  caption: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
    fontFamily: fontFamilies.sans,
  },
  button: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
    fontFamily: fontFamilies.display,
    textTransform: 'uppercase',
  },
};

export type TypographyVariant = keyof typeof typography;
