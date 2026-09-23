import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { Text } from '../ui/Text';
import { Heading } from '../ui/Heading';
import { Button } from '../ui/Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actionTitle?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionTitle,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {icon ? <View style={styles.iconContainer}>{icon}</View> : null}
      <Heading level={3} align="center" style={styles.title}>
        {title}
      </Heading>
      {description ? (
        <Text variant="bodyMd" color={colors.muted} align="center" style={styles.description}>
          {description}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button
          title={actionTitle}
          onPress={onAction}
          variant="primary"
          style={styles.actionButton}
        />
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
  description: {
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  actionButton: {
    marginTop: spacing.sm,
  },
});
