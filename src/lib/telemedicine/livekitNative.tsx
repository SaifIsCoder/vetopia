/**
 * Safe LiveKit Native WebRTC Bridge & Fallback Provider
 * 
 * In standard Expo Go or Web environments, custom native modules like WebRTC
 * are not bundled into the binary, causing @livekit/react-native to throw a fatal error.
 * 
 * This module safely checks for native WebRTC availability before loading
 * @livekit/react-native, and provides graceful fallbacks for Expo Go and Web.
 */

import React from 'react';
import { View, StyleSheet, NativeModules, Platform, ViewProps } from 'react-native';
import type { VideoTrack as LKVideoTrack } from 'livekit-client';

export interface SafeVideoViewProps extends ViewProps {
  videoTrack?: LKVideoTrack | null;
  objectFit?: 'cover' | 'contain';
  mirror?: boolean;
  zOrder?: number;
}

// Check if native WebRTC module is present in the current runtime
export const isWebRTCAvailable: boolean =
  Platform.OS !== 'web' &&
  Boolean(
    NativeModules &&
    NativeModules.WebRTCModule &&
    NativeModules.WebRTCModule !== null
  );

let nativeLiveKit: any = null;

if (isWebRTCAvailable) {
  try {
    // Dynamically require @livekit/react-native only when native WebRTC is confirmed
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    nativeLiveKit = require('@livekit/react-native');
    if (nativeLiveKit && typeof nativeLiveKit.registerGlobals === 'function') {
      nativeLiveKit.registerGlobals();
    }
  } catch (err) {
    console.warn('[LiveKit] WebRTC native module check succeeded but require failed:', err);
    nativeLiveKit = null;
  }
}

/**
 * Safe VideoView component that renders native video in Dev Builds,
 * or a graceful fallback container in Expo Go / Web.
 */
export const VideoView: React.FC<SafeVideoViewProps> = (props) => {
  if (isWebRTCAvailable && nativeLiveKit && nativeLiveKit.VideoView) {
    const NativeVideoView = nativeLiveKit.VideoView;
    return <NativeVideoView {...props} />;
  }

  // Graceful fallback for Expo Go and Web previews
  return (
    <View style={[styles.fallbackContainer, props.style]}>
      {props.children}
    </View>
  );
};

export const AudioSession = {
  startAudioSession: async () => {
    if (isWebRTCAvailable && nativeLiveKit?.AudioSession?.startAudioSession) {
      return nativeLiveKit.AudioSession.startAudioSession();
    }
  },
  stopAudioSession: async () => {
    if (isWebRTCAvailable && nativeLiveKit?.AudioSession?.stopAudioSession) {
      return nativeLiveKit.AudioSession.stopAudioSession();
    }
  },
};

export const registerGlobals = () => {
  if (isWebRTCAvailable && nativeLiveKit?.registerGlobals) {
    try {
      nativeLiveKit.registerGlobals();
    } catch (err) {
      console.warn('[LiveKit] Error executing registerGlobals:', err);
    }
  }
};

const styles = StyleSheet.create({
  fallbackContainer: {
    backgroundColor: '#1E2424',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
