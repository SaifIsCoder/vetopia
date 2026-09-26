import React, { useState } from 'react';
import { View, StyleSheet, Modal, ScrollView, TouchableOpacity } from 'react-native';
import { X, PlusCircle, Check } from 'lucide-react-native';
import { CreatePrescriptionItemDTO } from '../../types/prescription';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface MedicationFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave?: (item: CreatePrescriptionItemDTO) => void;
  onAddMedication?: (item: CreatePrescriptionItemDTO) => void;
  initialItem?: CreatePrescriptionItemDTO;
}

interface MedicationFormContentProps {
  initialItem?: CreatePrescriptionItemDTO;
  onClose: () => void;
  onSave?: (item: CreatePrescriptionItemDTO) => void;
  onAddMedication?: (item: CreatePrescriptionItemDTO) => void;
}

const MedicationFormContent: React.FC<MedicationFormContentProps> = ({
  initialItem,
  onClose,
  onSave,
  onAddMedication,
}) => {
  const [medicationName, setMedicationName] = useState(initialItem?.medication_name || '');
  const [dosage, setDosage] = useState(initialItem?.dosage || '');
  const [frequency, setFrequency] = useState(initialItem?.frequency || '');
  const [duration, setDuration] = useState(initialItem?.duration || '');
  const [instructions, setInstructions] = useState(initialItem?.special_instructions || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!medicationName.trim()) {
      setErrorMsg('Medication name is required.');
      return;
    }
    if (!dosage.trim()) {
      setErrorMsg('Dosage is required (e.g. 250mg, 1 tablet).');
      return;
    }
    if (!frequency.trim()) {
      setErrorMsg('Frequency is required (e.g. Twice daily).');
      return;
    }
    if (!duration.trim()) {
      setErrorMsg('Duration is required (e.g. 7 days, 2 weeks).');
      return;
    }

    const payload: CreatePrescriptionItemDTO = {
      medication_name: medicationName.trim(),
      dosage: dosage.trim(),
      frequency: frequency.trim(),
      duration: duration.trim(),
      special_instructions: instructions.trim() || undefined,
    };

    if (onSave) {
      onSave(payload);
    } else if (onAddMedication) {
      onAddMedication(payload);
    }

    onClose();
  };

  return (
    <View style={styles.modalContent}>
      <View style={styles.header}>
        <Heading level={3}>{initialItem ? 'Edit Medication' : 'Add Medication'}</Heading>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close medication form"
          style={styles.closeBtn}
        >
          <X size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Text variant="caption" color={colors.destructive}>
            {errorMsg}
          </Text>
        </View>
      ) : null}

      <ScrollView style={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Input
          label="Medication / Drug Name *"
          placeholder="e.g. Amoxicillin / Clavulanate, Carprofen"
          value={medicationName}
          onChangeText={(val) => {
            setMedicationName(val);
            if (errorMsg) setErrorMsg(null);
          }}
        />

        <Input
          label="Dosage & Strength *"
          placeholder="e.g. 250mg, 1 tablet, 5ml"
          value={dosage}
          onChangeText={(val) => {
            setDosage(val);
            if (errorMsg) setErrorMsg(null);
          }}
        />

        <Input
          label="Frequency *"
          placeholder="e.g. Twice daily (every 12 hours), Once daily with food"
          value={frequency}
          onChangeText={(val) => {
            setFrequency(val);
            if (errorMsg) setErrorMsg(null);
          }}
        />

        <Input
          label="Duration *"
          placeholder="e.g. 7 days, 14 days, 1 month"
          value={duration}
          onChangeText={(val) => {
            setDuration(val);
            if (errorMsg) setErrorMsg(null);
          }}
        />

        <Input
          label="Special Instructions (Optional)"
          placeholder="e.g. Administer with meals, Keep refrigerated"
          value={instructions}
          onChangeText={setInstructions}
          multiline
          numberOfLines={2}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Cancel" variant="outline" onPress={onClose} style={styles.cancelBtn} />
        <Button
          title={initialItem ? 'Update Drug' : 'Add Drug'}
          variant="primary"
          onPress={handleSubmit}
          leftIcon={
            initialItem ? (
              <Check size={16} color={colors.ink} />
            ) : (
              <PlusCircle size={16} color={colors.ink} />
            )
          }
          style={styles.submitBtn}
        />
      </View>
    </View>
  );
};

export const MedicationFormModal: React.FC<MedicationFormModalProps> = ({
  visible,
  onClose,
  onSave,
  onAddMedication,
  initialItem,
}) => {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        {visible ? (
          <MedicationFormContent
            key={initialItem ? `${initialItem.medication_name}-${visible}` : `new-${visible}`}
            initialItem={initialItem}
            onClose={onClose}
            onSave={onSave}
            onAddMedication={onAddMedication}
          />
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  formScroll: {
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
  },
  submitBtn: {
    flex: 2,
  },
});
