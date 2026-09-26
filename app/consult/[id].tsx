import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { WaitingRoomView } from '../../src/components/telemedicine/WaitingRoomView';
import { ActiveCallView } from '../../src/components/telemedicine/ActiveCallView';
import { useAppointment, useCompleteAppointment } from '../../src/hooks/useAppointments';
import { useAuthStore } from '../../src/store/authStore';
import {
  telemedicineService,
  TelemedicineTokenResponseData,
} from '../../src/lib/telemedicine/telemedicineService';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

export default function ConsultRoomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { user, role } = useAuthStore();
  const isVet = user?.isVet === true || role === 'vet';
  const { data: appointment, isLoading, isError, error } = useAppointment(id || '');
  const completeMutation = useCompleteAppointment();

  // Call hardware toggles
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Connection & lifecycle states
  const [isConnecting, setIsConnecting] = useState(false);
  const [tokenData, setTokenData] = useState<TelemedicineTokenResponseData | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectSeconds, setReconnectSeconds] = useState(0);

  // Device permissions
  const [hasPermissions, setHasPermissions] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Network Reconnection Timer tracking
  useEffect(() => {
    if (!isReconnecting) {
      return;
    }

    const timer = setInterval(() => {
      setReconnectSeconds((prev) => prev + 1);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [isReconnecting]);

  // Connect to LiveKit Room
  const handleEnterConsultation = async () => {
    if (!id) return;
    setIsConnecting(true);

    try {
      const data = await telemedicineService.requestConsultationToken(id);
      setTokenData(data);
      setIsConnecting(false);
    } catch (err: any) {
      setIsConnecting(false);
      const msg = err?.message || 'Failed to establish connection with LiveKit consultation room.';
      Alert.alert('Connection Failed', msg, [{ text: 'OK' }]);
    }
  };

  // End Consultation / Leave Room (FR-TELE-003)
  const handleEndCall = useCallback(() => {
    if (!id) return;

    if (isVet) {
      // Veterinarian is the authoritative actor to end and complete consultation
      Alert.alert(
        'End Consultation Visit',
        'Are you sure you want to conclude this consultation? This will mark the appointment as completed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End & Complete',
            style: 'destructive',
            onPress: async () => {
              try {
                await completeMutation.mutateAsync(id);
                setTokenData(null);
                Alert.alert(
                  'Consultation Concluded',
                  'The consultation has been completed successfully. Would you like to issue a digital prescription for this patient?',
                  [
                    {
                      text: 'Create Prescription',
                      onPress: () => router.replace(`/consult/${id}/prescription`),
                    },
                    {
                      text: 'Return to Hub',
                      onPress: () => router.replace('/(tabs)/appointments'),
                    },
                  ],
                );
              } catch (err: any) {
                Alert.alert(
                  'Completion Failed',
                  err?.message || 'Failed to mark consultation completed.',
                );
              }
            },
          },
        ],
      );
    } else {
      // Pet parent leaves the room (does not mark appointment completed)
      Alert.alert(
        'Leave Consultation Room',
        'Are you sure you want to leave the consultation room? You can re-enter while the appointment window is active.',
        [
          { text: 'Stay in Room', style: 'cancel' },
          {
            text: 'Leave Room',
            style: 'destructive',
            onPress: () => {
              setTokenData(null);
              router.replace('/(tabs)/appointments');
            },
          },
        ],
      );
    }
  }, [id, isVet, completeMutation, router]);

  // Retry connection
  const handleRetryConnection = () => {
    setIsReconnecting(false);
    setReconnectSeconds(0);
    handleEnterConsultation();
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
        <Text variant="bodyMd" color={colors.inkSoft} style={styles.loadingText}>
          Loading Consultation Room...
        </Text>
      </Screen>
    );
  }

  // 2. Ineligible / Error State
  if (isError || !appointment) {
    return (
      <Screen style={styles.container}>
        <EmptyState
          title="Consultation Unavailable"
          description={error?.message || 'Appointment not found.'}
          icon={<AlertCircle size={48} color={colors.destructive} />}
          actionTitle="Return to Appointments"
          onAction={() => router.replace('/(tabs)/appointments')}
        />
      </Screen>
    );
  }

  const eligibility = telemedicineService.checkEligibility(appointment);
  if (!eligibility.eligible) {
    return (
      <Screen style={styles.container}>
        <EmptyState
          title="Consultation Unavailable"
          description={eligibility.message}
          icon={<AlertCircle size={48} color={colors.destructive} />}
          actionTitle="Return to Appointments"
          onAction={() => router.replace('/(tabs)/appointments')}
        />
      </Screen>
    );
  }

  // 3. Connecting State
  if (isConnecting) {
    return (
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
        <Heading level={2} style={styles.connectingTitle}>
          Connecting to LiveKit Cloud...
        </Heading>
        <Text variant="bodySm" color={colors.muted}>
          Negotiating secure encrypted RTC audio/video stream
        </Text>
      </Screen>
    );
  }

  // 4. Connected Active Call State
  if (tokenData) {
    return (
      <ActiveCallView
        appointment={appointment}
        isVet={isVet}
        participantName={tokenData.participant_name}
        remoteParticipantName={
          isVet
            ? appointment.pet_name
              ? `${appointment.pet_name}'s Family`
              : 'Pet Parent'
            : appointment.vet?.name || 'Dr. Veterinarian'
        }
        isMicMuted={isMicMuted}
        isVideoMuted={appointment.mode === 'audio' ? true : isVideoMuted}
        isFrontCamera={isFrontCamera}
        isSpeakerOn={isSpeakerOn}
        isReconnecting={isReconnecting}
        reconnectSeconds={reconnectSeconds}
        onToggleMic={() => setIsMicMuted((prev) => !prev)}
        onToggleVideo={() => setIsVideoMuted((prev) => !prev)}
        onFlipCamera={() => setIsFrontCamera((prev) => !prev)}
        onToggleSpeaker={() => setIsSpeakerOn((prev) => !prev)}
        onEndCall={handleEndCall}
        onRetryConnection={handleRetryConnection}
      />
    );
  }

  // 5. Default Waiting Room State
  return (
    <WaitingRoomView
      appointment={appointment}
      isVet={isVet}
      isMicMuted={isMicMuted}
      isVideoMuted={appointment.mode === 'audio' ? true : isVideoMuted}
      isFrontCamera={isFrontCamera}
      isSpeakerOn={isSpeakerOn}
      hasPermissions={hasPermissions}
      permissionError={permissionError}
      onToggleMic={() => setIsMicMuted((prev) => !prev)}
      onToggleVideo={() => setIsVideoMuted((prev) => !prev)}
      onFlipCamera={() => setIsFrontCamera((prev) => !prev)}
      onToggleSpeaker={() => setIsSpeakerOn((prev) => !prev)}
      onEnterConsultation={handleEnterConsultation}
      onExit={() => router.replace('/(tabs)/appointments')}
      onRetryPermissions={() => {
        setHasPermissions(true);
        setPermissionError(null);
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  connectingTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
});
