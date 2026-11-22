import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Heart, MapPin, Sparkles, Search, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { Card } from '../../src/components/ui/Card';
import { fetchAdoptionPets } from '../../src/lib/adoption/adoptionService';
import { AdoptablePet, AdoptionSpecies } from '../../src/types/adoption';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

const SPECIES_LIST: AdoptionSpecies[] = ['All', 'Dogs', 'Cats', 'Birds', 'Other'];

export default function AdoptionScreen() {
  const router = useRouter();
  const [pets, setPets] = useState<AdoptablePet[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<AdoptionSpecies>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPets();
  }, [selectedSpecies]);

  const loadPets = async () => {
    setLoading(true);
    const data = await fetchAdoptionPets(selectedSpecies);
    setPets(data);
    setLoading(false);
  };

  const filtered = pets.filter((p) => {
    if (!searchQuery) return true;
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.breed.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Find a Friend</Text>
          <Text style={styles.headerSubtitle}>Verified rescue shelters & adopters</Text>
        </View>

        <TouchableOpacity
          style={styles.quizButton}
          onPress={() => router.push('/ai/matchmaker' as any)}
        >
          <Sparkles size={16} color={colors.ink} />
          <Text style={styles.quizButtonText}>AI Match</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <SearchInput
          placeholder="Search by breed, name, or city..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.speciesContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.speciesScroll}>
          {SPECIES_LIST.map((sp) => {
            const active = selectedSpecies === sp;
            return (
              <TouchableOpacity
                key={sp}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedSpecies(sp)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{sp}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Card style={styles.petCard}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={() => router.push(`/adoption/${item.slug}` as any)}
            >
              <View style={styles.imageBox}>
                <Image source={{ uri: item.imageUrl }} style={styles.image} contentFit="cover" />
                <View style={styles.speciesBadge}>
                  <Text style={styles.speciesBadgeText}>{item.species}</Text>
                </View>
              </View>

              <View style={styles.petInfo}>
                <View style={styles.petNameRow}>
                  <Text style={styles.petName}>{item.name}</Text>
                  <Text style={styles.petAge}>{item.age}</Text>
                </View>

                <Text style={styles.petBreed}>{item.breed}</Text>

                <View style={styles.locationRow}>
                  <MapPin size={13} color={colors.muted} />
                  <Text style={styles.locationText}>{item.location}</Text>
                </View>

                <Text style={styles.story} numberOfLines={2}>
                  {item.story}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.healthTags}>
                    {item.vaccinated && (
                      <View style={styles.healthTag}>
                        <ShieldCheck size={11} color={colors.success} />
                        <Text style={styles.healthTagText}>Vaccinated</Text>
                      </View>
                    )}
                    {item.neutered && (
                      <View style={styles.healthTag}>
                        <ShieldCheck size={11} color={colors.success} />
                        <Text style={styles.healthTagText}>Neutered</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.meetBtn}>
                    <Text style={styles.meetBtnText}>Meet {item.name} →</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: typography.displayMd.fontFamily,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
  quizButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
  },
  quizButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.ink,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  speciesContainer: {
    marginVertical: spacing.sm,
  },
  speciesScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  chipTextActive: {
    color: colors.cream,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
    gap: spacing.md,
  },
  petCard: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
  },
  imageBox: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  speciesBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  speciesBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.cream,
  },
  petInfo: {
    padding: spacing.md,
  },
  petNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  petName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: typography.headingMd.fontFamily,
  },
  petAge: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  petBreed: {
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginBottom: 6,
  },
  locationText: {
    fontSize: 12,
    color: colors.muted,
  },
  story: {
    fontSize: 13,
    color: colors.inkSoft,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  healthTags: {
    flexDirection: 'row',
    gap: 6,
  },
  healthTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  healthTagText: {
    fontSize: 10,
    color: colors.ink,
    fontWeight: '600',
  },
  meetBtn: {
    paddingVertical: 4,
  },
  meetBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primaryDark,
  },
});
