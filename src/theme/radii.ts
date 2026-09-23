/**
 * Vetopia Mobile Design System - Corner Radii
 * Source: mobile/docs/04-ui/design-system.md
 */

export const radii = {
  sm: 8, // Input fields, small dropdown containers
  md: 12, // Buttons, media thumbnails
  lg: 16, // Standard cards, appointment cards
  xl: 24, // Modals, bottom sheets
  pill: 9999, // Status chips, pill buttons, badges
} as const;

export type RadiusToken = keyof typeof radii;
