import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Calendar, PawPrint, Video, Phone, MessageSquare } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { ConversationAppointmentContext } from '../../types/message';

interface AppointmentContextBannerProps {
  appointment: ConversationAppointmentContext;
  onPress?: () => void;
}

export function AppointmentContextBanner({ appointment, onPress }: AppointmentContextBannerProps) {
  const formattedDateTime = (() => {
    try {
      const d = new Date(appointment.starts_at);
      const dateStr = d.toLocaleDateString([], {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} at ${timeStr}`;
    } catch {
      return '';
    }
  })();

  const isCompleted = appointment.status === 'completed';

  const renderModeIcon = () => {
    switch (appointment.mode) {
      case 'video':
        return <Video size={12} color={colors.inkSoft} />;
      case 'audio':
        return <Phone size={12} color={colors.inkSoft} />;
      default:
        return <MessageSquare size={12} color={colors.inkSoft} />;
    }
  };

  return (
    <View style={styles.banner}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Appointment for ${appointment.pet_name} with ${appointment.vet_name}, status ${appointment.status}`}
        onPress={onPress}
        disabled={!onPress}
        style={styles.innerRow}
      >
        <View style={styles.petIconContainer}>
          <PawPrint size={14} color={colors.primaryDark} />
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.titleRow}>
            <Text variant="caption" style={styles.petText} numberOfLines={1}>
              {appointment.pet_name} · {appointment.vet_name}
            </Text>
            <View
              style={[styles.statusPill, isCompleted ? styles.completedPill : styles.scheduledPill]}
            >
              <Text variant="caption" style={styles.statusText}>
                {isCompleted ? 'Concluded' : 'Scheduled'}
              </Text>
            </View>
          </View>

          <View style={styles.subRow}>
            <Calendar size={11} color={colors.muted} />
            <Text variant="caption" color={colors.muted} style={styles.timeText}>
              {formattedDateTime}
            </Text>
            <View style={styles.modeTag}>
              {renderModeIcon()}
              <Text variant="caption" color={colors.inkSoft} style={styles.modeText}>
                {appointment.mode}
              </Text>
            </View>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#F7F9F3',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  detailsContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petText: {
    fontWeight: '700',
    color: colors.ink,
    flex: 1,
    marginRight: spacing.xs,
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  completedPill: {
    backgroundColor: '#E8F5E9',
  },
  scheduledPill: {
    backgroundColor: '#EBF8D3',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    marginRight: spacing.sm,
  },
  modeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  modeText: {
    fontSize: 10,
    textTransform: 'capitalize',
  },
});
