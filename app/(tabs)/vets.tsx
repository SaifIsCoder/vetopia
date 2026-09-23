import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Stethoscope } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { Chip } from '../../src/components/ui/Chip';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';

const specialties = [
  'All',
  'General Practice',
  'Dermatology',
  'Surgery',
  'Cardiology',
  'Emergency',
];

export default function VetsScreen() {
  const [query, setQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Heading level={1}>Find a Vet</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Search licensed veterinarians across 11 languages
        </Text>
      </View>

      <SearchInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search doctor name or specialty..."
        onClear={() => setQuery('')}
        containerStyle={styles.search}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {specialties.map((item) => (
          <Chip
            key={item}
            label={item}
            selected={selectedSpecialty === item}
            onPress={() => setSelectedSpecialty(item)}
          />
        ))}
      </ScrollView>

      <EmptyState
        title="Doctor Directory Ready"
        description="The doctor discovery directory and 14-day availability slot generator will be implemented in Phase 4 (MVP-03)."
        icon={<Stethoscope size={44} color={colors.primaryDark} />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.md,
  },
  search: {
    marginBottom: spacing.md,
  },
  filtersScroll: {
    marginBottom: spacing.lg,
  },
  filtersContent: {
    paddingRight: spacing.lg,
  },
});
