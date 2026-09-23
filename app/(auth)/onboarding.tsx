import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { User, MapPin, PawPrint, FileText, AlertCircle, Building } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, role } = useAuthStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Step 1: Profile & Location
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');

  // Step 2: Pet Parent first pet
  const [petName, setPetName] = useState('');
  const [species, setSpecies] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [age, setAge] = useState('');

  // Step 2: Vet bio & clinic
  const [bio, setBio] = useState('');
  const [clinicName, setClinicName] = useState('');

  const SPECIES_OPTIONS = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'];

  const handleNextStep = () => {
    setErrorMessage(null);
    setStep(2);
  };

  const handleComplete = async (skipPetOrClinic = false) => {
    if (!user) return;
    setLoading(true);
    setErrorMessage(null);

    try {
      await authService.completeOnboarding(user.id, {
        fullName: fullName.trim() || undefined,
        username: username.trim() || undefined,
        location: location.trim() || undefined,
        bio: bio.trim() || undefined,
        firstPet:
          !skipPetOrClinic && role === 'pet_parent' && petName.trim()
            ? {
                name: petName.trim(),
                species,
                breed: breed.trim() || undefined,
                age: age.trim() || undefined,
              }
            : undefined,
      });

      // Navigate to destination
      if (role === 'vet') {
        router.replace('/vet/dashboard');
      } else {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Failed to complete setup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scrollable style={styles.container}>
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Text variant="caption" color={colors.primaryDark} style={styles.stepBadgeText}>
            STEP {step} OF 2
          </Text>
        </View>

        <Heading level={1} style={styles.title}>
          {step === 1 ? 'Profile Setup' : role === 'vet' ? 'Doctor Profile' : 'First Pet Setup'}
        </Heading>
        <Text variant="bodyMd" color={colors.muted}>
          {step === 1
            ? 'Customize your public profile and clinical location.'
            : role === 'vet'
              ? 'Add your clinic background to help pet parents connect with you.'
              : 'Add your first pet to start receiving personalized health reminders.'}
        </Text>
      </View>

      {/* Progress Indicator */}
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: step === 1 ? '50%' : '100%' }]} />
      </View>

      {errorMessage ? (
        <Card style={styles.errorBanner}>
          <AlertCircle size={20} color={colors.destructive} style={styles.errorIcon} />
          <Text variant="bodySm" color={colors.destructive} style={styles.errorText}>
            {errorMessage}
          </Text>
        </Card>
      ) : null}

      {step === 1 ? (
        <View style={styles.form}>
          <Input
            label="Display Name"
            placeholder="Your Name"
            value={fullName}
            onChangeText={setFullName}
            leftIcon={<User size={20} color={colors.muted} />}
            editable={!loading}
          />

          <Input
            label="Unique Username"
            placeholder="e.g. sarah_vet"
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
            leftIcon={
              <Text variant="bodySm" color={colors.muted}>
                @
              </Text>
            }
            editable={!loading}
          />

          <Input
            label="Location / City"
            placeholder="e.g. London, UK or New York, USA"
            value={location}
            onChangeText={setLocation}
            leftIcon={<MapPin size={20} color={colors.muted} />}
            editable={!loading}
          />

          <Button
            title="Continue"
            onPress={handleNextStep}
            variant="primary"
            style={styles.continueButton}
          />

          <TouchableOpacity
            onPress={() => handleComplete(true)}
            style={styles.skipButton}
            accessibilityRole="button"
          >
            <Text variant="bodySm" color={colors.muted}>
              Skip setup for now
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.form}>
          {role === 'vet' ? (
            <>
              <Input
                label="Primary Clinic / Practice Name"
                placeholder="e.g. City Vet Hospital"
                value={clinicName}
                onChangeText={setClinicName}
                leftIcon={<Building size={20} color={colors.muted} />}
                editable={!loading}
              />

              <Input
                label="Professional Biography"
                placeholder="Summary of your veterinary experience and special clinical interests..."
                multiline
                numberOfLines={3}
                value={bio}
                onChangeText={setBio}
                leftIcon={<FileText size={20} color={colors.muted} />}
                editable={!loading}
              />
            </>
          ) : (
            <>
              <Input
                label="Pet Name"
                placeholder="e.g. Bella, Max"
                value={petName}
                onChangeText={setPetName}
                leftIcon={<PawPrint size={20} color={colors.muted} />}
                editable={!loading}
              />

              <Text variant="bodySm" color={colors.inkSoft} style={styles.fieldLabel}>
                Species
              </Text>
              <View style={styles.speciesRow}>
                {SPECIES_OPTIONS.map((item) => (
                  <TouchableOpacity
                    key={item}
                    onPress={() => setSpecies(item)}
                    style={[styles.speciesChip, species === item && styles.selectedSpeciesChip]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: species === item }}
                  >
                    <Text
                      variant="caption"
                      color={species === item ? colors.ink : colors.muted}
                      style={[
                        styles.speciesChipText,
                        species === item && styles.selectedSpeciesChipText,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input
                label="Breed"
                placeholder="e.g. Golden Retriever, Siamese"
                value={breed}
                onChangeText={setBreed}
                editable={!loading}
              />

              <Input
                label="Age"
                placeholder="e.g. 2 years"
                value={age}
                onChangeText={setAge}
                editable={!loading}
              />
            </>
          )}

          <Button
            title="Complete Setup"
            onPress={() => handleComplete(false)}
            loading={loading}
            disabled={loading}
            variant="primary"
            style={styles.continueButton}
          />

          <TouchableOpacity
            onPress={() => handleComplete(true)}
            style={styles.skipButton}
            accessibilityRole="button"
          >
            <Text variant="bodySm" color={colors.muted}>
              Skip for now
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.md,
  },
  stepBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: spacing.sm,
  },
  stepBadgeText: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    marginBottom: spacing.xs,
  },
  progressContainer: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primaryDark,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderColor: colors.destructive,
    borderWidth: 1,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  errorIcon: {
    marginRight: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontWeight: '500',
  },
  form: {
    flex: 1,
  },
  fieldLabel: {
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  speciesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  speciesChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedSpeciesChip: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  speciesChipText: {
    fontWeight: '500',
  },
  selectedSpeciesChipText: {
    fontWeight: '700',
  },
  continueButton: {
    width: '100%',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
