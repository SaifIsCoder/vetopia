import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stethoscope, LogOut, User, Clock } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';

export default function VetDashboardScreen() {
  const { user } = useAuthStore();

  const handleSignOut = async () => {
    await authService.signOut();
  };

  const isVerified = user?.isVetVerified === true;

  return (
    <Screen style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text variant="caption" color={colors.inkSoft} style={styles.kicker}>
              DOCTOR PORTAL
            </Text>
            <Heading level={2}>{user?.fullName || 'Veterinarian'}</Heading>
          </View>
          {isVerified ? (
            <Badge label="Verified Vet" variant="verified" />
          ) : (
            <Badge label="Pending Verification" variant="pending" />
          )}
        </View>

        {!isVerified && (
          <Card style={styles.pendingCard}>
            <View style={styles.pendingRow}>
              <Clock size={18} color={colors.warning} style={styles.pendingIcon} />
              <View style={styles.pendingText}>
                <Text variant="caption" color={colors.ink} style={styles.pendingTitle}>
                  Verification Review in Progress
                </Text>
                <Text variant="caption" color={colors.inkSoft}>
                  Your veterinarian account has been registered with status unverified. An authorized administrator must approve your medical license before consultations are activated.
                </Text>
              </View>
            </View>
          </Card>
        )}

        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <User size={24} color={colors.primaryDark} />
            </View>
            <View style={styles.profileInfo}>
              <Text variant="bodyMd" color={colors.ink} style={styles.profileEmail}>
                {user?.email}
              </Text>
              <Text variant="caption" color={colors.muted}>
                Active Role: Veterinarian (Clinical Provider)
              </Text>
            </View>
          </View>
        </Card>
      </View>

      <EmptyState
        title="Doctor Consultation Portal"
        description="Weekly recurring schedule manager, patient queue, and digital prescription pad will be connected in Phase 4 & 5."
        icon={<Stethoscope size={48} color={colors.primaryDark} />}
      />

      <View style={styles.actions}>
        <Button
          title="Sign Out"
          onPress={handleSignOut}
          variant="outline"
          leftIcon={<LogOut size={18} color={colors.destructive} />}
          style={styles.signOutButton}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'space-between',
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  kicker: {
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  pendingCard: {
    padding: spacing.md,
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderWidth: 1,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  pendingIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  pendingText: {
    flex: 1,
  },
  pendingTitle: {
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 2,
  },
  profileCard: {
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  profileEmail: {
    fontWeight: '600',
  },
  actions: {
    gap: spacing.sm,
  },
  signOutButton: {
    width: '100%',
    borderColor: colors.destructive,
  },
});
