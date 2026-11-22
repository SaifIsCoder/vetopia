import React from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, FlatList } from 'react-native';
import { Check, Globe, X } from 'lucide-react-native';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../types/localization';
import { useLocalization } from '../../lib/localization/i18n';
import { Text } from '../ui/Text';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

interface LanguageSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LanguageSwitcherModal({ visible, onClose }: LanguageSwitcherModalProps) {
  const { currentLanguage, setLanguage } = useLocalization();

  const handleSelect = (lang: SupportedLanguage) => {
    setLanguage(lang);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Globe size={20} color={colors.ink} />
              <Text style={styles.title}>Select Platform Language</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.ink} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Choose from 11+ supported global languages. Translations apply across the entire platform.
          </Text>

          <FlatList
            data={SUPPORTED_LANGUAGES}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => {
              const isSelected = currentLanguage === item.name;
              return (
                <TouchableOpacity
                  style={[styles.langItem, isSelected && styles.langItemSelected]}
                  onPress={() => handleSelect(item.name)}
                >
                  <View>
                    <Text style={[styles.langName, isSelected && styles.langNameSelected]}>
                      {item.nativeName}
                    </Text>
                    <Text style={styles.langEnName}>{item.name}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkCircle}>
                      <Check size={14} color={colors.ink} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(19, 22, 22, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.lg,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  subtitle: {
    fontSize: 13,
    color: colors.inkSoft,
    marginBottom: spacing.md,
  },
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.xl,
  },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langItemSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  langName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
  },
  langNameSelected: {
    color: colors.ink,
  },
  langEnName: {
    fontSize: 12,
    color: colors.muted,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
