import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Pressable, ActivityIndicator, Platform } from 'react-native';
import { ArrowUp, AlertCircle } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

interface MessageComposerProps {
  onSend: (text: string) => Promise<void> | void;
  isSending?: boolean;
  disabled?: boolean;
  errorMessage?: string | null;
  placeholder?: string;
}

const MAX_CHAR_LIMIT = 4000;
const WARNING_CHAR_THRESHOLD = 3800;

export function MessageComposer({
  onSend,
  isSending = false,
  disabled = false,
  errorMessage = null,
  placeholder = 'Write a clinical message...',
}: MessageComposerProps) {
  const [text, setText] = useState('');

  const trimmed = text.trim();
  const charCount = text.length;
  const isOverLimit = charCount > MAX_CHAR_LIMIT;
  const canSend = trimmed.length > 0 && !isOverLimit && !isSending && !disabled;

  const handleSend = async () => {
    if (!canSend) return;
    const bodyToSend = trimmed;
    setText('');
    try {
      await onSend(bodyToSend);
    } catch {
      // Restore text if send fails
      setText(bodyToSend);
    }
  };

  return (
    <View style={styles.wrapper}>
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <AlertCircle size={14} color={colors.destructive} />
          <Text variant="caption" color={colors.destructive} style={styles.errorText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      <View style={styles.container}>
        <TextInput
          accessibilityLabel="Message input"
          accessibilityHint={`Enter your message, up to ${MAX_CHAR_LIMIT} characters`}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          multiline
          maxLength={MAX_CHAR_LIMIT + 50} // slight buffer so user sees limit warning
          editable={!isSending && !disabled}
          style={styles.input}
        />

        <View style={styles.actionsContainer}>
          {charCount >= WARNING_CHAR_THRESHOLD && (
            <Text
              variant="caption"
              color={isOverLimit ? colors.destructive : colors.warning}
              style={styles.charCountText}
            >
              {charCount}/{MAX_CHAR_LIMIT}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: !canSend }}
            onPress={handleSend}
            disabled={!canSend}
            style={({ pressed }) => [
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
              pressed && canSend && styles.sendButtonPressed,
            ]}
          >
            {isSending ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : (
              <ArrowUp size={18} color={canSend ? colors.ink : colors.muted} />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    marginBottom: spacing.xs,
    gap: 6,
  },
  errorText: {
    flex: 1,
    fontSize: 12,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    minHeight: 36,
    maxHeight: 120,
    paddingHorizontal: spacing.sm,
    paddingTop: Platform.OS === 'ios' ? 6 : 8,
    paddingBottom: Platform.OS === 'ios' ? 6 : 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 4,
    gap: 6,
  },
  charCountText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    backgroundColor: colors.border,
    opacity: 0.6,
  },
  sendButtonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.95 }],
  },
});
