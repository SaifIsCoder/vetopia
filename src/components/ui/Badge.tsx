import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Check } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { Text } from './Text';

export type BadgeVariant = 'verified' | 'scheduled' | 'completed' | 'cancelled';

export interface BadgeProps {
  variant: BadgeVariant;
  label?: string;
  style?: ViewStyle;
}

const defaultLabels: Record<BadgeVariant, string> = {
  verified: 'Verified',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const Badge: React.FC<BadgeProps> = ({ variant, label = defaultLabels[variant], style }) => {
  const isVerified = variant === 'verified';
  const textColor = textColors[variant];

  return (
    <View style={[styles.badge, variantStyles[variant], style]}>
      {isVerified ? <Check size={12} color={textColor} style={styles.icon} /> : null}
      <Text variant="caption" color={textColor} style={styles.label}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  icon: {
    marginRight: spacing.xs,
  },
  label: {
    fontWeight: '600',
  },
});

const variantStyles: Record<BadgeVariant, ViewStyle> = {
  verified: {
    backgroundColor: colors.primary,
  },
  scheduled: {
    backgroundColor: colors.surface,
  },
  completed: {
    backgroundColor: colors.success,
  },
  cancelled: {
    backgroundColor: colors.destructive,
  },
};

const textColors: Record<BadgeVariant, string> = {
  verified: colors.ink,
  scheduled: colors.inkSoft,
  completed: colors.cream,
  cancelled: colors.cream,
};
