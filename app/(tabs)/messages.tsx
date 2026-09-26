import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MessageSquare } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ConversationCard } from '../../src/components/messages/ConversationCard';
import { useConversations, useUnreadMessageCount } from '../../src/hooks/useMessages';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { ConversationSummary } from '../../src/types/message';

export default function MessagesScreen() {
  const router = useRouter();
  const {
    data: conversations,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useConversations();
  const { data: unreadTotal = 0 } = useUnreadMessageCount();

  const handleSelectConversation = (conversation: ConversationSummary) => {
    router.push(`/messages/${conversation.id}`);
  };

  return (
    <Screen style={styles.screen}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Heading level={1}>Messages</Heading>
          {unreadTotal > 0 && (
            <View style={styles.totalBadge}>
              <Text variant="caption" style={styles.totalBadgeText}>
                {unreadTotal} new
              </Text>
            </View>
          )}
        </View>
        <Text variant="bodyMd" color={colors.muted}>
          1-to-1 asynchronous communication with consulting veterinarians
        </Text>
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primaryDark} />
          <Text variant="bodySm" color={colors.muted} style={styles.loadingText}>
            Loading conversations...
          </Text>
        </View>
      ) : isError ? (
        /* Error state */
        <View style={styles.centerContainer}>
          <EmptyState
            title="Failed to load messages"
            description={
              (error as any)?.message ||
              'Could not fetch your conversations. Please check your connection.'
            }
            icon={<MessageSquare size={44} color={colors.destructive} />}
            actionTitle="Try Again"
            onAction={() => refetch()}
          />
        </View>
      ) : conversations && conversations.length > 0 ? (
        /* Conversation list */
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ConversationCard conversation={item} onPress={handleSelectConversation} />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primaryDark}
              colors={[colors.primaryDark]}
            />
          }
        />
      ) : (
        /* Empty state */
        <View style={styles.emptyContainer}>
          <EmptyState
            title="No conversations yet"
            description="When you book a consult or reach out to a vet, your clinical chats appear here."
            icon={<MessageSquare size={48} color={colors.primaryDark} />}
            actionTitle="Browse Veterinarians"
            onAction={() => router.push('/(tabs)/vets')}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  header: {
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalBadge: {
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  totalBadgeText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
});
