import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FileText, Bot, Settings, LogOut } from 'lucide-react-native';
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

export default function CareScreen() {
  const { user, isAuthenticated } = useAuthStore();

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
    marginBottom: spacing.xl,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  signOutBtn: {
    marginTop: spacing.md,
    borderColor: colors.destructive,
    alignSelf: 'flex-start',
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  menuCard: {
    marginBottom: spacing.md,
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
