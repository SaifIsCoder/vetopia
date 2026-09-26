import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Pill, Calendar, User, ChevronRight } from 'lucide-react-native';
import { Prescription } from '../../types/prescription';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface PrescriptionCardProps {
  prescription: Prescription;
  onPress?: (prescription: Prescription) => void;
}

export const PrescriptionCard: React.FC<PrescriptionCardProps> = ({ prescription, onPress }) => {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress(prescription);
    } else {
      router.push(`/prescriptions/${prescription.id}`);
    }
  };

  const formattedDate = new Date(prescription.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const itemCount = prescription.items?.length || 0;
  const vetName = prescription.vet?.name || 'Dr. Veterinarian';
  const petName = prescription.pet?.name || 'Pet';

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Prescription for ${petName}: ${prescription.diagnosis}`}
      >
        <View style={styles.headerRow}>
          <View style={styles.iconBox}>
            <Pill size={20} color={colors.primaryDark} />
          </View>

          <View style={styles.titleCol}>
            <Text variant="headingSm" color={colors.ink} numberOfLines={1}>
              {prescription.diagnosis}
            </Text>
            <View style={styles.metaRow}>
              <Calendar size={12} color={colors.inkSoft} />
              <Text variant="caption" color={colors.inkSoft} style={styles.metaText}>
                {formattedDate}
              </Text>
            </View>
          </View>

          <View style={styles.badgeCol}>
            <Badge
              variant={prescription.status === 'active' ? 'completed' : 'scheduled'}
              label={prescription.status.toUpperCase()}
            />
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.bodyRow}>
          <View style={styles.infoItem}>
            <User size={13} color={colors.muted} />
            <Text variant="caption" color={colors.inkSoft} numberOfLines={1}>
              {vetName}
            </Text>
          </View>

          <View style={styles.chipRow}>
            <View style={styles.pillCountChip}>
              <Text variant="caption" color={colors.primaryDark} style={styles.boldText}>
                {itemCount} {itemCount === 1 ? 'Medication' : 'Medications'}
              </Text>
            </View>

            {prescription.refills_allowed > 0 ? (
              <View style={styles.refillChip}>
                <Text variant="caption" color={colors.primaryDark} style={styles.boldText}>
                  {prescription.refills_allowed} Refill{prescription.refills_allowed > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.footerRow}>
          <Text variant="caption" color={colors.primaryDark} style={styles.viewLink}>
            View Structured Details & PDF
          </Text>
          <ChevronRight size={16} color={colors.primaryDark} />
        </View>
      </Pressable>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  pressable: {
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.85,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11,
  },
  badgeCol: {
    alignItems: 'flex-end',
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pillCountChip: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  refillChip: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  boldText: {
    fontWeight: '700',
    fontSize: 11,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: 2,
  },
  viewLink: {
    fontWeight: '600',
    fontSize: 12,
  },
});
