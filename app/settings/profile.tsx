/**
 * Settings & Profile Screen (SCR-SET-001 / MVP-10)
 * Vetopia Mobile
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Shield,
  Fingerprint,
  Bell,
  Lock,
  LogOut,
  ChevronLeft,
  Edit3,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react-native';

import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Badge } from '../../src/components/ui/Badge';
import { Divider } from '../../src/components/ui/Divider';
import { Modal } from '../../src/components/feedback/Modal';

import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

import { useAuthStore } from '../../src/store/authStore';
import { authService } from '../../src/lib/auth/authService';
import { useProfile } from '../../src/hooks/useProfile';
import {
  checkBiometricsAvailability,
  toggleBiometrics,
  BiometricStatus,
} from '../../src/lib/auth/biometrics';
import {
  getNotificationPreferences,
  updateNotificationPreference,
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
} from '../../src/lib/notifications/notificationPreferences';

export default function ProfileSettingsScreen() {
  const router = useRouter();
  const { user, role, biometricsEnabled, setBiometricsEnabled } = useAuthStore();
  const isDoctor = role === 'vet' || user?.isVet === true || user?.roles?.includes('vet');
  const { updateProfile, isUpdating, updateError, resetStatus } = useProfile();

  // Biometric status state
  const [bioStatus, setBioStatus] = useState<BiometricStatus>({
    isAvailable: false,
    biometricType: 'None',
    isEnabled: false,
  });
  const [isTogglingBio, setIsTogglingBio] = useState(false);
  const [bioError, setBioError] = useState<string | null>(null);

  // Edit Profile Modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(user?.fullName || '');
  const [editPhone, setEditPhone] = useState(user?.phone || '');
  const [editAvatar, setEditAvatar] = useState(user?.avatarUrl || '');
  const [editValidationError, setEditValidationError] = useState<string | null>(null);

  // Notification preferences state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );

  // Password reset state
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  // Load hardware biometrics and notification preferences on mount
  useEffect(() => {
    checkBiometricsAvailability().then(setBioStatus);
    getNotificationPreferences().then(setNotifPrefs);
  }, []);

  // Handle Biometric toggle change
  const handleBiometricToggle = async (value: boolean) => {
    setIsTogglingBio(true);
    setBioError(null);

    const result = await toggleBiometrics(value);
    setIsTogglingBio(false);

    if (result.success) {
      setBiometricsEnabled(value);
      setBioStatus((prev) => ({ ...prev, isEnabled: value }));
      setStatusMessage({
        text: value
          ? `${bioStatus.biometricType} login successfully enabled.`
          : 'Biometric login disabled.',
        type: 'success',
      });
    } else {
      setBioError(result.error || 'Failed to update biometric settings.');
    }
  };

  // Handle Profile Save
  const handleSaveProfile = async () => {
    setEditValidationError(null);
    resetStatus();

    if (!editName.trim() || editName.trim().length < 2) {
      setEditValidationError('Full name must be at least 2 characters long.');
      return;
    }

    if (editPhone.trim()) {
      const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
      if (!phoneRegex.test(editPhone.trim())) {
        setEditValidationError('Please enter a valid phone number (7-20 digits).');
        return;
      }
    }

    const updated = await updateProfile({
      fullName: editName.trim(),
      phone: editPhone.trim() || null,
      avatarUrl: editAvatar.trim() || null,
    });

    if (updated) {
      setIsEditModalOpen(false);
      setStatusMessage({ text: 'Profile updated successfully.', type: 'success' });
    }
  };

  // Handle Notification Toggle
  const handleNotifToggle = async (key: keyof NotificationPreferences, value: boolean) => {
    const updated = await updateNotificationPreference(key, value);
    setNotifPrefs(updated);
  };

  // Handle Password Reset Request
  const handleRequestPasswordReset = async () => {
    if (!user?.email) return;

    const executeReset = async () => {
      setIsResettingPassword(true);
      try {
        await authService.requestPasswordReset(user.email);
        setStatusMessage({
          text: `Password reset instructions sent to ${user.email}.`,
          type: 'success',
        });
      } catch (err: any) {
        setStatusMessage({
          text: err?.message || 'Failed to send password reset email.',
          type: 'error',
        });
      } finally {
        setIsResettingPassword(false);
      }
    };

    if (Platform.OS === 'web') {
      executeReset();
    } else {
      Alert.alert('Reset Password', `Send password reset instructions to ${user.email}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Send Instructions', onPress: executeReset },
      ]);
    }
  };

  // Handle Sign Out
  const handleSignOut = () => {
    const performSignOut = async () => {
      try {
        await authService.signOut();
        // Navigation guard automatically routes to /(auth)/welcome
      } catch (err) {
        console.warn('[ProfileSettings] Sign out error:', err);
      }
    };

    if (Platform.OS === 'web') {
      performSignOut();
    } else {
      Alert.alert('Sign Out', 'Are you sure you want to sign out of your Vetopia account?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: performSignOut },
      ]);
    }
  };

  return (
    <Screen scrollable style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Back to previous screen"
          accessibilityRole="button"
          testID="btn-settings-back"
        >
          <ChevronLeft size={24} color={colors.ink} />
          <Text variant="bodyMd" style={styles.backText}>
            Back
          </Text>
        </TouchableOpacity>

        <Heading level={2} style={styles.headerTitle}>
          Settings & Profile
        </Heading>
        <Text variant="bodySm" color={colors.muted}>
          Manage personal profile, biometric security & notification preferences
        </Text>
      </View>

      {/* Status Feedback Banner */}
      {statusMessage && (
        <View
          style={[
            styles.feedbackBanner,
            statusMessage.type === 'success' ? styles.feedbackSuccess : styles.feedbackError,
          ]}
          testID="settings-feedback-banner"
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 size={18} color={colors.success} />
          ) : (
            <AlertCircle size={18} color={colors.destructive} />
          )}
          <Text
            variant="bodySm"
            color={statusMessage.type === 'success' ? colors.success : colors.destructive}
            style={styles.feedbackText}
          >
            {statusMessage.text}
          </Text>
        </View>
      )}

      {/* 1. Account & Profile Card */}
      <Card style={styles.sectionCard}>
        <View style={styles.profileHeaderRow}>
          <Avatar
            name={user?.fullName || 'Vetopia User'}
            source={user?.avatarUrl || null}
            size={56}
          />
          <View style={styles.profileDetails}>
            <Heading level={3} style={styles.userName} testID="profile-user-name">
              {user?.fullName || 'Vetopia User'}
            </Heading>
            <Text variant="bodySm" color={colors.muted} testID="profile-user-email">
              {user?.email || 'No email attached'}
            </Text>
            {user?.phone ? (
              <Text variant="bodySm" color={colors.inkSoft} testID="profile-user-phone">
                {user.phone}
              </Text>
            ) : null}
            <View style={styles.badgeRow}>
              <Badge
                variant={isDoctor ? (user?.isVetVerified ? 'verified' : 'pending') : 'scheduled'}
                label={
                  isDoctor
                    ? user?.isVetVerified
                      ? 'Verified Veterinarian'
                      : 'Veterinarian'
                    : 'Pet Parent'
                }
              />
            </View>
          </View>
        </View>

        <Divider style={styles.cardDivider} />

        <Button
          title="Edit Profile"
          variant="outline"
          leftIcon={<Edit3 size={18} color={colors.ink} />}
          onPress={() => {
            resetStatus();
            setEditValidationError(null);
            setEditName(user?.fullName || '');
            setEditPhone(user?.phone || '');
            setEditAvatar(user?.avatarUrl || '');
            setIsEditModalOpen(true);
          }}
          testID="btn-open-edit-profile"
        />

        {isDoctor && (
          <Button
            title="Go to Doctor Dashboard"
            variant="primary"
            onPress={() => router.replace('/vet/dashboard')}
            style={{ marginTop: spacing.md }}
            testID="btn-goto-doctor-dashboard"
          />
        )}
      </Card>

      {/* 2. Biometric Authentication Card */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconContainer}>
            <Fingerprint size={22} color={colors.primaryDark} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Heading level={4}>Biometric Login</Heading>
            <Text variant="bodySm" color={colors.muted}>
              {bioStatus.isAvailable
                ? `Supported method: ${bioStatus.biometricType}`
                : 'Biometric hardware unavailable on this device'}
            </Text>
          </View>
          <Switch
            value={biometricsEnabled}
            onValueChange={handleBiometricToggle}
            disabled={!bioStatus.isAvailable || isTogglingBio}
            trackColor={{ false: colors.border, true: colors.primaryDark }}
            thumbColor={colors.white}
            accessibilityRole="switch"
            accessibilityLabel="Toggle Biometric Login"
            accessibilityState={{ checked: biometricsEnabled }}
            testID="toggle-biometrics"
          />
        </View>

        <Text variant="bodySm" color={colors.inkSoft} style={styles.sectionDescription}>
          Quickly unlock your Vetopia consultations and health passport using your device biometric
          sensor. Local biometric verification releases access to your secure session.
        </Text>

        {bioError && (
          <View style={styles.inlineErrorRow} testID="bio-error-alert">
            <AlertCircle size={16} color={colors.destructive} />
            <Text variant="caption" color={colors.destructive} style={styles.inlineErrorText}>
              {bioError}
            </Text>
          </View>
        )}

        {!bioStatus.isAvailable && (
          <View style={styles.inlineInfoRow}>
            <Info size={16} color={colors.muted} />
            <Text variant="caption" color={colors.muted} style={styles.inlineInfoText}>
              To enable biometric login, ensure Face ID or fingerprint recognition is enrolled in
              your device operating system settings.
            </Text>
          </View>
        )}
      </Card>

      {/* 3. Security & Session Management Card */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconContainer}>
            <Shield size={22} color={colors.primaryDark} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Heading level={4}>Security & Credentials</Heading>
            <Text variant="bodySm" color={colors.muted}>
              Account password and active session status
            </Text>
          </View>
        </View>

        <View style={styles.sessionStatusRow}>
          <View style={styles.sessionIndicator} />
          <Text variant="bodySm" color={colors.inkSoft}>
            Active session secured via Supabase JWT with SecureStore token isolation.
          </Text>
        </View>

        <Divider style={styles.cardDivider} />

        <Button
          title={isResettingPassword ? 'Sending...' : 'Request Password Reset Email'}
          variant="outline"
          leftIcon={<Lock size={18} color={colors.ink} />}
          onPress={handleRequestPasswordReset}
          disabled={isResettingPassword}
          loading={isResettingPassword}
          testID="btn-password-reset"
        />
      </Card>

      {/* 4. Notification Preferences Card */}
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionIconContainer}>
            <Bell size={22} color={colors.primaryDark} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Heading level={4}>Notification Preferences</Heading>
            <Text variant="bodySm" color={colors.muted}>
              Control consultation reminders and alerts
            </Text>
          </View>
        </View>

        <View style={styles.prefRow}>
          <View style={styles.prefTextContainer}>
            <Text variant="bodyMd" style={styles.prefTitle}>
              Consultation Reminders
            </Text>
            <Text variant="caption" color={colors.muted}>
              High-priority 15-minute alerts before scheduled video calls
            </Text>
          </View>
          <Switch
            value={notifPrefs.consultationReminders}
            onValueChange={(val) => handleNotifToggle('consultationReminders', val)}
            trackColor={{ false: colors.border, true: colors.primaryDark }}
            thumbColor={colors.white}
            accessibilityLabel="Toggle Consultation Reminders"
            testID="toggle-notif-consultations"
          />
        </View>

        <Divider style={styles.prefDivider} />

        <View style={styles.prefRow}>
          <View style={styles.prefTextContainer}>
            <Text variant="bodyMd" style={styles.prefTitle}>
              Clinical Messages
            </Text>
            <Text variant="caption" color={colors.muted}>
              Real-time direct chat notifications from your veterinarian
            </Text>
          </View>
          <Switch
            value={notifPrefs.clinicalMessages}
            onValueChange={(val) => handleNotifToggle('clinicalMessages', val)}
            trackColor={{ false: colors.border, true: colors.primaryDark }}
            thumbColor={colors.white}
            accessibilityLabel="Toggle Clinical Messages"
            testID="toggle-notif-messages"
          />
        </View>

        <Divider style={styles.prefDivider} />

        <View style={styles.prefRow}>
          <View style={styles.prefTextContainer}>
            <Text variant="bodyMd" style={styles.prefTitle}>
              Prescription Updates
            </Text>
            <Text variant="caption" color={colors.muted}>
              Instant alerts when a doctor issues a digital prescription
            </Text>
          </View>
          <Switch
            value={notifPrefs.prescriptionAlerts}
            onValueChange={(val) => handleNotifToggle('prescriptionAlerts', val)}
            trackColor={{ false: colors.border, true: colors.primaryDark }}
            thumbColor={colors.white}
            accessibilityLabel="Toggle Prescription Updates"
            testID="toggle-notif-prescriptions"
          />
        </View>
      </Card>

      {/* 5. Application & Privacy Information */}
      <Card style={styles.sectionCard}>
        <Heading level={4} style={styles.appInfoTitle}>
          About Vetopia
        </Heading>
        <Text variant="bodySm" color={colors.muted}>
          Application Version: 1.0.0 (MVP Build)
        </Text>
        <Text variant="bodySm" color={colors.muted}>
          Environment: {process.env.EXPO_PUBLIC_APP_ENV || 'production'}
        </Text>

        <Divider style={styles.cardDivider} />

        <View style={styles.disclaimerContainer}>
          <Info size={18} color={colors.inkSoft} style={styles.disclaimerIcon} />
          <Text variant="caption" color={colors.inkSoft} style={styles.disclaimerText}>
            Vetopia is an educational triage and telehealth platform. AI triage does not substitute
            for in-person physical clinical examinations. In acute emergencies, visit a 24-hour
            emergency veterinary hospital immediately.
          </Text>
        </View>
      </Card>

      {/* 6. Sign Out Button */}
      <View style={styles.signOutContainer}>
        <Button
          title="Sign Out"
          variant="destructive"
          leftIcon={<LogOut size={20} color={colors.white} />}
          onPress={handleSignOut}
          style={styles.signOutButton}
          testID="btn-sign-out"
        />
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Personal Profile"
      >
        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {editValidationError && (
            <View style={styles.modalErrorBanner}>
              <AlertCircle size={16} color={colors.destructive} />
              <Text variant="caption" color={colors.destructive} style={styles.modalErrorText}>
                {editValidationError}
              </Text>
            </View>
          )}

          {updateError && (
            <View style={styles.modalErrorBanner}>
              <AlertCircle size={16} color={colors.destructive} />
              <Text variant="caption" color={colors.destructive} style={styles.modalErrorText}>
                {updateError}
              </Text>
            </View>
          )}

          <Input
            label="Full Name"
            placeholder="e.g. Sarah Connor"
            value={editName}
            onChangeText={(text) => {
              setEditName(text);
              if (editValidationError) setEditValidationError(null);
            }}
            autoCapitalize="words"
            editable={!isUpdating}
            testID="input-edit-name"
          />

          <Input
            label="Phone Number (Optional)"
            placeholder="e.g. +92 300 1234567"
            value={editPhone}
            onChangeText={(text) => {
              setEditPhone(text);
              if (editValidationError) setEditValidationError(null);
            }}
            keyboardType="phone-pad"
            editable={!isUpdating}
            testID="input-edit-phone"
          />

          {/* Read-Only Account Identifiers to Prevent Unauthorized Privilege Escalation */}
          <View style={styles.readOnlyContainer}>
            <Text variant="caption" color={colors.muted} style={styles.readOnlyLabel}>
              Account Email (Managed by Auth Provider)
            </Text>
            <Text variant="bodyMd" color={colors.inkSoft} style={styles.readOnlyValue}>
              {user?.email || 'N/A'}
            </Text>
          </View>

          <View style={styles.readOnlyContainer}>
            <Text variant="caption" color={colors.muted} style={styles.readOnlyLabel}>
              System Role (Enforced by PostgreSQL RLS)
            </Text>
            <View style={styles.readOnlyRoleBadge}>
              <Badge
                variant={isDoctor ? 'verified' : 'scheduled'}
                label={isDoctor ? 'Veterinarian' : 'Pet Parent'}
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button
              title="Save Changes"
              variant="primary"
              onPress={handleSaveProfile}
              loading={isUpdating}
              disabled={isUpdating}
              style={styles.modalSaveButton}
              testID="btn-save-profile"
            />
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setIsEditModalOpen(false)}
              disabled={isUpdating}
              style={styles.modalCancelButton}
              testID="btn-cancel-edit"
            />
          </View>
        </ScrollView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
  },
  header: {
    marginBottom: spacing.lg,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 44,
    minWidth: 44,
  },
  backText: {
    marginLeft: spacing.xs,
    color: colors.ink,
    fontWeight: '600',
  },
  headerTitle: {
    marginBottom: spacing.xs,
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  feedbackSuccess: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  feedbackError: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  feedbackText: {
    marginLeft: spacing.sm,
    flex: 1,
    fontWeight: '500',
  },
  sectionCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileDetails: {
    marginLeft: spacing.lg,
    flex: 1,
  },
  userName: {
    marginBottom: 2,
  },
  badgeRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
  },
  cardDivider: {
    marginVertical: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionDescription: {
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  inlineErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  inlineErrorText: {
    marginLeft: spacing.xs,
  },
  inlineInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: spacing.sm,
    backgroundColor: '#F9FAFB',
    padding: spacing.sm,
    borderRadius: radii.sm,
  },
  inlineInfoText: {
    marginLeft: spacing.xs,
    flex: 1,
  },
  sessionStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  sessionIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
    marginRight: spacing.sm,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    minHeight: 48,
  },
  prefTextContainer: {
    flex: 1,
    marginRight: spacing.md,
  },
  prefTitle: {
    fontWeight: '600',
    color: colors.ink,
    marginBottom: 2,
  },
  prefDivider: {
    marginVertical: spacing.sm,
  },
  appInfoTitle: {
    marginBottom: spacing.xs,
  },
  disclaimerContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: spacing.md,
    borderRadius: radii.md,
  },
  disclaimerIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  disclaimerText: {
    flex: 1,
    lineHeight: 18,
  },
  signOutContainer: {
    marginBottom: spacing['2xl'],
    marginTop: spacing.sm,
  },
  signOutButton: {
    minHeight: 48,
  },
  modalContent: {
    paddingVertical: spacing.sm,
  },
  modalErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginBottom: spacing.md,
  },
  modalErrorText: {
    marginLeft: spacing.xs,
    flex: 1,
  },
  readOnlyContainer: {
    backgroundColor: '#F9FAFB',
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readOnlyLabel: {
    marginBottom: spacing.xs,
  },
  readOnlyValue: {
    fontWeight: '500',
  },
  readOnlyRoleBadge: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  modalActions: {
    marginTop: spacing.md,
  },
  modalSaveButton: {
    marginBottom: spacing.sm,
    minHeight: 48,
  },
  modalCancelButton: {
    minHeight: 48,
  },
});
