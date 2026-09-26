import React from 'react';
import { View, StyleSheet, Pressable, Image } from 'react-native';
import { Stethoscope, User, PawPrint } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ConversationSummary } from '../../types/message';

interface ConversationCardProps {
  conversation: ConversationSummary;
  onPress: (conversation: ConversationSummary) => void;
}

export function ConversationCard({ conversation, onPress }: ConversationCardProps) {
  const counterpart = conversation.counterpart;
  const isVet = counterpart?.role === 'vet';
  const name = counterpart?.name || conversation.subject || 'Clinical Consultation';
  const unreadCount = conversation.unread_count || 0;
  const lastMessage = conversation.last_message;

  // Format relative timestamp
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (diffDays === 1) {
        return 'Yesterday';
      }
      if (diffDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' });
      }
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const timeLabel = formatTime(lastMessage?.created_at || conversation.last_message_at);

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Conversation with ${name}, ${unreadCount > 0 ? `${unreadCount} unread messages` : 'no unread messages'}`}
        onPress={() => onPress(conversation)}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {counterpart?.avatar_url ? (
            <Image source={{ uri: counterpart.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatarFallback, isVet ? styles.vetAvatar : styles.parentAvatar]}>
              {isVet ? (
                <Stethoscope size={20} color={colors.ink} />
              ) : (
                <User size={20} color={colors.ink} />
              )}
            </View>
          )}
          {isVet && (
            <View style={styles.vetBadgeDot}>
              <Stethoscope size={9} color={colors.ink} />
            </View>
          )}
        </View>

        {/* Conversation details */}
        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <View style={styles.nameRoleContainer}>
              <Text variant="bodyMd" style={styles.nameText} numberOfLines={1}>
                {name}
              </Text>
              <View style={[styles.rolePill, isVet ? styles.vetPill : styles.parentPill]}>
                <Text variant="caption" style={styles.roleText}>
                  {isVet ? 'Doctor' : 'Pet Parent'}
                </Text>
              </View>
            </View>

            {timeLabel ? (
              <Text variant="caption" color={colors.muted} style={styles.timeText}>
                {timeLabel}
              </Text>
            ) : null}
          </View>

          {/* Appointment Context Chip (if linked) */}
          {conversation.appointment ? (
            <View style={styles.appointmentChip}>
              <PawPrint size={10} color={colors.primaryDark} />
              <Text variant="caption" color={colors.inkSoft} style={styles.appointmentText}>
                {conversation.appointment.pet_name} ·{' '}
                {new Date(conversation.appointment.starts_at).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
          ) : null}

          {/* Last Message Snippet & Unread Badge */}
          <View style={styles.messageRow}>
            <Text
              variant="bodySm"
              color={unreadCount > 0 ? colors.ink : colors.muted}
              style={[styles.snippetText, unreadCount > 0 && styles.unreadSnippetText]}
              numberOfLines={1}
            >
              {lastMessage?.body || 'No messages yet. Tap to start chatting.'}
            </Text>

            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text variant="caption" style={styles.unreadBadgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.sm,
    padding: 0,
    overflow: 'hidden',
  },
  pressable: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  pressed: {
    backgroundColor: colors.surface,
    opacity: 0.9,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vetAvatar: {
    backgroundColor: colors.primary,
  },
  parentAvatar: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  vetBadgeDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  contentContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  nameRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  nameText: {
    fontWeight: '700',
    color: colors.ink,
    marginRight: spacing.xs,
    flexShrink: 1,
  },
  rolePill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  vetPill: {
    backgroundColor: '#EBF8D3',
  },
  parentPill: {
    backgroundColor: colors.surface,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  timeText: {
    fontSize: 11,
  },
  appointmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 4,
    marginTop: 2,
    gap: 4,
  },
  appointmentText: {
    fontSize: 11,
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  snippetText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  unreadSnippetText: {
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.primaryDark,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '700',
  },
});
