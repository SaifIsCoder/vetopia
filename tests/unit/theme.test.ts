import { colors } from '../../src/theme/colors';
import { typography } from '../../src/theme/typography';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

describe('Design System Tokens', () => {
  test('Color tokens match design system specification', () => {
    expect(colors.primary).toBe('#A8E831');
    expect(colors.primaryDark).toBe('#88C71B');
    expect(colors.ink).toBe('#131616');
    expect(colors.inkSoft).toBe('#303636');
    expect(colors.cream).toBe('#FAF9F5');
    expect(colors.surface).toBe('#F2F4EE');
    expect(colors.border).toBe('#E2E5DC');
    expect(colors.destructive).toBe('#DC2626');
    expect(colors.success).toBe('#16A34A');
    expect(colors.muted).toBe('#6E7676');
  });

  test('Typography tokens have specified scales', () => {
    expect(typography.displayLg.fontSize).toBe(32);
    expect(typography.displayMd.fontSize).toBe(26);
    expect(typography.headingLg.fontSize).toBe(20);
    expect(typography.headingMd.fontSize).toBe(17);
    expect(typography.bodyLg.fontSize).toBe(16);
    expect(typography.bodyMd.fontSize).toBe(14);
    expect(typography.bodySm.fontSize).toBe(12);
    expect(typography.caption.fontSize).toBe(10);
    expect(typography.button.fontSize).toBe(14);
  });

  test('Spacing scale follows documented progression', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(12);
    expect(spacing.lg).toBe(16);
    expect(spacing.xl).toBe(20);
    expect(spacing['2xl']).toBe(24);
    expect(spacing['3xl']).toBe(32);
    expect(spacing['4xl']).toBe(48);
  });

  test('Radii scale includes standard curves and pill', () => {
    expect(radii.sm).toBe(8);
    expect(radii.md).toBe(12);
    expect(radii.lg).toBe(16);
    expect(radii.xl).toBe(24);
    expect(radii.pill).toBe(9999);
  });
});
