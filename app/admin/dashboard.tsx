import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ShieldAlert, CheckCircle, XCircle, UserCheck, Stethoscope, Store } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { fetchAdminReports, resolveReport, approveEntity } from '../../src/lib/admin/adminService';
import { AdminReport, VerificationCandidate } from '../../src/types/admin';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

const DEFAULT_CANDIDATES: VerificationCandidate[] = [
  {
    id: 'cand_vet_01',
    name: 'Dr. Sarah Connor, DVM',
    type: 'vet',
    licenseOrTaxId: 'VET-LIC-TX-8841',
    country: 'United States',
    submittedAt: '2026-11-20',
    status: 'pending',
  },
  {
    id: 'cand_seller_02',
    name: 'Alpine Organic Pet Nutrients',
    type: 'seller',
    licenseOrTaxId: 'TAX-EU-948123',
    country: 'Switzerland',
    submittedAt: '2026-11-19',
    status: 'pending',
  },
  {
    id: 'cand_clinic_03',
    name: 'Metropolitan Animal Hospital',
    type: 'clinic',
    licenseOrTaxId: 'CLINIC-HOSP-4421',
    country: 'United Kingdom',
    submittedAt: '2026-11-18',
    status: 'pending',
  },
];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'moderation' | 'approvals'>('moderation');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [candidates, setCandidates] = useState<VerificationCandidate[]>(DEFAULT_CANDIDATES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const rep = await fetchAdminReports();
    setReports(rep);
    setLoading(false);
  };

  const handleResolve = async (id: string, action: string) => {
    try {
      await resolveReport(id, action);
      setReports((prev) => prev.filter((r) => r.id !== id));
      Alert.alert('Report Resolved', `Action recorded: ${action}`);
    } catch {
      setReports((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const handleApproveCandidate = async (candidate: VerificationCandidate) => {
    try {
      await approveEntity(candidate.type, candidate.id);
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, status: 'verified' } : c))
      );
      Alert.alert('Entity Approved', `${candidate.name} has been verified.`);
    } catch {
      setCandidates((prev) =>
        prev.map((c) => (c.id === candidate.id ? { ...c, status: 'verified' } : c))
      );
    }
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform Admin Console</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'moderation' && styles.tabActive]}
          onPress={() => setActiveTab('moderation')}
        >
          <ShieldAlert size={16} color={activeTab === 'moderation' ? colors.cream : colors.ink} />
          <Text style={[styles.tabText, activeTab === 'moderation' && styles.tabTextActive]}>
            Flagged Queue ({reports.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'approvals' && styles.tabActive]}
          onPress={() => setActiveTab('approvals')}
        >
          <UserCheck size={16} color={activeTab === 'approvals' ? colors.cream : colors.ink} />
          <Text style={[styles.tabText, activeTab === 'approvals' && styles.tabTextActive]}>
            Approvals ({candidates.filter((c) => c.status === 'pending').length})
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'moderation' ? (
          <FlatList
            data={reports}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <CheckCircle size={40} color={colors.success} />
                <Text style={styles.emptyText}>All flagged content has been reviewed!</Text>
              </View>
            }
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{item.targetType.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.reportTime}>Reported by: {item.reporterName || 'Anonymous'}</Text>
                </View>

                <Text style={styles.reasonText}>{item.reason}</Text>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.dismissBtn]}
                    onPress={() => handleResolve(item.id, 'Dismissed as false positive')}
                  >
                    <XCircle size={15} color={colors.ink} />
                    <Text style={styles.actionBtnText}>Dismiss</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.removeBtn]}
                    onPress={() => handleResolve(item.id, 'Content removed & warned user')}
                  >
                    <ShieldAlert size={15} color={colors.white} />
                    <Text style={[styles.actionBtnText, { color: colors.white }]}>Remove Post</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            )}
          />
        ) : (
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Card style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.entityRow}>
                    {item.type === 'vet' && <Stethoscope size={16} color={colors.primaryDark} />}
                    {item.type === 'seller' && <Store size={16} color={colors.primaryDark} />}
                    {item.type === 'clinic' && <ShieldAlert size={16} color={colors.primaryDark} />}
                    <Text style={styles.candidateName}>{item.name}</Text>
                  </View>
                  <View style={[styles.statusTag, item.status === 'verified' && styles.statusVerified]}>
                    <Text style={styles.statusTagText}>{item.status.toUpperCase()}</Text>
                  </View>
                </View>

                <Text style={styles.metaText}>License / ID: {item.licenseOrTaxId}</Text>
                <Text style={styles.metaText}>Country: {item.country}</Text>

                {item.status === 'pending' && (
                  <View style={styles.approvalActionRow}>
                    <Button
                      title="✓ Verify & Approve"
                      style={styles.approveBtn}
                      onPress={() => handleApproveCandidate(item)}
                    />
                  </View>
                )}
              </Card>
            )}
          />
        )}
      </View>
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
  tabBar: {
    flexDirection: 'row',
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  tabActive: {
    backgroundColor: colors.ink,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  tabTextActive: {
    color: colors.cream,
  },
  content: {
    flex: 1,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderRadius: radii.lg,
    gap: spacing.xs,
    borderColor: colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tag: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  reportTime: {
    fontSize: 11,
    color: colors.muted,
  },
  reasonText: {
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 19,
    marginVertical: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radii.pill,
  },
  dismissBtn: {
    backgroundColor: colors.surface,
  },
  removeBtn: {
    backgroundColor: colors.destructive,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  emptyBox: {
    paddingTop: 60,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  entityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  candidateName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  statusTag: {
    backgroundColor: colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.pill,
  },
  statusVerified: {
    backgroundColor: colors.success,
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.white,
  },
  metaText: {
    fontSize: 13,
    color: colors.muted,
  },
  approvalActionRow: {
    marginTop: spacing.sm,
  },
  approveBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 10,
  },
  approveBtnText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 13,
  },
});
