import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SlidersHorizontal, Stethoscope, X } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { Chip } from '../../src/components/ui/Chip';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { VetCard } from '../../src/components/vets/VetCard';
import { VetFilterSheet } from '../../src/components/vets/VetFilterSheet';
import { useVets } from '../../src/hooks/useVets';
import { VetProfile, VetFilterParams, VET_SPECIALTIES } from '../../src/types/vet';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function VetsScreen() {
  const router = useRouter();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState<string | undefined>(undefined);
  const [selectedCountry, setSelectedCountry] = useState<string | undefined>(undefined);
  const [selectedMaxPrice, setSelectedMaxPrice] = useState<number | undefined>(undefined);
  const [acceptingOnly, setAcceptingOnly] = useState<boolean | undefined>(undefined);

  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Compute active filters query payload
  const filterParams: VetFilterParams = useMemo(() => {
    const params: VetFilterParams = {};
    if (searchQuery.trim()) {
      params.q = searchQuery.trim();
    }
    if (selectedSpecialty !== 'All') {
      params.specialty = selectedSpecialty;
    }
    if (selectedLanguage && selectedLanguage !== 'All') {
      params.language = selectedLanguage;
    }
    if (selectedCountry && selectedCountry !== 'All') {
      params.country = selectedCountry;
    }
    if (selectedMaxPrice !== undefined && selectedMaxPrice > 0) {
      params.max_price = selectedMaxPrice;
    }
    if (acceptingOnly !== undefined) {
      params.accepting_only = acceptingOnly;
    }
    return params;
  }, [
    searchQuery,
    selectedSpecialty,
    selectedLanguage,
    selectedCountry,
    selectedMaxPrice,
    acceptingOnly,
  ]);

  // TanStack Query
  const { data: vets, isLoading, isError, error, refetch, isRefetching } = useVets(filterParams);

  // Count active secondary filters for badge
  const activeSecondaryFilterCount = useMemo(() => {
    let count = 0;
    if (selectedLanguage && selectedLanguage !== 'All') count++;
    if (selectedCountry && selectedCountry !== 'All') count++;
    if (selectedMaxPrice !== undefined) count++;
    if (acceptingOnly) count++;
    return count;
  }, [selectedLanguage, selectedCountry, selectedMaxPrice, acceptingOnly]);

  const handleApplyFilters = (newFilters: VetFilterParams) => {
    setSelectedSpecialty(newFilters.specialty || 'All');
    setSelectedLanguage(newFilters.language);
    setSelectedCountry(newFilters.country);
    setSelectedMaxPrice(newFilters.max_price);
    setAcceptingOnly(newFilters.accepting_only);
  };

  const handleResetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedSpecialty('All');
    setSelectedLanguage(undefined);
    setSelectedCountry(undefined);
    setSelectedMaxPrice(undefined);
    setAcceptingOnly(undefined);
  }, []);

  const handleCardPress = (vet: VetProfile) => {
    router.push(`/booking/${vet.id}`);
  };

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      <View style={styles.titleSection}>
        <Heading level={1}>Find a Vet</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Search licensed veterinarians across 11 languages
        </Text>
      </View>

      {/* Search Input and Filter Trigger */}
      <View style={styles.searchRow}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search doctor name or specialty..."
          onClear={() => setSearchQuery('')}
          containerStyle={styles.searchInput}
          testID="vet-search-input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open doctor filter options"
          onPress={() => setIsFilterSheetOpen(true)}
          style={({ pressed }) => [
            styles.filterButton,
            activeSecondaryFilterCount > 0 && styles.filterButtonActive,
            pressed && styles.pressed,
          ]}
          testID="vet-filter-button"
        >
          <SlidersHorizontal
            size={18}
            color={activeSecondaryFilterCount > 0 ? colors.ink : colors.inkSoft}
          />
          {activeSecondaryFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text variant="caption" color={colors.ink} style={styles.filterBadgeText}>
                {activeSecondaryFilterCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Specialty Filter Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.specialtyScroll}
        contentContainerStyle={styles.specialtyScrollContent}
      >
        <Chip
          label="All"
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
      </ScrollView>

      {/* Active Secondary Filters Indicator */}
      {activeSecondaryFilterCount > 0 ? (
        <View style={styles.activePillsRow}>
          <Text variant="caption" color={colors.muted} style={styles.activePillsLabel}>
            Active filters:
          </Text>
          {selectedLanguage && selectedLanguage !== 'All' ? (
            <Pressable onPress={() => setSelectedLanguage(undefined)} style={styles.activePill}>
              <Text variant="caption" color={colors.ink}>
                Lang: {selectedLanguage}
              </Text>
              <X size={12} color={colors.muted} />
            </Pressable>
          ) : null}
          {selectedCountry && selectedCountry !== 'All' ? (
            <Pressable onPress={() => setSelectedCountry(undefined)} style={styles.activePill}>
              <Text variant="caption" color={colors.ink}>
                {selectedCountry}
              </Text>
              <X size={12} color={colors.muted} />
            </Pressable>
          ) : null}
          {selectedMaxPrice !== undefined ? (
            <Pressable onPress={() => setSelectedMaxPrice(undefined)} style={styles.activePill}>
              <Text variant="caption" color={colors.ink}>
                ≤ ${selectedMaxPrice}
              </Text>
              <X size={12} color={colors.muted} />
            </Pressable>
          ) : null}
          {acceptingOnly ? (
            <Pressable onPress={() => setAcceptingOnly(undefined)} style={styles.activePill}>
              <Text variant="caption" color={colors.ink}>
                Accepting Only
              </Text>
              <X size={12} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={vets || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <VetCard vet={item} onPress={handleCardPress} />}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={() => {
          if (isLoading) {
            return (
              <View style={styles.loadingContainer}>
                <Skeleton width="100%" height={140} style={styles.skeleton} />
                <Skeleton width="100%" height={140} style={styles.skeleton} />
                <Skeleton width="100%" height={140} style={styles.skeleton} />
              </View>
            );
          }

          if (isError) {
            return (
              <ErrorState
                title="Could not load veterinarians"
                message={error?.message || 'Check your internet connection and try again.'}
                onRetry={refetch}
              />
            );
          }

          return (
            <EmptyState
              title="No veterinarians found"
              description="No doctors match your current search and filter criteria. Try adjusting your filters or clearing search."
              icon={<Stethoscope size={44} color={colors.primaryDark} />}
              actionTitle="Clear Filters"
              onAction={handleResetFilters}
            />
          );
        }}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primaryDark}
            colors={[colors.primaryDark]}
          />
        }
      />

      <VetFilterSheet
        visible={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        filters={filterParams}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  headerContainer: {
    paddingTop: spacing.md,
    marginBottom: spacing.md,
  },
  titleSection: {
    marginBottom: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  searchInput: {
    flex: 1,
    marginBottom: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  pressed: {
    opacity: 0.8,
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: colors.cream,
    fontSize: 10,
    fontWeight: '700',
  },
  specialtyScroll: {
    marginBottom: spacing.sm,
  },
  specialtyScrollContent: {
    paddingRight: spacing.lg,
  },
  activePillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  activePillsLabel: {
    marginRight: 2,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  loadingContainer: {
    paddingTop: spacing.sm,
  },
  skeleton: {
    marginBottom: spacing.md,
    borderRadius: radii.lg,
  },
});
