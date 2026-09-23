import React, { useState } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { Text } from './Text';

export interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: number;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({ source, name, size = 48, style }) => {
  const [hasError, setHasError] = useState(false);

  const getInitials = (text?: string): string => {
    if (!text) return '?';
    const parts = text.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: radii.pill,
  };

  if (source && !hasError) {
    return (
      <View style={[styles.container, containerStyle, style]}>
        <Image
          source={{ uri: source }}
          style={[styles.image, containerStyle]}
          onError={() => setHasError(true)}
          contentFit="cover"
          transition={200}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.fallback, containerStyle, style]}>
      <Text
        variant={size >= 56 ? 'headingMd' : 'bodySm'}
        color={colors.ink}
        style={styles.initials}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    backgroundColor: colors.surface,
  },
  initials: {
    fontWeight: '700',
  },
});
