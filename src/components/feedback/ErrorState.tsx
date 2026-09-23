import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Text } from '../ui/Text';
import { Heading } from '../ui/Heading';
import { Button } from '../ui/Button';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryTitle?: string;
  style?: ViewStyle;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error loading this information. Please try again.',
  onRetry,
  retryTitle = 'Try Again',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconContainer}>
        <AlertCircle size={44} color={colors.destructive} />
      </View>
      <Heading level={3} align="center" style={styles.title}>
        {title}
      </Heading>
      <Text variant="bodyMd" color={colors.muted} align="center" style={styles.message}>
        {message}
      </Text>
      {onRetry ? (
        <Button title={retryTitle} onPress={onRetry} variant="outline" style={styles.retryButton} />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  message: {
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  retryButton: {
    minWidth: 140,
  },
});
