import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, ScrollViewProps } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from './SafeAreaView';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface ScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  backgroundColor?: string;
  paddingHorizontal?: number;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  style?: ViewStyle;
  scrollViewProps?: ScrollViewProps;
  testID?: string;
}

export const Screen: React.FC<ScreenProps> = ({
  children,
  scrollable = false,
  backgroundColor = colors.cream,
  paddingHorizontal = spacing.lg,
  header,
  footer,
  contentContainerStyle,
  style,
  scrollViewProps,
  testID,
}) => {
  return (
    <SafeAreaView backgroundColor={backgroundColor} style={style} testID={testID}>
      <StatusBar style="dark" />
      {header}
      {scrollable ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { paddingHorizontal }, contentContainerStyle]}>
          {children}
        </View>
      )}
      {footer}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: spacing.md,
  },
  content: {
    flex: 1,
    paddingVertical: spacing.md,
  },
});
