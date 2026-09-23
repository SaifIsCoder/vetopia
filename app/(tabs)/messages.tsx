import React from 'react';
import { View, StyleSheet } from 'react-native';
import { MessageSquare } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function MessagesScreen() {
  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Heading level={1}>Clinical Messages</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          1-to-1 asynchronous communication with consulting veterinarians
        </Text>
      </View>

      <EmptyState
        title="Inbox Ready"
        description="Secure 1-to-1 messaging between pet parents and verified doctors will be implemented in Phase 8 (MVP-07)."
        icon={<MessageSquare size={44} color={colors.primaryDark} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
});
