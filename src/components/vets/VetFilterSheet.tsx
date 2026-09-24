import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { BottomSheet } from '../feedback/BottomSheet';
import { Chip } from '../ui/Chip';
import { Button } from '../ui/Button';
import { Text } from '../ui/Text';
import {
  VetFilterParams,
  VET_SPECIALTIES,
  VET_LANGUAGES,
  VET_COUNTRIES,
  VET_PRICE_OPTIONS,
} from '../../types/vet';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';

export interface VetFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  filters: VetFilterParams;
  onApply: (newFilters: VetFilterParams) => void;
  onReset: () => void;
}

interface FormProps {
  filters: VetFilterParams;
  onApply: (newFilters: VetFilterParams) => void;
  onReset: () => void;
  onClose: () => void;
}

const VetFilterForm: React.FC<FormProps> = ({ filters, onApply, onReset, onClose }) => {
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>(filters.specialty || 'All');
  const [selectedLanguage, setSelectedLanguage] = useState<string>(filters.language || 'All');
  const [selectedCountry, setSelectedCountry] = useState<string>(filters.country || 'All');
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | undefined>(filters.max_price);
  const [acceptingOnly, setAcceptingOnly] = useState<boolean>(filters.accepting_only ?? false);

  const handleApply = () => {
    onApply({
      ...filters,
      specialty: selectedSpecialty !== 'All' ? selectedSpecialty : undefined,
      language: selectedLanguage !== 'All' ? selectedLanguage : undefined,
      country: selectedCountry !== 'All' ? selectedCountry : undefined,
      max_price: selectedMaxPrice,
      accepting_only: acceptingOnly ? true : undefined,
    });
    onClose();
  };

  const handleReset = () => {
    setSelectedSpecialty('All');
    setSelectedLanguage('All');
    setSelectedCountry('All');
    setSelectedMaxPrice(undefined);
    setAcceptingOnly(false);
    onReset();
    onClose();
  };

  return (
    <>
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section 1: Specialty */}
        <View style={styles.section}>
          <Text variant="headingSm" color={colors.ink} style={styles.sectionTitle}>
            Specialty ({VET_SPECIALTIES.length})
          </Text>
          <View style={styles.chipGrid}>
            <Chip
              label="All Specialties"
              selected={selectedSpecialty === 'All'}
              onPress={() => setSelectedSpecialty('All')}
            />
            {VET_SPECIALTIES.map((spec) => (
              <Chip
                key={spec}
                label={spec}
                selected={selectedSpecialty === spec}
                onPress={() => setSelectedSpecialty(spec)}
              />
            ))}
          </View>
        </View>

        {/* Section 2: Languages */}
        <View style={styles.section}>
          <Text variant="headingSm" color={colors.ink} style={styles.sectionTitle}>
            Language ({VET_LANGUAGES.length})
          </Text>
          <View style={styles.chipGrid}>
            <Chip
              label="All Languages"
              selected={selectedLanguage === 'All'}
              onPress={() => setSelectedLanguage('All')}
            />
            {VET_LANGUAGES.map((lang) => (
              <Chip
                key={lang}
                label={lang}
                selected={selectedLanguage === lang}
                onPress={() => setSelectedLanguage(lang)}
              />
            ))}
          </View>
        </View>

        {/* Section 3: Country */}
        <View style={styles.section}>
          <Text variant="headingSm" color={colors.ink} style={styles.sectionTitle}>
            Country
          </Text>
          <View style={styles.chipGrid}>
            <Chip
              label="All Countries"
              selected={selectedCountry === 'All'}
              onPress={() => setSelectedCountry('All')}
            />
            {VET_COUNTRIES.map((ctry) => (
              <Chip
                key={ctry}
                label={ctry}
                selected={selectedCountry === ctry}
                onPress={() => setSelectedCountry(ctry)}
              />
            ))}
          </View>
        </View>

        {/* Section 4: Maximum Price */}
        <View style={styles.section}>
          <Text variant="headingSm" color={colors.ink} style={styles.sectionTitle}>
            Maximum Consultation Fee (USD)
          </Text>
          <View style={styles.chipGrid}>
            <Chip
              label="Any Price"
              selected={selectedMaxPrice === undefined}
              onPress={() => setSelectedMaxPrice(undefined)}
            />
            {VET_PRICE_OPTIONS.map((price) => (
              <Chip
                key={price}
                label={`Up to $${price}`}
                selected={selectedMaxPrice === price}
                onPress={() => setSelectedMaxPrice(price)}
              />
            ))}
          </View>
        </View>

        {/* Section 5: Accepting Status */}
        <View style={styles.section}>
          <Text variant="headingSm" color={colors.ink} style={styles.sectionTitle}>
            Availability Status
          </Text>
          <View style={styles.chipGrid}>
            <Chip
              label="All Doctors"
              selected={!acceptingOnly}
              onPress={() => setAcceptingOnly(false)}
            />
            <Chip
              label="Currently Accepting Only"
              selected={acceptingOnly}
              onPress={() => setAcceptingOnly(true)}
            />
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <Button
          title="Reset"
          variant="outline"
          onPress={handleReset}
          style={styles.actionBtnHalf}
        />
        <Button
          title="Apply Filters"
          variant="primary"
          onPress={handleApply}
          style={styles.actionBtnHalf}
        />
      </View>
    </>
  );
};

export const VetFilterSheet: React.FC<VetFilterSheetProps> = ({
  visible,
  onClose,
  filters,
  onApply,
  onReset,
}) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Filter Doctors">
      {visible ? (
        <VetFilterForm filters={filters} onApply={onApply} onReset={onReset} onClose={onClose} />
      ) : null}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.xs,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtnHalf: {
    flex: 1,
  },
});
