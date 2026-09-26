import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check, Clock, AlertCircle } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { DirectMessage } from '../../types/message';

interface MessageBubbleProps {
  message: DirectMessage;
  isCurrentUser: boolean;
  senderName?: string;
}

export function MessageBubble({ message, isCurrentUser, senderName }: MessageBubbleProps) {
  const formattedTime = (() => {
    try {
      const date = new Date(message.created_at);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  })();

  const isSending = message.status === 'sending';
  const isFailed = message.status === 'failed';

  return (
    <View
      style={[
        styles.container,
        isCurrentUser ? styles.currentUserContainer : styles.counterpartContainer,
      ]}
    >
      {!isCurrentUser && senderName ? (
        <Text variant="caption" color={colors.muted} style={styles.senderLabel}>
          {senderName}
        </Text>
      ) : null}

      <View
        style={[
          styles.bubble,
          isCurrentUser ? styles.currentUserBubble : styles.counterpartBubble,
          isFailed && styles.failedBubble,
        ]}
      >
        <Text
          variant="bodyMd"
          style={[
            styles.messageText,
            isCurrentUser ? styles.currentUserText : styles.counterpartText,
          ]}
        >
          {message.body}
        </Text>

        <View style={styles.metaRow}>
          <Text
            variant="caption"
            style={[
              styles.timeText,
              isCurrentUser ? styles.currentUserTime : styles.counterpartTime,
            ]}
          >
            {formattedTime}
          </Text>

          {isCurrentUser && (
            <View style={styles.statusIconContainer}>
              {isSending ? (
                <Clock size={11} color="rgba(255, 255, 255, 0.7)" />
              ) : isFailed ? (
                <AlertCircle size={11} color={colors.destructive} />
              ) : (
                <Check size={12} color="rgba(255, 255, 255, 0.85)" />
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '82%',
  },
  currentUserContainer: {
    alignSelf: 'flex-end',
  },
  counterpartContainer: {
    alignSelf: 'flex-start',
  },
  senderLabel: {
    marginBottom: 2,
    marginLeft: spacing.xs,
    fontSize: 11,
    fontWeight: '500',
  },
  bubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  currentUserBubble: {
    backgroundColor: colors.ink,
    borderBottomRightRadius: 4,
  },
  counterpartBubble: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  failedBubble: {
    borderColor: colors.destructive,
    borderWidth: 1,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
  },
  currentUserText: {
    color: colors.white,
  },
  counterpartText: {
    color: colors.ink,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 10,
  },
  currentUserTime: {
    color: 'rgba(255, 255, 255, 0.65)',
  },
  counterpartTime: {
    color: colors.muted,
  },
  statusIconContainer: {
    marginLeft: 2,
  },
});
