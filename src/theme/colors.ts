/**
 * Vetopia Mobile Design System - Color Palette
 * Source: mobile/docs/04-ui/design-system.md & src/styles.css
 */

export const colors = {
  // Brand Core
  primary: '#A8E831', // Vivid Lime - Main CTA, active indicators, verified badges
  primaryDark: '#88C71B', // Deep Lime - Focus rings, rating stars, active borders
  ink: '#131616', // Near-Black Charcoal - Primary text, dark canvas, contrast buttons
  inkSoft: '#303636', // Soft Charcoal - Secondary text, card headers
  cream: '#FAF9F5', // Off-White Cream - Light mode screen canvas background
  surface: '#F2F4EE', // Warm Surface - Cards, input background, pill chips
  border: '#E2E5DC', // Subtle border, 1px dividers

  // Semantic
  destructive: '#DC2626', // Crimson - Emergency triage alerts, end-call, cancel
  success: '#16A34A', // Forest Green - Online status, completed consults
  muted: '#6E7676', // Neutral secondary helper text
  white: '#FFFFFF', // Pure white card backgrounds
  black: '#000000',

  // UI Utilities
  overlay: 'rgba(19, 22, 22, 0.45)', // Modal backdrop
  transparent: 'transparent',
} as const;

export type ColorToken = keyof typeof colors;
