import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import {
  FileText,
  Bot,
  Settings,
  LogOut,
  Plus,
  ChevronRight,
  PawPrint,
  AlertCircle,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';
import { usePets } from '../../src/hooks/usePets';
import { Pet } from '../../src/types/pet';

export default function CareScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const { data: pets, isLoading: petsLoading, error: petsError, refetch: refetchPets } = usePets();

  const handleSignOut = async () => {
    await authService.signOut();
  };

  return (
    <Screen scrollable>
      <View style={styles.header}>
        <Heading level={1}>Care & Health</Heading>
        <Text variant="bodyMd" color={colors.muted}>
          Pet passports, prescriptions & clinical records
        </Text>
      </View>

      {/* User Profile Card */}
      <Card style={styles.profileCard}>
        <View style={styles.profileRow}>
          <Avatar name={user?.fullName || 'Guest User'} source={user?.avatarUrl} size={52} />
          <View style={styles.profileInfo}>
            <Heading level={4}>{user?.fullName || 'Pet Parent'}</Heading>
            <Text variant="bodySm" color={colors.muted}>
              {user?.email || 'Not authenticated'}
            </Text>
          </View>
          {isAuthenticated ? (
            <Badge variant="verified" label="Active" />
          ) : (
            <Badge variant="scheduled" label="Guest" />
          )}
        </View>

        {isAuthenticated ? (
          <Button
            title="Sign Out"
            onPress={handleSignOut}
            variant="outline"
            size="sm"
            leftIcon={<LogOut size={16} color={colors.destructive} />}
            style={styles.signOutBtn}
          />
        ) : null}
      </Card>

      {/* My Pets Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Heading level={3}>My Pets</Heading>
          <TouchableOpacity
            style={styles.addPetHeaderBtn}
            onPress={() => router.push('/pets/add')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Add new pet"
          >
            <Plus size={16} color={colors.ink} />
            <Text variant="bodySm" color={colors.ink} style={styles.addPetBtnText}>
              Add Pet
            </Text>
          </TouchableOpacity>
        </View>

        {petsLoading ? (
          <Card style={styles.loadingCard}>
            <ActivityIndicator size="small" color={colors.primaryDark} />
            <Text variant="bodySm" color={colors.muted} style={{ marginTop: spacing.sm }}>
              Loading household pets...
            </Text>
          </Card>
        ) : petsError ? (
          <Card style={styles.errorCard}>
            <AlertCircle
              size={20}
              color={colors.destructive}
              style={{ marginBottom: spacing.xs }}
            />
            <Text variant="bodySm" color={colors.destructive} style={{ textAlign: 'center' }}>
              Failed to load pets.
            </Text>
            <Button
              title="Retry"
              onPress={() => refetchPets()}
              variant="outline"
              size="sm"
              style={{ marginTop: spacing.sm }}
            />
          </Card>
        ) : !pets || pets.length === 0 ? (
          <Card style={styles.emptyPetsCard}>
            <View style={styles.emptyIconCircle}>
              <PawPrint size={28} color={colors.primaryDark} />
            </View>
            <Heading level={4} style={styles.emptyPetsTitle}>
              No Pets Registered Yet
            </Heading>
            <Text variant="bodySm" color={colors.muted} style={styles.emptyPetsDesc}>
              Add your dog, cat, or companion to activate digital health passports and vaccination
              tracking.
            </Text>
            <Button
              title="Register Your First Pet"
              onPress={() => router.push('/pets/add')}
              size="sm"
              leftIcon={<Plus size={16} color={colors.ink} />}
              style={styles.emptyAddBtn}
            />
          </Card>
        ) : (
          <View style={styles.petsList}>
            {pets.map((pet: Pet) => (
              <TouchableOpacity
                key={pet.id}
                onPress={() => router.push({ pathname: '/pets/[id]', params: { id: pet.id } })}
                activeOpacity={0.8}
                style={styles.petCardWrapper}
              >
                <Card style={styles.petCard}>
                  <View style={styles.petCardRow}>
                    <Avatar name={pet.name} source={pet.photo_url} size={48} />
                    <View style={styles.petCardInfo}>
                      <Heading level={4}>{pet.name}</Heading>
                      <Text variant="caption" color={colors.inkSoft}>
                        {pet.species} {pet.breed ? `• ${pet.breed}` : ''}
                      </Text>
                      <View style={styles.petTagsRow}>
                        {pet.age ? (
                          <View style={styles.petTag}>
                            <Text variant="caption" color={colors.inkSoft}>
                              {pet.age}
                            </Text>
                          </View>
                        ) : null}
                        {pet.weight_kg ? (
                          <View style={styles.petTag}>
                            <Text variant="caption" color={colors.inkSoft}>
                              {pet.weight_kg} kg
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                    <ChevronRight size={20} color={colors.muted} />
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Care Quick Links */}
      <View style={styles.section}>
        <Heading level={3} style={styles.sectionTitle}>
          Clinical Records
        </Heading>

        <Card style={styles.menuCard}>
          <View style={styles.menuRow}>
            <View style={styles.menuIconContainer}>
              <FileText size={20} color={colors.ink} />
            </View>
            <View style={styles.menuContent}>
              <Heading level={4}>Digital Prescriptions Archive</Heading>
              <Text variant="bodySm" color={colors.muted}>
                MVP-06 Prescription history & PDF export (Phase 7)
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.menuCard}>
          <View style={styles.menuRow}>
            <View style={styles.menuIconContainer}>
              <Bot size={20} color={colors.ink} />
            </View>
            <View style={styles.menuContent}>
              <Heading level={4}>24/7 AI Veterinary Triage</Heading>
              <Text variant="bodySm" color={colors.muted}>
                MVP-09 Gemini symptom checker (Phase 10)
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.menuCard}>
          <View style={styles.menuRow}>
            <View style={styles.menuIconContainer}>
              <Settings size={20} color={colors.ink} />
            </View>
            <View style={styles.menuContent}>
              <Heading level={4}>Settings & Biometrics</Heading>
              <Text variant="bodySm" color={colors.muted}>
                MVP-10 Preferences, notifications & security (Phase 11)
              </Text>
            </View>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.lg,
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  signOutBtn: {
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  addPetHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addPetBtnText: {
    fontWeight: '600',
    marginLeft: 4,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  errorCard: {
    alignItems: 'center',
    padding: spacing.lg,
  },
  emptyPetsCard: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyPetsTitle: {
    marginBottom: spacing.xs,
  },
  emptyPetsDesc: {
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  emptyAddBtn: {
    marginTop: spacing.xs,
  },
  petsList: {
    gap: spacing.sm,
  },
  petCardWrapper: {
    marginBottom: spacing.xs,
  },
  petCard: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.md,
  },
  petCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  petCardInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  petTagsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  petTag: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  menuCard: {
    marginBottom: spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
});
