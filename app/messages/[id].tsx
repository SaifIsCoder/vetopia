import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <Heading level={2}>Conversation</Heading>
        <Text variant="bodySm" color={colors.muted}>
          Thread ID: {id}
        </Text>
      </View>

      <EmptyState
        title="1-to-1 Clinical Chat"
        description="Direct asynchronous chat with read receipts and offline queuing will be implemented in Phase 8 (MVP-07)."
        icon={<MessageCircle size={48} color={colors.primaryDark} />}
      />

      <Button title="Back to Inbox" onPress={() => router.back()} variant="outline" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
});
