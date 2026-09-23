/**
 * Vetopia Mobile Design System - Spacing Scale
 * Source: mobile/docs/04-ui/design-system.md
 */

export const spacing = {
  xs: 4, // 4pt
  sm: 8, // 8pt
  md: 12, // 12pt
  lg: 16, // 16pt - Standard screen gutter & card padding
  xl: 20, // 20pt
  '2xl': 24, // 24pt
  '3xl': 32, // 32pt - Section spacing
  '4xl': 48, // 48pt - Screen header top spacing
} as const;

export type SpacingToken = keyof typeof spacing;
