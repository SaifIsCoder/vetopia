import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Pill, Trash2, Clock, Calendar, Edit2 } from 'lucide-react-native';
import { CreatePrescriptionItemDTO, PrescriptionItem } from '../../types/prescription';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface MedicationItemRowProps {
  item: CreatePrescriptionItemDTO | PrescriptionItem;
  index?: number;
  onEdit?: () => void;
  onRemove?: () => void;
  isEditable?: boolean;
}

export const MedicationItemRow: React.FC<MedicationItemRowProps> = ({
  item,
  index = 0,
  onEdit,
  onRemove,
  isEditable = false,
}) => {
  return (
    <View style={styles.container} testID={`medication-item-${index}`}>
      <View style={styles.topRow}>
        <View style={styles.nameCol}>
          <View style={styles.iconBadge}>
            <Pill size={16} color={colors.primaryDark} />
          </View>
          <View style={styles.titleInfo}>
            <Text variant="bodyMd" color={colors.ink} style={styles.medName}>
              {item.medication_name}
            </Text>
            <Text variant="caption" color={colors.primaryDark} style={styles.dosageText}>
              {item.dosage}
            </Text>
          </View>
        </View>

        {isEditable || onEdit || onRemove ? (
          <View style={styles.actionButtons}>
            {onEdit ? (
              <TouchableOpacity
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.medication_name}`}
                testID={`edit-medication-${index}`}
                style={styles.actionBtn}
              >
                <Edit2 size={16} color={colors.inkSoft} />
              </TouchableOpacity>
            ) : null}
            {onRemove ? (
              <TouchableOpacity
                onPress={onRemove}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.medication_name}`}
                testID={`remove-medication-${index}`}
                style={styles.actionBtn}
              >
                <Trash2 size={16} color={colors.destructive} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <Clock size={12} color={colors.muted} />
          <Text variant="caption" color={colors.muted}>
            {item.frequency}
          </Text>
        </View>
        <View style={styles.detailItem}>
          <Calendar size={12} color={colors.muted} />
          <Text variant="caption" color={colors.muted}>
            {item.duration}
          </Text>
        </View>
      </View>

      {item.special_instructions ? (
        <View style={styles.instructionsBox}>
          <Text variant="caption" color={colors.inkSoft} style={styles.instructionText}>
            Note: {item.special_instructions}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  nameCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: '#E6F4EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  titleInfo: {
    flex: 1,
  },
  medName: {
    fontWeight: '700',
  },
  dosageText: {
    fontWeight: '600',
    marginTop: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionBtn: {
    padding: spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  instructionsBox: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  instructionText: {
    fontStyle: 'italic',
  },
});
