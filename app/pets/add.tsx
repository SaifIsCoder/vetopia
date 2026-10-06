import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  PawPrint,
  Weight,
  Calendar,
  Heart,
  FileText,
  AlertCircle,
  Camera,
  Upload,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { useCreatePet } from '../../src/hooks/usePets';
import { useAuthStore } from '../../src/store/authStore';
import { petPhotoService } from '../../src/lib/storage/petPhotoService';
import { SPECIES_OPTIONS, SEX_OPTIONS, PetSpecies, PetSex } from '../../src/types/pet';

export default function AddPetScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const createPetMutation = useCreatePet();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<PetSpecies>('Dog');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<PetSex>('unknown');
  const [age, setAge] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [color, setColor] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [bio, setBio] = useState('');

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    weightKg?: string;
  }>({});

  const validate = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (!name.trim() || name.trim().length < 2) {
      errors.name = 'Pet name must be at least 2 characters.';
    }

    if (weightKg.trim()) {
      const parsedWeight = parseFloat(weightKg);
      if (isNaN(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500) {
        errors.weightKg = 'Weight must be a valid positive number up to 500 kg.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    setErrorMessage(null);
    if (!validate()) return;

    try {
      await createPetMutation.mutateAsync({
        name: name.trim(),
        species,
        breed: breed.trim() || null,
        sex,
        age: age.trim() || null,
        weight_kg: weightKg.trim() ? parseFloat(weightKg) : null,
        color: color.trim() || null,
        photo_url: photoUrl.trim() || null,
        bio: bio.trim() || null,
      });

      router.back();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to register pet. Please try again.');
    }
  };

  return (
    <Screen scrollable style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text variant="caption" color={colors.inkSoft} style={styles.kicker}>
            PET PASSPORT
          </Text>
          <Heading level={2}>Register New Pet</Heading>
        </View>
      </View>

      {/* Error Banner */}
      {errorMessage ? (
        <View style={styles.errorBanner}>
          <AlertCircle size={18} color={colors.destructive} style={styles.errorBannerIcon} />
          <Text variant="bodySm" color={colors.destructive} style={styles.errorBannerText}>
            {errorMessage}
          </Text>
        </View>
      ) : null}

      {/* Basic Information Card */}
      <Card style={styles.formCard}>
        <Heading level={4} style={styles.cardTitle}>
          Basic Information
        </Heading>

        <Input
          label="Pet Name *"
          placeholder="e.g. Bella, Milo, Luna"
          value={name}
          onChangeText={(val) => {
            setName(val);
            if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
          }}
          leftIcon={<PawPrint size={18} color={colors.inkSoft} />}
          error={fieldErrors.name}
        />

        {/* Species Selector */}
        <View style={styles.fieldGroup}>
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            Species *
          </Text>
          <View style={styles.chipsRow}>
            {SPECIES_OPTIONS.map((item) => {
              const isSelected = species === item;
              return (
                <TouchableOpacity
                  key={item}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSpecies(item)}
                  activeOpacity={0.8}
                >
                  <Text
                    variant="caption"
                    color={isSelected ? colors.ink : colors.inkSoft}
                    style={[styles.chipText, isSelected && styles.chipTextActive]}
                  >
                    {item}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <Input
          label="Breed"
          placeholder="e.g. Golden Retriever, Persian, Mixed"
          value={breed}
          onChangeText={setBreed}
          leftIcon={<Heart size={18} color={colors.inkSoft} />}
        />

        {/* Sex Selector */}
        <View style={styles.fieldGroup}>
          <Text variant="caption" color={colors.ink} style={styles.fieldLabel}>
            Sex
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {SEX_OPTIONS.map((item) => {
              const isSelected = sex === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  style={[styles.chip, isSelected && styles.chipActive]}
                  onPress={() => setSex(item.value)}
                  activeOpacity={0.8}
                >
                  <Text
                    variant="caption"
                    color={isSelected ? colors.ink : colors.inkSoft}
                    style={[styles.chipText, isSelected && styles.chipTextActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </Card>

      {/* Clinical & Physical Attributes */}
      <Card style={styles.formCard}>
        <Heading level={4} style={styles.cardTitle}>
          Physical & Health Details
        </Heading>

        <Input
          label="Age or Date of Birth"
          placeholder="e.g. 2 years, or 2024-04-12"
          value={age}
          onChangeText={setAge}
          leftIcon={<Calendar size={18} color={colors.inkSoft} />}
        />

        <Input
          label="Weight (kg)"
          placeholder="e.g. 12.5"
          value={weightKg}
          onChangeText={(val) => {
            setWeightKg(val);
            if (fieldErrors.weightKg) setFieldErrors((prev) => ({ ...prev, weightKg: undefined }));
          }}
          keyboardType="numeric"
          leftIcon={<Weight size={18} color={colors.inkSoft} />}
          error={fieldErrors.weightKg}
        />

        <Input
          label="Color / Markings"
          placeholder="e.g. Brown with white chest"
          value={color}
          onChangeText={setColor}
        />

        <Input
          label="Photo URL"
          placeholder="https://... (or image link)"
          value={photoUrl}
          onChangeText={setPhotoUrl}
          leftIcon={<ImageIcon size={18} color={colors.inkSoft} />}
        />

        <Input
          label="Bio / Notes / Allergies"
          placeholder="Any known conditions, allergies, or personality notes..."
          value={bio}
          onChangeText={setBio}
          multiline
          numberOfLines={3}
          leftIcon={<FileText size={18} color={colors.inkSoft} />}
        />
      </Card>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Button
          title="Register Pet"
          onPress={handleSave}
          loading={createPetMutation.isPending}
          disabled={createPetMutation.isPending}
          size="lg"
          style={styles.saveButton}
        />
        <Button
          title="Cancel"
          onPress={() => router.back()}
          variant="outline"
          size="md"
          disabled={createPetMutation.isPending}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerTitleContainer: {
    flex: 1,
  },
  kicker: {
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorBannerIcon: {
    marginRight: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
  },
  formCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
  },
  cardTitle: {
    marginBottom: spacing.md,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  chipText: {
    fontWeight: '500',
  },
  chipTextActive: {
    fontWeight: '700',
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  saveButton: {
    marginTop: spacing.xs,
  },
});
