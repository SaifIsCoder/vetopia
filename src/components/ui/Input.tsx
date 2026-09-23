import React, { useState } from 'react';
import { View, TextInput, TextInputProps, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { Text } from './Text';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  containerStyle,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? (
        <Text variant="bodySm" color={colors.inkSoft} style={styles.label}>
          {label}
        </Text>
      ) : null}

      <View
        style={[styles.inputContainer, isFocused && styles.focused, hasError && styles.errorBorder]}
      >
        {leftIcon ? <View style={styles.leftIconContainer}>{leftIcon}</View> : null}

        <TextInput
          placeholderTextColor={colors.muted}
          style={[styles.input, style]}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />

        {rightIcon ? <View style={styles.rightIconContainer}>{rightIcon}</View> : null}
      </View>

      {error ? (
        <Text variant="caption" color={colors.destructive} style={styles.helperText}>
          {error}
        </Text>
      ) : helperText ? (
        <Text variant="caption" color={colors.muted} style={styles.helperText}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: spacing.md,
  },
  label: {
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
  },
  focused: {
    borderColor: colors.primaryDark,
    borderWidth: 2,
  },
  errorBorder: {
    borderColor: colors.destructive,
  },
  input: {
    flex: 1,
    height: 48,
    color: colors.ink,
    fontSize: typography.bodyMd.fontSize,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  rightIconContainer: {
    marginLeft: spacing.sm,
  },
  helperText: {
    marginTop: spacing.xs,
  },
});
