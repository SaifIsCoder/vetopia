/**
 * LiveKit WebRTC Consultation Room Hook (MVP-05: FR-TELE-001 / FR-TELE-002 / FR-TELE-003)
 * Vetopia Mobile
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  Room,
  RoomEvent,
  Track,
  VideoTrack as LKVideoTrack,
  LocalVideoTrack,
  RemoteTrackPublication,
  RemoteParticipant,
  ConnectionState,
} from 'livekit-client';
import { AudioSession, registerGlobals, isWebRTCAvailable } from './livekitNative';

// Safely register WebRTC globals on mobile startup if native WebRTC is available
try {
  if (isWebRTCAvailable) {
    registerGlobals();
  }
} catch (err) {
  console.warn('[LiveKit] registerGlobals error:', err);
}

export interface UseLiveKitRoomOptions {
  serverUrl?: string;
  token?: string;
  autoConnect?: boolean;
  isVideoEnabled?: boolean;
  isAudioEnabled?: boolean;
  onDisconnected?: () => void;
  onError?: (err: Error) => void;
}

export function useLiveKitRoom(options: UseLiveKitRoomOptions = {}) {
  const {
    serverUrl,
    token,
    autoConnect = false,
    isVideoEnabled = true,
    isAudioEnabled = true,
    onDisconnected,
    onError,
  } = options;

  const roomRef = useRef<Room | null>(null);

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.Disconnected,
  );
  const [localVideoTrack, setLocalVideoTrack] = useState<LocalVideoTrack | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<LKVideoTrack | null>(null);
  const [remoteParticipantName, setRemoteParticipantName] = useState<string>('');
  const [isMicMuted, setIsMicMuted] = useState(!isAudioEnabled);
  const [isVideoMuted, setIsVideoMuted] = useState(!isVideoEnabled);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize room instance
  const getOrCreateRoom = useCallback(() => {
    if (!roomRef.current) {
      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      room
        .on(RoomEvent.ConnectionStateChanged, (state: ConnectionState) => {
          setConnectionState(state);
          if (state === ConnectionState.Disconnected) {
            setLocalVideoTrack(null);
            setRemoteVideoTrack(null);
            onDisconnected?.();
          }
        })
        .on(
          RoomEvent.TrackSubscribed,
          (track: Track, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
            if (track.kind === Track.Kind.Video) {
              setRemoteVideoTrack(track as LKVideoTrack);
              setRemoteParticipantName(participant.name || participant.identity);
            }
          },
        )
        .on(
          RoomEvent.TrackUnsubscribed,
          (track: Track, _publication: RemoteTrackPublication) => {
            if (track.kind === Track.Kind.Video) {
              setRemoteVideoTrack(null);
            }
          },
        )
        .on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
          setRemoteParticipantName(participant.name || participant.identity);
        })
        .on(RoomEvent.ParticipantDisconnected, () => {
          setRemoteVideoTrack(null);
          setRemoteParticipantName('');
        });

      roomRef.current = room;
    }
    return roomRef.current;
  }, [onDisconnected]);

  // Connect to LiveKit Room
  const connect = useCallback(
    async (connectUrl?: string, connectToken?: string) => {
      const targetUrl = connectUrl || serverUrl;
      const targetToken = connectToken || token;

      if (!targetUrl || !targetToken) {
        const missingErr = new Error('Both LiveKit server URL and access token are required.');
        setError(missingErr);
        onError?.(missingErr);
        return;
      }

      if (!isWebRTCAvailable && Platform.OS !== 'web') {
        const devBuildErr = new Error(
          'LiveKit WebRTC requires an Expo Development Build (npx expo run:android / ios). Expo Go does not include native WebRTC libraries.',
        );
        console.warn('[LiveKit]', devBuildErr.message);
        setError(devBuildErr);
        onError?.(devBuildErr);
        return;
      }

      try {
        const room = getOrCreateRoom();

        // Start Apple audio session if on iOS
        if (Platform.OS === 'ios') {
          await AudioSession.startAudioSession();
        }

        await room.connect(targetUrl, targetToken);

        // Publish local camera and mic
        if (isVideoEnabled) {
          await room.localParticipant.setCameraEnabled(true);
          const camPublication = room.localParticipant.getTrackPublication(Track.Source.Camera);
          if (camPublication?.track) {
            setLocalVideoTrack(camPublication.track as LocalVideoTrack);
          }
          setIsVideoMuted(false);
        }

        if (isAudioEnabled) {
          await room.localParticipant.setMicrophoneEnabled(true);
          setIsMicMuted(false);
        }
      } catch (err: any) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        onError?.(errorObj);
      }
    },
    [serverUrl, token, isVideoEnabled, isAudioEnabled, getOrCreateRoom, onError],
  );

  // Disconnect from Room
  const disconnect = useCallback(async () => {
    try {
      if (roomRef.current) {
        await roomRef.current.disconnect();
        roomRef.current = null;
      }
      if (Platform.OS === 'ios') {
        await AudioSession.stopAudioSession();
      }
    } catch (err) {
      console.warn('[LiveKit] Error disconnecting room:', err);
    } finally {
      setLocalVideoTrack(null);
      setRemoteVideoTrack(null);
      setConnectionState(ConnectionState.Disconnected);
    }
  }, []);

  // Toggle Microphone
  const toggleMicrophone = useCallback(async () => {
    if (!roomRef.current) return;
    try {
      const newMuted = !isMicMuted;
      await roomRef.current.localParticipant.setMicrophoneEnabled(!newMuted);
      setIsMicMuted(newMuted);
    } catch (err) {
      console.warn('[LiveKit] Error toggling microphone:', err);
    }
  }, [isMicMuted]);

  // Toggle Camera
  const toggleCamera = useCallback(async () => {
    if (!roomRef.current) return;
    try {
      const newMuted = !isVideoMuted;
      await roomRef.current.localParticipant.setCameraEnabled(!newMuted);
      setIsVideoMuted(newMuted);
      if (!newMuted) {
        const camPublication = roomRef.current.localParticipant.getTrackPublication(
          Track.Source.Camera,
        );
        if (camPublication?.track) {
          setLocalVideoTrack(camPublication.track as LocalVideoTrack);
        }
      } else {
        setLocalVideoTrack(null);
      }
    } catch (err) {
      console.warn('[LiveKit] Error toggling camera:', err);
    }
  }, [isVideoMuted]);

  // Flip Camera (Front / Back)
  const flipCamera = useCallback(async () => {
    if (!localVideoTrack) return;
    try {
      const newFacing = !isFrontCamera;
      await localVideoTrack.restartTrack({
        facingMode: newFacing ? 'user' : 'environment',
      });
      setIsFrontCamera(newFacing);
    } catch (err) {
      console.warn('[LiveKit] Error flipping camera:', err);
    }
  }, [localVideoTrack, isFrontCamera]);

  // Toggle Speaker / Earpiece
  const toggleSpeaker = useCallback(async () => {
    try {
      const newSpeaker = !isSpeakerOn;
      setIsSpeakerOn(newSpeaker);
      // Native audio routing toggle
      if (Platform.OS === 'android') {
        // Handled natively by AudioType.CommunicationAudioType
      }
    } catch (err) {
      console.warn('[LiveKit] Error toggling speaker:', err);
    }
  }, [isSpeakerOn]);

  // Auto connect if requested
  useEffect(() => {
    if (autoConnect && serverUrl && token) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, serverUrl, token, connect, disconnect]);

  return {
    room: roomRef.current,
    connectionState,
    localVideoTrack,
    remoteVideoTrack,
    remoteParticipantName,
    isMicMuted,
    isVideoMuted,
    isFrontCamera,
    isSpeakerOn,
    error,
    connect,
    disconnect,
    toggleMicrophone,
    toggleCamera,
    flipCamera,
    toggleSpeaker,
    isWebRTCAvailable,
  };
}
