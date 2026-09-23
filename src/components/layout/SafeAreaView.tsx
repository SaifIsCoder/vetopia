import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import {
  SafeAreaView as RNSafeAreaView,
  SafeAreaViewProps as RNSafeAreaViewProps,
} from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';

export interface SafeAreaViewProps extends RNSafeAreaViewProps {
  backgroundColor?: string;
  style?: ViewStyle;
}

export const SafeAreaView: React.FC<SafeAreaViewProps> = ({
  backgroundColor = colors.cream,
  style,
  children,
  ...rest
}) => {
  return (
    <RNSafeAreaView style={[styles.container, { backgroundColor }, style]} {...rest}>
      {children}
    </RNSafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
