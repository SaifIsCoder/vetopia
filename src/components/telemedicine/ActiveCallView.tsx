import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Shield, User, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { Appointment } from '../../types/appointment';
import { Text } from '../ui/Text';
import { Avatar } from '../ui/Avatar';
import { CallControls } from './CallControls';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface ActiveCallViewProps {
  appointment: Appointment;
  isVet: boolean;
  participantName: string;
  remoteParticipantName: string;
  isMicMuted: boolean;
  isVideoMuted: boolean;
  isFrontCamera: boolean;
  isSpeakerOn: boolean;
  isReconnecting: boolean;
  reconnectSeconds: number;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  onRetryConnection: () => void;
}

export const ActiveCallView: React.FC<ActiveCallViewProps> = ({
  appointment,
  isVet,
  participantName,
  remoteParticipantName,
  isMicMuted,
  isVideoMuted,
  isFrontCamera,
  isSpeakerOn,
  isReconnecting,
  reconnectSeconds,
  onToggleMic,
  onToggleVideo,
  onFlipCamera,
  onToggleSpeaker,
  onEndCall,
  onRetryConnection,
}) => {
  const isVideoMode = appointment.mode === 'video';
  const [callSeconds, setCallSeconds] = useState(0);

  // Live call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      {/* Top Overlay Bar */}
      <View style={styles.topBar}>
        <View style={styles.identityCol}>
          <Text variant="bodySm" color={colors.white} style={styles.bold}>
            {remoteParticipantName ||
              (isVet ? 'Pet Parent' : appointment.vet?.name || 'Dr. Veterinarian')}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.7)">
            Patient: {appointment.pet_name || 'Pet'}
          </Text>
        </View>

        {/* Call Timer & Security Pill */}
        <View style={styles.pillRow}>
          <View style={styles.timerPill}>
            <View style={styles.liveDot} />
            <Text variant="caption" color={colors.white} style={styles.bold}>
              {formatTimer(callSeconds)}
            </Text>
          </View>

          <View style={styles.securityPill}>
            <Shield size={12} color={colors.primary} />
            <Text variant="caption" color={colors.primary} style={styles.securityText}>
              Encrypted
            </Text>
          </View>
        </View>
      </View>

      {/* Main Video Viewport (Remote Participant) */}
      <View style={styles.viewport}>
        {/* Reconnection Overlay if network drops */}
        {isReconnecting ? (
          <View style={styles.reconnectBanner}>
            <RefreshCw size={18} color={colors.warning} style={styles.spinIcon} />
            <View style={styles.reconnectTextCol}>
              <Text variant="bodySm" color={colors.white} style={styles.bold}>
                Connection unstable. Reconnecting... ({reconnectSeconds}s)
              </Text>
              {reconnectSeconds >= 20 ? (
                <TouchableOpacity onPress={onRetryConnection} style={styles.retryActionBtn}>
                  <AlertTriangle size={14} color={colors.destructive} />
                  <Text variant="caption" color={colors.destructive} style={styles.bold}>
                    Connection lost. Tap to reconnect now.
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {/* Remote Participant Media Placeholder */}
        <View style={styles.remotePlaceholder}>
          <Avatar
            name={
              remoteParticipantName || (isVet ? 'Pet Parent' : appointment.vet?.name || 'Doctor')
            }
            size={96}
            style={styles.remoteAvatar}
          />
          <Text variant="headingSm" color={colors.white} style={styles.remoteName}>
            {remoteParticipantName || (isVet ? 'Pet Parent' : appointment.vet?.name || 'Doctor')}
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.7)">
            {isVideoMode ? 'Remote Video Stream Connected' : 'Audio Call Active'}
          </Text>
        </View>

        {/* Local Floating PiP Window (Bottom Right Corner) */}
        {isVideoMode ? (
          <View style={styles.localPipWindow}>
            {!isVideoMuted ? (
              <View style={styles.localPipVideo}>
                <Text variant="caption" color={colors.white} style={styles.pipLabel}>
                  {isFrontCamera ? 'You (Front)' : 'You (Rear)'}
                </Text>
              </View>
            ) : (
              <View style={styles.localPipMuted}>
                <User size={24} color={colors.white} />
                <Text variant="caption" color="rgba(255,255,255,0.6)" style={styles.pipMutedText}>
                  Cam Off
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>

      {/* Floating Bottom Controls Dock */}
      <View style={styles.bottomDock}>
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
          onEndCall={onEndCall}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1212',
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    zIndex: 10,
  },
  identityCol: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.destructive,
  },
  securityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(168, 232, 49, 0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  securityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  viewport: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reconnectBanner: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    zIndex: 20,
    backgroundColor: 'rgba(217, 119, 6, 0.9)',
    borderRadius: radii.md,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  spinIcon: {
    marginLeft: 2,
  },
  reconnectTextCol: {
    flex: 1,
  },
  retryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  remotePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  remoteAvatar: {
    marginBottom: spacing.xs,
  },
  remoteName: {
    fontSize: 18,
  },
  localPipWindow: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    width: 100,
    height: 140,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#1E2424',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 6,
  },
  localPipVideo: {
    flex: 1,
    backgroundColor: '#2A3333',
    justifyContent: 'flex-end',
    padding: 6,
  },
  pipLabel: {
    fontSize: 9,
    fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 2,
    alignSelf: 'flex-start',
  },
  localPipMuted: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1C2222',
  },
  pipMutedText: {
    fontSize: 9,
    marginTop: 2,
  },
  bottomDock: {
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
});
