import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Modal } from '../feedback/Modal';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ReportReason } from '../../types/club';
import { useReportContent } from '../../hooks/useClubs';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: 'post' | 'comment';
  targetId: string;
}

const REPORT_REASONS: { label: string; value: ReportReason; description: string }[] = [
  { label: 'Spam or Advertising', value: 'spam', description: 'Commercial spam, repetitive or promotional content' },
  { label: 'Harassment or Bullying', value: 'harassment', description: 'Hostile, abusive or threatening behavior' },
  { label: 'Inappropriate Content', value: 'inappropriate', description: 'Explicit, offensive, or graphic imagery' },
  { label: 'Veterinary Misinformation', value: 'misinformation', description: 'False medical advice harmful to animals' },
  { label: 'Other Concern', value: 'other', description: 'Other community policy violations' },
];

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  targetType,
  targetId,
}) => {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const reportMutation = useReportContent();

  const handleSubmit = async () => {
    try {
      await reportMutation.mutateAsync({
        target_type: targetType,
        target_id: targetId,
        reason: selectedReason,
        details: details.trim() || undefined,
      });

      Alert.alert(
        'Report Submitted',
        'Thank you for keeping the Vetopia community safe. Our moderation team will review this report promptly.',
        [{ text: 'OK', onPress: onClose }],
      );
    } catch (err: any) {
      Alert.alert('Report Failed', err?.message || 'Unable to submit report. Please try again.');
    }
  };

  return (
    <Modal visible={visible} onClose={onClose} title={`Report ${targetType === 'post' ? 'Post' : 'Comment'}`}>
      <View style={styles.container}>
        <Text variant="bodySm" color={colors.muted} style={styles.subtitle}>
          Help us understand what is wrong with this {targetType}. Reports are private and reviewed by moderators.
        </Text>

        <View style={styles.reasonsList}>
          {REPORT_REASONS.map((reason) => {
            const isSelected = selectedReason === reason.value;
            return (
              <TouchableOpacity
                key={reason.value}
                style={[styles.reasonOption, isSelected && styles.reasonOptionSelected]}
                onPress={() => setSelectedReason(reason.value)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <View style={styles.radioCircle}>
                  {isSelected ? <View style={styles.radioInner} /> : null}
                </View>
                <View style={styles.reasonTextContainer}>
                  <Text
                    variant="bodySm"
                    color={isSelected ? colors.ink : colors.inkSoft}
                    style={styles.reasonLabel}
                  >
                    {reason.label}
                  </Text>
                  <Text variant="caption" color={colors.muted} style={styles.reasonDesc}>
                    {reason.description}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Input
          label="Additional Details (Optional)"
          placeholder="Provide any context that helps our moderation team..."
          value={details}
          onChangeText={setDetails}
          multiline
          numberOfLines={3}
          style={styles.detailsInput}
        />

        <View style={styles.actions}>
          <Button
            title="Cancel"
            variant="outline"
            onPress={onClose}
            style={styles.cancelBtn}
            disabled={reportMutation.isPending}
          />
          <Button
            title="Submit Report"
            variant="destructive"
            onPress={handleSubmit}
            loading={reportMutation.isPending}
            style={styles.submitBtn}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  reasonsList: {
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  reasonOptionSelected: {
    borderColor: colors.primaryDark,
    backgroundColor: '#F5FBEA',
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.inkSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
    marginRight: spacing.sm,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primaryDark,
  },
  reasonTextContainer: {
    flex: 1,
  },
  reasonLabel: {
    fontWeight: '600',
    marginBottom: 2,
  },
  reasonDesc: {
    lineHeight: 15,
  },
  detailsInput: {
    height: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 1,
  },
});
