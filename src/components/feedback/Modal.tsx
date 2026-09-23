import React from 'react';
import { Modal as RNModal, View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { X } from 'lucide-react-native';
import { colors } from '../../theme/colors';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { shadows } from '../../theme/shadows';
import { Heading } from '../ui/Heading';
import { IconButton } from '../ui/IconButton';

export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  children,
  contentStyle,
}) => {
  return (
    <RNModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.dialog, contentStyle]}>
          <View style={styles.header}>
            {title ? <Heading level={3}>{title}</Heading> : <View />}
            <IconButton
              icon={<X size={20} color={colors.ink} />}
              accessibilityLabel="Close modal"
              size={36}
              onPress={onClose}
            />
          </View>
          <View style={styles.body}>{children}</View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  dialog: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    padding: spacing.lg,
    ...shadows.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  body: {
    width: '100%',
  },
});
