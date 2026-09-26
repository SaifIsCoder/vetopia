import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, Clock, Shield, Camera, AlertCircle, User, Heart } from 'lucide-react-native';
import { Appointment } from '../../types/appointment';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CallControls } from './CallControls';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface WaitingRoomViewProps {
  appointment: Appointment;
  isVet: boolean;
  isMicMuted: boolean;
  isVideoMuted: boolean;
  isFrontCamera: boolean;
  isSpeakerOn: boolean;
  hasPermissions: boolean;
  permissionError: string | null;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onToggleSpeaker: () => void;
  onEnterConsultation: () => void;
  onExit: () => void;
  onRetryPermissions: () => void;
}

export const WaitingRoomView: React.FC<WaitingRoomViewProps> = ({
  appointment,
  isVet,
  isMicMuted,
  isVideoMuted,
  isFrontCamera,
  isSpeakerOn,
  hasPermissions,
  permissionError,
  onToggleMic,
  onToggleVideo,
  onFlipCamera,
  onToggleSpeaker,
  onEnterConsultation,
  onExit,
  onRetryPermissions,
}) => {
  const vetName = appointment.vet?.name || 'Dr. Veterinarian';
  const vetSpecialty = appointment.vet?.specialty || 'General Veterinary Medicine';
  const petName = appointment.pet_name || 'Pet';
  const isVideoMode = appointment.mode === 'video';

  const startDate = new Date(appointment.starts_at);
  const formattedDate = !isNaN(startDate.getTime())
    ? startDate.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Today';

  const formattedTime = !isNaN(startDate.getTime())
    ? startDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Scheduled Time';

  const waitingStatusText = isVet
    ? 'Patient is in the Waiting Room'
    : 'Waiting for Doctor to admit you...';

  return (
    <View style={styles.container}>
      {/* Top Header Card */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onExit}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to appointments"
        >
          <Text variant="bodyMd" color={colors.primaryDark}>
            ← Back
          </Text>
        </TouchableOpacity>

        <View style={styles.titleRow}>
          <Heading level={2} style={styles.title}>
            Telemedicine Waiting Room
          </Heading>
          <View style={styles.encryptedChip}>
            <Shield size={14} color={colors.primaryDark} />
            <Text variant="caption" color={colors.primaryDark} style={styles.encryptedText}>
              LiveKit SFU Encrypted
            </Text>
          </View>
        </View>
      </View>

      {/* Appointment & Doctor Card */}
      <Card style={styles.infoCard}>
        <View style={styles.doctorRow}>
          <Avatar name={vetName} size={48} />
          <View style={styles.doctorInfo}>
            <Text variant="headingSm" color={colors.ink}>
              {vetName}
            </Text>
            <Text variant="caption" color={colors.primaryDark}>
              {vetSpecialty} {appointment.vet?.flag || ''}
            </Text>
          </View>
          <Badge
            variant={isVideoMode ? 'scheduled' : 'pending'}
            label={isVideoMode ? 'Video Visit' : 'Audio Visit'}
          />
        </View>

        <View style={styles.metaDivider} />

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Heart size={14} color={colors.muted} />
            <Text variant="caption" color={colors.inkSoft}>
              Patient:{' '}
              <Text variant="caption" color={colors.ink} style={styles.bold}>
                {petName}
              </Text>
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Calendar size={14} color={colors.muted} />
            <Text variant="caption" color={colors.inkSoft}>
              {formattedDate}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Clock size={14} color={colors.muted} />
            <Text variant="caption" color={colors.inkSoft}>
              {formattedTime}
            </Text>
          </View>
        </View>
      </Card>

      {/* Permission Error Banner */}
      {!hasPermissions && permissionError ? (
        <Card style={styles.errorCard}>
          <AlertCircle size={20} color={colors.destructive} style={styles.errorIcon} />
          <View style={styles.errorBody}>
            <Text variant="bodySm" color={colors.destructive} style={styles.bold}>
              Device Access Required
            </Text>
            <Text variant="caption" color={colors.inkSoft} style={styles.errorMsg}>
              {permissionError}
            </Text>
            <TouchableOpacity onPress={onRetryPermissions} style={styles.retryBtn}>
              <Text variant="caption" color={colors.primaryDark} style={styles.bold}>
                Request Permissions Again
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : null}

      {/* Device Check & Self-Preview Box */}
      <View style={styles.previewContainer}>
        {isVideoMode && !isVideoMuted && hasPermissions ? (
          <View style={styles.cameraPlaceholderBox}>
            <Camera size={36} color={colors.primaryDark} />
            <Text variant="caption" color={colors.inkSoft} style={styles.previewLabel}>
              Camera Active ({isFrontCamera ? 'Front Camera' : 'Rear Camera'})
            </Text>
            <Text variant="caption" color={colors.muted}>
              Device is ready for high-definition streaming
            </Text>
          </View>
        ) : (
          <View style={styles.avatarPlaceholderBox}>
            <User size={48} color={colors.muted} />
            <Text variant="bodySm" color={colors.ink} style={styles.bold}>
              {isVideoMuted ? 'Camera is Turned Off' : 'Audio-Only Consultation'}
            </Text>
            <Text variant="caption" color={colors.muted}>
              {isMicMuted ? 'Microphone is Muted' : 'Microphone is Active'}
            </Text>
          </View>
        )}

        {/* Floating Quick Controls inside Waiting Room */}
        <View style={styles.floatingControls}>
          <CallControls
            isMicMuted={isMicMuted}
            isVideoMuted={isVideoMuted}
            isFrontCamera={isFrontCamera}
            isSpeakerOn={isSpeakerOn}
            isVideoMode={isVideoMode}
            onToggleMic={onToggleMic}
            onToggleVideo={onToggleVideo}
            onFlipCamera={onFlipCamera}
            onToggleSpeaker={onToggleSpeaker}
            onEndCall={onExit}
          />
        </View>
      </View>

      {/* Waiting State Notice */}
      <View style={styles.waitingBanner}>
        <View style={styles.pulseDot} />
        <Text variant="bodySm" color={colors.inkSoft} style={styles.waitingText}>
          {waitingStatusText}
        </Text>
      </View>

      {/* Action Button */}
      <Button
        title="Enter Consultation Room"
        onPress={onEnterConsultation}
        variant="primary"
        style={styles.joinButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: spacing.sm,
  },
  backBtn: {
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
  },
  encryptedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDF4',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  encryptedText: {
    fontSize: 10,
    fontWeight: '700',
  },
  infoCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  doctorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  doctorInfo: {
    flex: 1,
  },
  metaDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bold: {
    fontWeight: '700',
  },
  errorCard: {
    flexDirection: 'row',
    backgroundColor: '#FEE2E2',
    borderColor: colors.destructive,
    borderWidth: 1,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  errorIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  errorBody: {
    flex: 1,
  },
  errorMsg: {
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  retryBtn: {
    alignSelf: 'flex-start',
  },
  previewContainer: {
    flex: 1,
    minHeight: 220,
    maxHeight: 320,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing.sm,
  },
  cameraPlaceholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  avatarPlaceholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.xs,
  },
  previewLabel: {
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  floatingControls: {
    position: 'absolute',
    bottom: spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryDark,
  },
  waitingText: {
    fontWeight: '600',
  },
  joinButton: {
    width: '100%',
    marginBottom: spacing.md,
  },
});
