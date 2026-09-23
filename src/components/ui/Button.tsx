import React from 'react';
import { Pressable, PressableProps, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: ViewStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading;

  const containerStyles = [
    styles.base,
    sizeStyles[size],
    variantStyles[variant],
    isDisabled && styles.disabled,
    style,
  ];

  const textColor = textColors[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [...containerStyles, pressed && !isDisabled && styles.pressed]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} testID="button-activity-indicator" />
      ) : (
        <>
          {leftIcon}
          <Text
            variant="button"
            color={textColor}
            style={[
              styles.label,
              leftIcon ? styles.labelWithLeftIcon : undefined,
              rightIcon ? styles.labelWithRightIcon : undefined,
            ]}
          >
            {title}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    textAlign: 'center',
  },
  labelWithLeftIcon: {
    marginLeft: spacing.sm,
  },
  labelWithRightIcon: {
    marginRight: spacing.sm,
  },
});

const sizeStyles: Record<ButtonSize, ViewStyle> = {
  sm: {
    minHeight: 38,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  md: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  lg: {
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
};

const variantStyles: Record<ButtonVariant, ViewStyle> = {
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.ink,
  },
  outline: {
    backgroundColor: colors.transparent,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  destructive: {
    backgroundColor: colors.destructive,
  },
  ghost: {
    backgroundColor: colors.transparent,
  },
};

const textColors: Record<ButtonVariant, string> = {
  primary: colors.ink,
  secondary: colors.cream,
  outline: colors.ink,
  destructive: colors.cream,
  ghost: colors.ink,
};
