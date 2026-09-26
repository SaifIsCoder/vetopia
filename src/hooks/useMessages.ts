import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { messageService } from '../lib/messages/messageService';
import { DirectMessage, ConversationSummary } from '../types/message';

export const MESSAGE_QUERY_KEYS = {
  allConversations: ['conversations'] as const,
  conversation: (id: string) => ['conversation', id] as const,
  messages: (conversationId: string) => ['messages', conversationId] as const,
  unreadCount: ['unreadMessageCount'] as const,
};

/**
 * Hook to fetch and manage the user's clinical conversation list (SCR-TAB-004).
 */
export function useConversations() {
  return useQuery({
    queryKey: MESSAGE_QUERY_KEYS.allConversations,
    queryFn: () => messageService.getUserConversations(),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to fetch details for a single conversation thread.
 */
export function useConversation(conversationId: string) {
  return useQuery({
    queryKey: MESSAGE_QUERY_KEYS.conversation(conversationId),
    queryFn: () => messageService.getConversation(conversationId),
    enabled: !!conversationId,
  });
}

/**
 * Hook to fetch chronological messages and maintain active Supabase Realtime synchronization.
 */
export function useMessages(conversationId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: MESSAGE_QUERY_KEYS.messages(conversationId),
    queryFn: () => messageService.getMessages(conversationId),
    enabled: !!conversationId,
  });

  // Subscribe to real-time incoming messages via Supabase Realtime
  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = messageService.subscribeToConversationMessages(
      conversationId,
      (incomingMessage: DirectMessage) => {
        // 1. Update active message thread cache with deduplication
        queryClient.setQueryData<DirectMessage[]>(
          MESSAGE_QUERY_KEYS.messages(conversationId),
          (oldMessages) => {
            if (!oldMessages) return [incomingMessage];
            // Deduplicate by message ID
            if (oldMessages.some((m) => m.id === incomingMessage.id)) {
              return oldMessages;
            }
            return [...oldMessages, incomingMessage];
          },
        );

        // 2. Optimistically update the conversation list snippet and last_message_at
        queryClient.setQueryData<ConversationSummary[]>(
          MESSAGE_QUERY_KEYS.allConversations,
          (oldSummaries) => {
            if (!oldSummaries) return oldSummaries;
            return oldSummaries.map((conv) => {
              if (conv.id === conversationId) {
                return {
                  ...conv,
                  last_message_at: incomingMessage.created_at,
                  last_message: {
                    id: incomingMessage.id,
                    body: incomingMessage.body,
                    sender_id: incomingMessage.sender_id,
                    created_at: incomingMessage.created_at,
                  },
                };
              }
              return conv;
            });
          },
        );

        // 3. Mark read automatically if the conversation thread is open
        messageService.markConversationRead(conversationId).catch(() => {});
        queryClient.invalidateQueries({ queryKey: MESSAGE_QUERY_KEYS.unreadCount });
      },
    );

    return () => {
      unsubscribe();
    };
  }, [conversationId, queryClient]);

  return query;
}

/**
 * Mutation hook to send a direct message with optimistic local append.
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ conversationId, body }: { conversationId: string; body: string }) =>
      messageService.sendMessage(conversationId, body),

    onMutate: async ({ conversationId, body }) => {
      // Cancel outgoing queries to avoid overwriting optimistic data
      await queryClient.cancelQueries({ queryKey: MESSAGE_QUERY_KEYS.messages(conversationId) });

      const previousMessages = queryClient.getQueryData<DirectMessage[]>(
        MESSAGE_QUERY_KEYS.messages(conversationId),
      );

      const optimisticMessage: DirectMessage = {
        id: `temp-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: 'temp-me',
        body: body.trim(),
        created_at: new Date().toISOString(),
        status: 'sending',
      };

      if (previousMessages) {
        queryClient.setQueryData<DirectMessage[]>(MESSAGE_QUERY_KEYS.messages(conversationId), [
          ...previousMessages,
          optimisticMessage,
        ]);
      }

      return { previousMessages, optimisticMessage };
    },

    onError: (_err, variables, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(
          MESSAGE_QUERY_KEYS.messages(variables.conversationId),
          context.previousMessages,
        );
      }
    },

    onSuccess: (confirmedMessage, variables, context) => {
      // Replace optimistic message with confirmed server record
      queryClient.setQueryData<DirectMessage[]>(
        MESSAGE_QUERY_KEYS.messages(variables.conversationId),
        (messages) => {
          if (!messages) return [confirmedMessage];
          return messages.map((m) =>
            m.id === context?.optimisticMessage.id ? confirmedMessage : m,
          );
        },
      );

      // Invalidate conversation summary and unread counters
      queryClient.invalidateQueries({ queryKey: MESSAGE_QUERY_KEYS.allConversations });
      queryClient.invalidateQueries({ queryKey: MESSAGE_QUERY_KEYS.unreadCount });
    },
  });
}

/**
 * Mutation hook to mark a conversation as read.
 */
export function useMarkConversationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) => messageService.markConversationRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGE_QUERY_KEYS.allConversations });
      queryClient.invalidateQueries({ queryKey: MESSAGE_QUERY_KEYS.unreadCount });
    },
  });
}

/**
 * Mutation hook to get or create an appointment-linked conversation.
 */
export function useGetOrCreateAppointmentConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (appointmentId: string) =>
      messageService.getOrCreateAppointmentConversation(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGE_QUERY_KEYS.allConversations });
    },
  });
}

/**
 * Hook to query total unread messages count for the bottom navigation tab bar badge.
 */
export function useUnreadMessageCount() {
  return useQuery({
    queryKey: MESSAGE_QUERY_KEYS.unreadCount,
    queryFn: () => messageService.getUnreadMessageCount(),
    staleTime: 1000 * 15, // 15 seconds
  });
}
