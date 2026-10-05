import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { Text } from './Text';

export interface ChipProps {
  label?: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  accessibilityRole?: 'checkbox' | 'button' | 'radio';
  accessibilityLabel?: string;
  children?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  style,
  testID,
  disabled = false,
  icon,
  accessibilityRole = 'checkbox',
  accessibilityLabel,
  children,
}) => {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      {children ? (
        children
      ) : label ? (
        <Text
          variant="bodySm"
          color={disabled ? colors.muted : selected ? colors.ink : colors.inkSoft}
          style={[styles.label, selected && styles.selectedLabel]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    minHeight: 36,
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
    marginBottom: spacing.xs,
  },
  selected: {
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primaryDark,
  },
  unselected: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.45,
  },
  iconContainer: {
    marginRight: spacing.xs,
  },
  label: {
    fontWeight: '500',
  },
  selectedLabel: {
    fontWeight: '700',
  },
});
