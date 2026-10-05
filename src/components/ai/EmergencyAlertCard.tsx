/**
 * Emergency Red Alert Card for AI Triage (MVP-09)
 * Vetopia Mobile
 */

import React from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { AlertTriangle, Phone, Video } from 'lucide-react-native';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

interface EmergencyAlertCardProps {
  emergencyNumber?: string;
  onCallEmergency?: () => void;
  onConnectSpecialist?: () => void;
  clinicName?: string;
}

export function EmergencyAlertCard({
  emergencyNumber,
  onCallEmergency,
  onConnectSpecialist,
  clinicName,
}: EmergencyAlertCardProps) {
  const router = useRouter();
  const hasDirectCall = Boolean(emergencyNumber || onCallEmergency);

  const handleCall = () => {
    if (onCallEmergency) {
      onCallEmergency();
    } else if (emergencyNumber) {
      Linking.openURL(`tel:${emergencyNumber}`).catch((err) => {
        console.warn('Failed to launch phone dialer:', err);
      });
    }
  };

  const handleSpecialist = () => {
    if (onConnectSpecialist) {
      onConnectSpecialist();
    } else {
      router.push('/vets');
    }
  };

  return (
    <View style={styles.card} testID="ai-emergency-alert-card">
      <View style={styles.headerRow}>
        <View style={styles.iconCircle}>
          <AlertTriangle size={20} color={colors.white} />
        </View>
        <View style={styles.headerText}>
          <Heading level={4} style={styles.title}>
            CRITICAL: Potential Emergency
          </Heading>
          <Text variant="caption" style={styles.subtitle}>
            Symptoms indicate a possible veterinary emergency requiring immediate hands-on clinical
            care.
          </Text>
        </View>
      </View>

      <View style={styles.actionsRow}>
        {hasDirectCall ? (
          <Button
            title={clinicName ? `Call ${clinicName}` : 'Call Emergency Vet Now'}
            onPress={handleCall}
            size="sm"
            leftIcon={<Phone size={14} color={colors.ink} />}
            style={styles.callButton}
            testID="btn-call-emergency-vet"
          />
        ) : (
          <View style={styles.guidanceBox} testID="emergency-guidance-instruction">
            <Text variant="caption" style={styles.guidanceText}>
              Urgent: Please contact your primary veterinarian or transport your pet to the nearest
              emergency veterinary hospital immediately.
            </Text>
          </View>
        )}
        <Button
          title="Connect to Video Specialist"
          onPress={handleSpecialist}
          variant={hasDirectCall ? 'outline' : 'primary'}
          size="sm"
          leftIcon={<Video size={14} color={hasDirectCall ? colors.white : colors.ink} />}
          style={hasDirectCall ? styles.specialistButton : styles.callButton}
          testID="btn-connect-video-specialist"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.destructive,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#B91C1C',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: colors.white,
    fontSize: 15,
    marginBottom: 2,
  },
  subtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
  actionsRow: {
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  callButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  specialistButton: {
    borderColor: 'rgba(255, 255, 255, 0.4)',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  guidanceBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: radii.sm,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  guidanceText: {
    color: colors.white,
    lineHeight: 16,
    fontWeight: '500',
  },
});
