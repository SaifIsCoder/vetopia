import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, MapPin, ShieldCheck, Heart, Home, Calendar } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { fetchPetBySlug } from '../../src/lib/adoption/adoptionService';
import { AdoptablePet } from '../../src/types/adoption';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

export default function AdoptablePetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [pet, setPet] = useState<AdoptablePet | null>(null);

  useEffect(() => {
    if (id) {
      fetchPetBySlug(id).then(setPet);
    }
  }, [id]);

  if (!pet) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.loadingBox}>
          <Text>Loading pet profile...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{pet.name}'s Story</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imageBox}>
          <Image source={{ uri: pet.imageUrl }} style={styles.image} contentFit="cover" />
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Status: Available</Text>
          </View>
        </View>

        <View style={styles.detailsBox}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.name}>{pet.name}</Text>
              <Text style={styles.breed}>{pet.breed} • {pet.age}</Text>
            </View>
            <View style={styles.locationTag}>
              <MapPin size={14} color={colors.ink} />
              <Text style={styles.locationText}>{pet.location}</Text>
            </View>
          </View>

          <Card style={styles.shelterCard}>
            <ShieldCheck size={20} color={colors.primaryDark} />
            <View style={{ flex: 1 }}>
              <Text style={styles.shelterLabel}>Verified Rescue Shelter</Text>
              <Text style={styles.shelterName}>{pet.shelterName || 'North Shore Animal Rescue'}</Text>
            </View>
          </Card>

          <Text style={styles.storyHeading}>About {pet.name}</Text>
          <Text style={styles.storyText}>{pet.story}</Text>

          <Text style={[styles.storyHeading, { marginTop: spacing.lg }]}>Medical & Vital Records</Text>
          <View style={styles.vitalsGrid}>
            <View style={styles.vitalCard}>
              <ShieldCheck size={18} color={pet.vaccinated ? colors.success : colors.warning} />
              <Text style={styles.vitalTitle}>Vaccinations</Text>
              <Text style={styles.vitalSubtitle}>{pet.vaccinated ? 'Up to date' : 'Pending booster'}</Text>
            </View>
            <View style={styles.vitalCard}>
              <ShieldCheck size={18} color={pet.neutered ? colors.success : colors.warning} />
              <Text style={styles.vitalTitle}>Spayed / Neutered</Text>
              <Text style={styles.vitalSubtitle}>{pet.neutered ? 'Completed' : 'Not completed'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          title={`Apply to Adopt ${pet.name}`}
          style={styles.applyButton}
          onPress={() => router.push({ pathname: '/adoption/apply' as any, params: { petSlug: pet.slug, petName: pet.name } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.ink,
  },
  content: {
    paddingBottom: 100,
  },
  imageBox: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  statusBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    backgroundColor: colors.success,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  detailsBox: {
    padding: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  name: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: typography.displayMd.fontFamily,
  },
  breed: {
    fontSize: 14,
    color: colors.inkSoft,
    marginTop: 2,
  },
  locationTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
  },
  shelterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  shelterLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  shelterName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  storyHeading: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  storyText: {
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 22,
  },
  vitalsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  vitalCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  vitalTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  vitalSubtitle: {
    fontSize: 12,
    color: colors.muted,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  applyButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
  },
  applyButtonText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
});
