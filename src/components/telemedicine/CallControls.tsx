import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  SwitchCamera,
  Volume2,
  VolumeX,
  PhoneOff,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface CallControlsProps {
  isMicMuted: boolean;
  isVideoMuted: boolean;
  isFrontCamera: boolean;
  isSpeakerOn: boolean;
  isVideoMode: boolean;
  onToggleMic: () => void;
  onToggleVideo: () => void;
  onFlipCamera: () => void;
  onToggleSpeaker: () => void;
  onEndCall: () => void;
  endCallLabel?: string;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMicMuted,
  isVideoMuted,
  isFrontCamera,
  isSpeakerOn,
  isVideoMode,
  onToggleMic,
  onToggleVideo,
  onFlipCamera,
  onToggleSpeaker,
  onEndCall,
}) => {
  return (
    <View style={styles.dock}>
      {/* Microphone Mute Toggle */}
      <TouchableOpacity
        testID="control-mic"
        accessibilityRole="button"
        accessibilityLabel={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
        style={[styles.controlBtn, isMicMuted && styles.mutedBtn]}
        onPress={onToggleMic}
        activeOpacity={0.8}
      >
        {isMicMuted ? (
          <MicOff size={22} color={colors.white} />
        ) : (
          <Mic size={22} color={colors.ink} />
        )}
      </TouchableOpacity>

      {/* Video Privacy Toggle (Only in video mode) */}
      {isVideoMode ? (
        <TouchableOpacity
          testID="control-video"
          accessibilityRole="button"
          accessibilityLabel={isVideoMuted ? 'Turn on camera' : 'Turn off camera'}
          style={[styles.controlBtn, isVideoMuted && styles.mutedBtn]}
          onPress={onToggleVideo}
          activeOpacity={0.8}
        >
          {isVideoMuted ? (
            <VideoOff size={22} color={colors.white} />
          ) : (
            <Video size={22} color={colors.ink} />
          )}
        </TouchableOpacity>
      ) : null}

      {/* Flip Camera (Only when video is enabled) */}
      {isVideoMode && !isVideoMuted ? (
        <TouchableOpacity
          testID="control-flip"
          accessibilityRole="button"
          accessibilityLabel={`Flip camera, currently ${isFrontCamera ? 'front' : 'back'}`}
          style={styles.controlBtn}
          onPress={onFlipCamera}
          activeOpacity={0.8}
        >
          <SwitchCamera size={22} color={colors.ink} />
        </TouchableOpacity>
      ) : null}

      {/* Speakerphone Toggle */}
      <TouchableOpacity
        testID="control-speaker"
        accessibilityRole="button"
        accessibilityLabel={isSpeakerOn ? 'Switch to earpiece' : 'Switch to speakerphone'}
        style={[styles.controlBtn, !isSpeakerOn && styles.dimBtn]}
        onPress={onToggleSpeaker}
        activeOpacity={0.8}
      >
        {isSpeakerOn ? (
          <Volume2 size={22} color={colors.ink} />
        ) : (
          <VolumeX size={22} color={colors.muted} />
        )}
      </TouchableOpacity>

      {/* End / Leave Consultation (Prominent Red Button) */}
      <TouchableOpacity
        testID="control-end-call"
        accessibilityRole="button"
        accessibilityLabel="End consultation"
        style={styles.endCallBtn}
        onPress={onEndCall}
        activeOpacity={0.8}
      >
        <PhoneOff size={24} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(19, 22, 22, 0.85)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mutedBtn: {
    backgroundColor: colors.destructive,
  },
  dimBtn: {
    backgroundColor: colors.surface,
  },
  endCallBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.destructive,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
