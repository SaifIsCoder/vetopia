/**
 * Chat Message Bubble Component for AI Triage (MVP-09)
 * Vetopia Mobile
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Bot, User, AlertCircle } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { ChatMessage } from '../../types/ai';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

interface ChatMessageItemProps {
  message: ChatMessage;
  isStreaming?: boolean;
}

export function ChatMessageItem({ message, isStreaming = false }: ChatMessageItemProps) {
  const isUser = message.role === 'user';
  const hasEmergencyTag =
    message.isEmergency || (message.content && message.content.includes('[EMERGENCY_DETECTED]'));

  // Clean the emergency token from display text if present
  const displayContent = message.content
    ? message.content.replace('[EMERGENCY_DETECTED]', '').trim()
    : '';

  return (
    <View
      style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}
      testID={`chat-message-${message.role}`}
    >
      {!isUser ? (
        <View style={styles.assistantAvatar}>
          <Bot size={16} color={colors.primaryDark} />
        </View>
      ) : null}

      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.assistantBubble,
          hasEmergencyTag && !isUser ? styles.emergencyBubble : null,
        ]}
      >
        {hasEmergencyTag && !isUser ? (
          <View style={styles.emergencyTag}>
            <AlertCircle size={14} color={colors.destructive} />
            <Text variant="caption" color={colors.destructive} style={styles.emergencyTagText}>
              Urgent Clinical Assessment
            </Text>
          </View>
        ) : null}

        {displayContent ? (
          <Text
            variant="bodySm"
            color={isUser ? colors.white : colors.ink}
            style={styles.messageText}
          >
            {displayContent}
          </Text>
        ) : isStreaming ? (
          <View style={styles.typingContainer}>
            <View style={styles.typingDot} />
            <Text variant="caption" color={colors.muted}>
              Assessing symptoms...
            </Text>
          </View>
        ) : null}

        {isStreaming && displayContent ? (
          <Text variant="caption" color={colors.primaryDark} style={styles.cursor}>
            ▋
          </Text>
        ) : null}
      </View>

      {isUser ? (
        <View style={styles.userAvatar}>
          <User size={16} color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  userContainer: {
    justifyContent: 'flex-end',
  },
  assistantContainer: {
    justifyContent: 'flex-start',
  },
  assistantAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  userAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    marginBottom: 4,
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  userBubble: {
    backgroundColor: colors.ink,
    borderBottomRightRadius: 2,
  },
  assistantBubble: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emergencyBubble: {
    borderColor: 'rgba(220, 38, 38, 0.4)',
    backgroundColor: '#FEF2F2',
  },
  emergencyTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: 4,
  },
  emergencyTagText: {
    fontWeight: '700',
  },
  messageText: {
    lineHeight: 20,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
  },
  cursor: {
    marginTop: 2,
    fontSize: 10,
  },
});
