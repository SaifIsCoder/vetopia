/**
 * AI Clinical Disclaimer Banner (MVP-09)
 * Vetopia Mobile
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export function DisclaimerBanner() {
  return (
    <View style={styles.container} testID="ai-disclaimer-banner">
      <ShieldAlert size={16} color={colors.inkSoft} style={styles.icon} />
      <Text variant="caption" color={colors.inkSoft} style={styles.text}>
        Vetopia AI provides triage guidance and care education. It cannot diagnose illnesses or
        prescribe medications. For severe symptoms, contact an emergency veterinarian immediately.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  icon: {
    marginRight: spacing.xs + 2,
  },
  text: {
    flex: 1,
    lineHeight: 14,
  },
});
