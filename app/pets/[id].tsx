import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Edit2,
  Trash2,
  PawPrint,
  Weight,
  Calendar,
  Heart,
  FileText,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { usePet, useDeletePet } from '../../src/hooks/usePets';

export default function PetPassportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: pet, isLoading, error } = usePet(id || '');
  const deletePetMutation = useDeletePet();

  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = () => {
    Alert.alert(
      'Delete Pet Profile',
      `Are you sure you want to remove ${pet?.name || 'this pet'} from your passport? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!id) return;
            setIsDeleting(true);
            try {
              await deletePetMutation.mutateAsync(id);
              router.replace('/(tabs)/care');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete pet.');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <Screen style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primaryDark} />
        <Text variant="bodyMd" color={colors.muted} style={styles.loadingText}>
          Loading pet health passport...
        </Text>
      </Screen>
    );
  }

  if (error || !pet) {
    return (
      <Screen style={styles.centerContainer}>
        <AlertCircle size={48} color={colors.destructive} />
        <Heading level={2} style={styles.errorTitle}>
          Pet Not Found
        </Heading>
        <Text variant="bodyMd" color={colors.muted} style={styles.errorSubtitle}>
          {error?.message ||
            'This pet profile could not be loaded or you do not have permission to view it.'}
        </Text>
        <Button title="Back to Care Hub" onPress={() => router.back()} variant="outline" />
      </Screen>
    );
  }

  const formatSex = (sex?: string | null): string => {
    if (!sex) return 'Unknown';
    if (sex === 'neutered_male') return 'Neutered Male';
    if (sex === 'spayed_female') return 'Spayed Female';
    if (sex === 'male') return 'Male';
    if (sex === 'female') return 'Female';
    return sex;
  };

  return (
    <Screen scrollable style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.iconButton}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <ArrowLeft size={22} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/pets/edit', params: { id: pet.id } })}
            style={styles.iconButton}
            accessibilityLabel="Edit pet details"
            accessibilityRole="button"
          >
            <Edit2 size={20} color={colors.ink} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={confirmDelete}
            style={[styles.iconButton, styles.deleteIconButton]}
            accessibilityLabel="Delete pet"
            accessibilityRole="button"
            disabled={isDeleting}
          >
            <Trash2 size={20} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Profile Card */}
      <Card style={styles.heroCard}>
        <View style={styles.heroContent}>
          <Avatar name={pet.name} source={pet.photo_url} size={88} style={styles.avatarBorder} />
          <Heading level={1} style={styles.petName}>
            {pet.name}
          </Heading>
          <Text variant="bodyMd" color={colors.inkSoft} style={styles.speciesText}>
            {pet.species} {pet.breed ? `• ${pet.breed}` : ''}
          </Text>

          <View style={styles.badgeRow}>
            <Badge variant="verified" label="Digital Health Passport" />
          </View>
        </View>
      </Card>

      {/* Clinical Metrics & Biometrics Grid */}
      <View style={styles.section}>
        <Heading level={3} style={styles.sectionTitle}>
          Biometrics & Identification
        </Heading>

        <View style={styles.metricsGrid}>
          <Card style={styles.metricCard}>
            <Weight size={20} color={colors.primaryDark} style={styles.metricIcon} />
            <Text variant="caption" color={colors.muted}>
              WEIGHT
            </Text>
            <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
              {pet.weight_kg ? `${pet.weight_kg} kg` : 'Not recorded'}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Calendar size={20} color={colors.primaryDark} style={styles.metricIcon} />
            <Text variant="caption" color={colors.muted}>
              AGE / DOB
            </Text>
            <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
              {pet.age || pet.dob || 'Not recorded'}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <Heart size={20} color={colors.primaryDark} style={styles.metricIcon} />
            <Text variant="caption" color={colors.muted}>
              SEX
            </Text>
            <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
              {formatSex(pet.sex)}
            </Text>
          </Card>

          <Card style={styles.metricCard}>
            <PawPrint size={20} color={colors.primaryDark} style={styles.metricIcon} />
            <Text variant="caption" color={colors.muted}>
              COLOR / COAT
            </Text>
            <Text variant="bodyMd" color={colors.ink} style={styles.metricValue}>
              {pet.color || 'Not specified'}
            </Text>
          </Card>
        </View>
      </View>

      {/* Bio, Allergies & Clinical Notes */}
      <View style={styles.section}>
        <Heading level={3} style={styles.sectionTitle}>
          Clinical Notes & Allergies
        </Heading>

        <Card style={styles.bioCard}>
          <View style={styles.bioHeader}>
            <FileText size={18} color={colors.inkSoft} style={{ marginRight: spacing.xs }} />
            <Text variant="bodySm" color={colors.ink} style={{ fontWeight: '600' }}>
              Known Conditions & Behavioral Notes
            </Text>
          </View>
          <Text variant="bodyMd" color={colors.inkSoft} style={styles.bioText}>
            {pet.bio || 'No medical conditions, allergies, or notes recorded for this pet yet.'}
          </Text>
        </Card>
      </View>

      {/* Passport Verification Guarantee */}
      <Card style={styles.guaranteeCard}>
        <View style={styles.guaranteeRow}>
          <ShieldCheck size={24} color={colors.primaryDark} style={styles.guaranteeIcon} />
          <View style={styles.guaranteeText}>
            <Text variant="bodySm" color={colors.ink} style={{ fontWeight: '700' }}>
              Owner-Verified Security
            </Text>
            <Text variant="caption" color={colors.inkSoft}>
              This digital passport is encrypted and protected by PostgreSQL Row Level Security.
              Only you and authorized consulting veterinarians have access to clinical records.
            </Text>
          </View>
        </View>
      </Card>

      {/* Footer Actions */}
      <View style={styles.footerActions}>
        <Button
          title="Edit Details"
          onPress={() => router.push({ pathname: '/pets/edit', params: { id: pet.id } })}
          variant="outline"
          leftIcon={<Edit2 size={16} color={colors.ink} />}
        />
        <Button
          title={isDeleting ? 'Deleting...' : 'Delete Pet Profile'}
          onPress={confirmDelete}
          variant="destructive"
          disabled={isDeleting}
          leftIcon={<Trash2 size={16} color={colors.cream} />}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.lg,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
  },
  errorTitle: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  errorSubtitle: {
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  deleteIconButton: {
    backgroundColor: '#FEE2E2',
  },
  heroCard: {
    padding: spacing.xl,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    marginBottom: spacing.lg,
  },
  heroContent: {
    alignItems: 'center',
  },
  avatarBorder: {
    borderWidth: 3,
    borderColor: colors.primary,
    marginBottom: spacing.md,
  },
  petName: {
    marginBottom: spacing.xs,
  },
  speciesText: {
    marginBottom: spacing.sm,
  },
  badgeRow: {
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
  },
  metricIcon: {
    marginBottom: spacing.xs,
  },
  metricValue: {
    fontWeight: '700',
    marginTop: 2,
  },
  bioCard: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
  },
  bioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  bioText: {
    lineHeight: 22,
  },
  guaranteeCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  guaranteeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guaranteeIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  guaranteeText: {
    flex: 1,
  },
  footerActions: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
});
