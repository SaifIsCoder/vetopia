import React from 'react';
import { View, ViewProps, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';

export interface CardProps extends ViewProps {
  elevated?: boolean;
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({ elevated = true, style, children, ...rest }) => {
  return (
    <View style={[styles.card, elevated && shadows.card, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
});
