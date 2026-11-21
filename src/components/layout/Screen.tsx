import React from 'react';
import { View, ScrollView, StyleSheet, ViewStyle, ScrollViewProps, StatusBar } from 'react-native';
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
      <StatusBar barStyle="dark-content" backgroundColor={backgroundColor} />
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
