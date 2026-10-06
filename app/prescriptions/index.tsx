import React from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Pill, ArrowLeft } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { PrescriptionCard } from '../../src/components/prescriptions/PrescriptionCard';
import { useMyPrescriptions } from '../../src/hooks/usePrescriptions';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { Prescription } from '../../src/types/prescription';

export default function PrescriptionsArchiveScreen() {
  const router = useRouter();
  const {
    data: prescriptions = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useMyPrescriptions();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/care');
    }
  };

  const handleSelectPrescription = (prescription: Prescription) => {
    router.push(`/prescriptions/${prescription.id}`);
  };

  return (
    <Screen style={styles.screen}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowLeft size={22} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Heading level={2}>Digital Prescriptions</Heading>
          <Text variant="caption" color={colors.inkSoft}>
            Medication regimens, dosage instructions & signed PDF exports
          </Text>
        </View>
      </View>

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonRow}>
                <Skeleton width={40} height={40} borderRadius={radii.md} />
                <View style={styles.skeletonTextCol}>
                  <Skeleton width="65%" height={18} borderRadius={radii.sm} />
                  <Skeleton
                    width="40%"
                    height={14}
                    borderRadius={radii.sm}
                    style={{ marginTop: 6 }}
                  />
                </View>
              </View>
              <Skeleton
                width="100%"
                height={24}
                borderRadius={radii.sm}
                style={{ marginTop: spacing.md }}
              />
            </View>
          ))}
        </View>
      ) : isError ? (
        <View style={styles.centerContainer}>
          <ErrorState
            title="Failed to Load Prescriptions"
            message={
              error?.message || 'Could not retrieve your digital prescriptions. Please try again.'
            }
            onRetry={() => refetch()}
          />
        </View>
      ) : prescriptions.length === 0 ? (
        <View style={styles.centerContainer}>
          <EmptyState
            icon={<Pill size={48} color={colors.primaryDark} />}
            title="No Prescriptions Yet"
            description="Your digital prescriptions and medication regimens will appear here following consultations with certified veterinarians."
            actionTitle="Find a Veterinarian"
            onAction={() => router.push('/(tabs)/vets')}
          />
        </View>
      ) : (
        <FlatList
          data={prescriptions}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <PrescriptionCard prescription={item} onPress={handleSelectPrescription} />
            </View>
          )}
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
      )}
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
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing['2xl'],
  },
  cardWrapper: {
    marginBottom: spacing.md,
  },
  loadingContainer: {
    padding: spacing.md,
  },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonTextCol: {
    flex: 1,
    marginLeft: spacing.md,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
});
