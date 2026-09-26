import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Calendar, Clock, Video, Phone, MessageSquare, Pill, FilePlus } from 'lucide-react-native';
import { Appointment } from '../../types/appointment';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';
import { useAuthStore } from '../../store/authStore';
import { useAppointmentPrescription } from '../../hooks/usePrescriptions';
import { messageService } from '../../lib/messages/messageService';

export interface AppointmentCardProps {
  appointment: Appointment;
  onCancel?: (appointment: Appointment) => void;
  onPress?: (appointment: Appointment) => void;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onCancel,
  onPress,
}) => {
  const startDate = new Date(appointment.starts_at);
  const formattedDate = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Scheduled Date';

  const formattedTime = !isNaN(startDate.getTime())
    ? startDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '00:00';

  const vetName = appointment.vet?.name || 'Dr. Veterinarian';
  const vetSpecialty = appointment.vet?.specialty || 'General Veterinary Medicine';
  const petName = appointment.pet_name || 'Pet';
  const petSpecies = appointment.species ? ` (${appointment.species})` : '';

  const renderModeIcon = () => {
    switch (appointment.mode) {
      case 'audio':
        return <Phone size={13} color={colors.primaryDark} />;
      case 'chat':
        return <MessageSquare size={13} color={colors.primaryDark} />;
      case 'video':
      default:
        return <Video size={13} color={colors.primaryDark} />;
    }
  };

  const router = useRouter();

  const { user, role } = useAuthStore();
  const isVet = user?.isVet === true || role === 'vet';

  const isScheduled = appointment.status === 'scheduled';
  const isCancelled = appointment.status === 'cancelled';
  const isCompleted = appointment.status === 'completed';

  const { data: prescription } = useAppointmentPrescription(isCompleted ? appointment.id : '');
  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const handleOpenChat = async () => {
    setIsOpeningChat(true);
    try {
      const res = await messageService.getOrCreateAppointmentConversation(appointment.id);
      if (res && res.id) {
        router.push(`/messages/${res.id}`);
      }
    } catch (err) {
      console.warn('Could not open conversation:', err);
    } finally {
      setIsOpeningChat(false);
    }
  };

  return (
    <Card style={styles.card}>
      {/* Top Header: Doctor info & Status */}
      <View style={styles.headerRow}>
        <Avatar name={vetName} size={48} style={styles.avatar} />

        <View style={styles.infoCol}>
          <Text variant="headingSm" color={colors.ink} numberOfLines={1}>
            {vetName}
          </Text>
          <Text variant="caption" color={colors.primaryDark} numberOfLines={1}>
            {vetSpecialty}
          </Text>
          {appointment.vet?.country ? (
            <Text variant="caption" color={colors.inkSoft}>
              {appointment.vet.flag ? `${appointment.vet.flag} ` : ''}
              {appointment.vet.country}
            </Text>
          ) : null}
        </View>

        <View style={styles.statusCol}>
          {isScheduled ? (
            <Badge variant="scheduled" label="Scheduled" style={styles.scheduledBadge} />
          ) : isCancelled ? (
            <Badge variant="cancelled" label="Cancelled" />
          ) : isCompleted ? (
            <Badge variant="completed" label="Completed" />
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Appointment Details */}
      <View style={styles.detailsGrid}>
        {/* Date & Time */}
        <View style={styles.detailRow}>
          <View style={styles.metaItem}>
            <Calendar size={14} color={colors.muted} />
            <Text variant="caption" color={colors.ink} style={styles.metaText}>
              {formattedDate}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={14} color={colors.muted} />
            <Text variant="caption" color={colors.ink} style={styles.metaText}>
              {formattedTime}
            </Text>
          </View>
        </View>

        {/* Patient & Format */}
        <View style={styles.detailRow}>
          <View style={styles.metaItem}>
            <Text variant="caption" color={colors.muted}>
              Patient:
            </Text>
            <Text variant="caption" color={colors.ink} style={styles.boldText}>
              {petName}
              {petSpecies}
            </Text>
          </View>

          <View style={styles.modeChip}>
            {renderModeIcon()}
            <Text variant="caption" color={colors.primaryDark} style={styles.modeText}>
              {appointment.mode.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Symptoms snippet if present */}
        {appointment.symptoms ? (
          <View style={styles.symptomsRow}>
            <Text variant="caption" color={colors.muted}>
              Symptoms:{' '}
            </Text>
            <Text
              variant="caption"
              color={colors.inkSoft}
              numberOfLines={2}
              style={styles.symptomsText}
            >
              {appointment.symptoms}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Action Footer for Scheduled appointments */}
      {isScheduled ? (
        <View style={styles.footerRow}>
          <View style={styles.priceBox}>
            <Text variant="caption" color={colors.muted}>
              Fee:{' '}
            </Text>
            <Text variant="caption" color={colors.ink} style={styles.boldText}>
              ${Number(appointment.price_usd || 0).toFixed(0)}
            </Text>
          </View>

          <View style={styles.actionsBox}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${vetName}`}
              onPress={handleOpenChat}
              disabled={isOpeningChat}
              style={({ pressed }) => [styles.chatBtn, pressed && styles.pressed]}
            >
              <MessageSquare size={13} color={colors.ink} />
              <Text variant="caption" color={colors.ink} style={styles.chatBtnText}>
                {isOpeningChat ? 'Opening...' : 'Chat'}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Enter consultation room with ${vetName}`}
              onPress={() => router.push(`/consult/${appointment.id}`)}
              style={({ pressed }) => [styles.enterBtn, pressed && styles.pressed]}
            >
              <Video size={13} color={colors.ink} />
              <Text variant="caption" color={colors.ink} style={styles.enterBtnText}>
                Enter Room
              </Text>
            </Pressable>

            {onCancel ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Cancel appointment with ${vetName}`}
                onPress={() => onCancel(appointment)}
                style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
              >
                <Text variant="caption" color={colors.destructive} style={styles.cancelText}>
                  Cancel Appointment
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* Action Footer for Completed appointments (Phase 7 Prescription Integration & Clinical Chat) */}
      {isCompleted ? (
        <View style={styles.footerRow}>
          <View style={styles.priceBox}>
            <Text variant="caption" color={colors.muted}>
              Status:{' '}
            </Text>
            <Text variant="caption" color={colors.primaryDark} style={styles.boldText}>
              Concluded
            </Text>
          </View>

          <View style={styles.actionsBox}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chat regarding consultation with ${vetName}`}
              onPress={handleOpenChat}
              disabled={isOpeningChat}
              style={({ pressed }) => [styles.chatBtn, pressed && styles.pressed]}
            >
              <MessageSquare size={13} color={colors.ink} />
              <Text variant="caption" color={colors.ink} style={styles.chatBtnText}>
                {isOpeningChat ? 'Opening...' : 'Chat'}
              </Text>
            </Pressable>

            {prescription ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View prescription for ${petName}`}
                onPress={() => router.push(`/prescriptions/${prescription.id}`)}
                style={({ pressed }) => [styles.rxBtn, pressed && styles.pressed]}
              >
                <Pill size={13} color={colors.primaryDark} />
                <Text variant="caption" color={colors.primaryDark} style={styles.rxBtnText}>
                  View Prescription
                </Text>
              </Pressable>
            ) : isVet ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Create prescription for ${petName}`}
                onPress={() => router.push(`/consult/${appointment.id}/prescription`)}
                style={({ pressed }) => [styles.createRxBtn, pressed && styles.pressed]}
              >
                <FilePlus size={13} color={colors.ink} />
                <Text variant="caption" color={colors.ink} style={styles.createRxBtnText}>
                  Create Prescription
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: spacing.md,
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  statusCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  scheduledBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  detailsGrid: {
    gap: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontWeight: '600',
  },
  boldText: {
    fontWeight: '700',
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  modeText: {
    fontWeight: '700',
    fontSize: 10,
  },
  symptomsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
  },
  symptomsText: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  enterBtnText: {
    fontWeight: '700',
    fontSize: 11,
  },
  cancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
  },
  cancelText: {
    fontWeight: '700',
  },
  rxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  rxBtnText: {
    fontWeight: '700',
    fontSize: 11,
  },
  createRxBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  createRxBtnText: {
    fontWeight: '700',
    fontSize: 11,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingVertical: 5,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chatBtnText: {
    fontWeight: '700',
    fontSize: 11,
  },
  pressed: {
    opacity: 0.7,
  },
});
