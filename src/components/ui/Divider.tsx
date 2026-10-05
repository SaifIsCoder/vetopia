import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors } from '../../theme/colors';

export interface DividerProps {
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Divider: React.FC<DividerProps> = ({ vertical = false, style }) => {
  return <View style={[vertical ? styles.vertical : styles.horizontal, style]} />;
};

const styles = StyleSheet.create({
  horizontal: {
    height: 1,
    width: '100%',
    backgroundColor: colors.border,
  },
  vertical: {
    width: 1,
    height: '100%',
    backgroundColor: colors.border,
  },
});
