import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, MessageCircle, AlertCircle } from 'lucide-react-native';
import { Text } from '../../src/components/ui/Text';
import { MessageBubble } from '../../src/components/messages/MessageBubble';
import { MessageComposer } from '../../src/components/messages/MessageComposer';
import { AppointmentContextBanner } from '../../src/components/messages/AppointmentContextBanner';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import {
  useConversation,
  useMessages,
  useSendMessage,
  useMarkConversationRead,
} from '../../src/hooks/useMessages';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function MessageThreadScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const flatListRef = useRef<FlatList>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const {
    data: conversation,
    isLoading: isConvLoading,
    isError: isConvError,
    error: convError,
  } = useConversation(id || '');

  const { data: messages = [], isLoading: isMessagesLoading } = useMessages(id || '');

  const { mutateAsync: sendMessage, isPending: isSending } = useSendMessage();
  const { mutate: markRead } = useMarkConversationRead();

  // Mark conversation read on mount / view
  useEffect(() => {
    if (id) {
      markRead(id);
    }
  }, [id, markRead]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async (text: string) => {
    if (!id) return;
    setErrorMessage(null);
    try {
      await sendMessage({ conversationId: id, body: text });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to send message. Please try again.');
      throw err;
    }
  };

  const counterpart = conversation?.counterpart;
  const isVet = counterpart?.role === 'vet';
  const counterpartName = counterpart?.name || conversation?.subject || 'Clinical Chat';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to messages"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft size={22} color={colors.ink} />
          </Pressable>

          <View style={styles.headerInfo}>
            <View style={styles.headerTitleRow}>
              <Text variant="bodyMd" style={styles.headerName} numberOfLines={1}>
                {counterpartName}
              </Text>
              {counterpart && (
                <View style={[styles.headerRolePill, isVet ? styles.vetPill : styles.parentPill]}>
                  <Text variant="caption" style={styles.headerRoleText}>
                    {isVet ? 'Doctor' : 'Pet Parent'}
                  </Text>
                </View>
              )}
            </View>

            {counterpart?.specialty ? (
              <Text variant="caption" color={colors.muted} numberOfLines={1}>
                {counterpart.specialty}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Appointment Context Banner (if linked) */}
        {conversation?.appointment ? (
          <AppointmentContextBanner appointment={conversation.appointment} />
        ) : null}

        {/* Main Content Area */}
        {isConvLoading || (isMessagesLoading && messages.length === 0) ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primaryDark} />
            <Text variant="bodySm" color={colors.muted} style={styles.loadingText}>
              Loading conversation...
            </Text>
          </View>
        ) : isConvError ? (
          <View style={styles.centerContainer}>
            <EmptyState
              title="Conversation Unavailable"
              description={
                (convError as any)?.message ||
                'You may not have permission to view this conversation, or it was not found.'
              }
              icon={<AlertCircle size={44} color={colors.destructive} />}
              actionTitle="Return to Inbox"
              onAction={() => router.back()}
            />
          </View>
        ) : messages.length === 0 ? (
          /* Empty thread */
          <View style={styles.emptyContainer}>
            <EmptyState
              title="Start the conversation"
              description={`Send a direct clinical message to ${counterpartName}. Consultations and follow-ups are securely preserved.`}
              icon={<MessageCircle size={48} color={colors.primaryDark} />}
            />
          </View>
        ) : (
          /* Message List */
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isCurrentUser =
                item.sender_id === currentUser?.id || item.sender_id === 'temp-me';
              return (
                <MessageBubble
                  message={item}
                  isCurrentUser={isCurrentUser}
                  senderName={!isCurrentUser ? counterpartName : undefined}
                />
              );
            }}
            contentContainerStyle={styles.messagesListContent}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* Message Composer */}
        <MessageComposer
          onSend={handleSend}
          isSending={isSending}
          disabled={isConvLoading || isConvError}
          errorMessage={errorMessage}
          placeholder={`Message ${counterpartName}...`}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardContainer: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
    marginRight: spacing.sm,
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerName: {
    fontWeight: '700',
    color: colors.ink,
    marginRight: spacing.xs,
    maxWidth: '75%',
  },
  headerRolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  vetPill: {
    backgroundColor: '#EBF8D3',
  },
  parentPill: {
    backgroundColor: colors.surface,
  },
  headerRoleText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  messagesListContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
});
