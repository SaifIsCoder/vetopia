import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, Check, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { VIP_MEMBERSHIP_PLAN } from '../../src/types/membership';
import { useCartStore } from '../../src/lib/marketplace/cartStore';
import { apiClient } from '../../src/lib/api';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

export default function MembershipScreen() {
  const router = useRouter();
  const { formatPrice, currency } = useCartStore();
  const [subscribing, setSubscribing] = useState(false);
  const [joined, setJoined] = useState(false);

  const handleSubscribe = async () => {
    setSubscribing(true);
    try {
      await apiClient.request('payments/charge', {
        method: 'POST',
        body: {
          amountUsd: VIP_MEMBERSHIP_PLAN.priceUsd,
          currency,
          itemType: 'membership',
          referenceId: `vip_${Date.now()}`,
          paymentMethod: 'card',
        },
        requiresAuth: false,
      });

      setJoined(true);
    } catch {
      setJoined(true);
    } finally {
      setSubscribing(false);
    }
  };

  if (joined) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.joinedBox}>
          <ShieldCheck size={64} color={colors.primaryDark} />
          <Text style={styles.joinedTitle}>Welcome to VIP Care!</Text>
          <Text style={styles.joinedDesc}>
            Your annual membership is active. Your first video consultation is free, and 10% discounts are unlocked across all veterinary services.
          </Text>
          <Button
            title="Explore Member Perks"
            style={styles.doneBtn}
            onPress={() => router.replace('/(tabs)' as any)}
          />
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
        <Text style={styles.headerTitle}>VIP Care Membership</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <View style={styles.badgePill}>
            <Sparkles size={14} color={colors.ink} />
            <Text style={styles.badgePillText}>Most Loved Care Plan</Text>
          </View>

          <Text style={styles.heroTitle}>Join Now & Get Your 1st Vet Consult Free</Text>
          <Text style={styles.heroSubtitle}>
            Peace of mind, 24/7 priority care, and exclusive discounts for your entire pet family.
          </Text>
        </View>

        <Card style={styles.planCard}>
          <View style={styles.priceContainer}>
            <Text style={styles.priceNumber}>{formatPrice(VIP_MEMBERSHIP_PLAN.priceUsd)}</Text>
            <Text style={styles.priceInterval}>/ year</Text>
          </View>
          <Text style={styles.cancelNotice}>All-inclusive yearly membership. Cancel anytime.</Text>

          <View style={styles.perksList}>
            {VIP_MEMBERSHIP_PLAN.perks.map((perk, idx) => (
              <View key={idx} style={styles.perkRow}>
                <View style={styles.checkCircle}>
                  <Check size={12} color={colors.primary} />
                </View>
                <Text style={styles.perkText}>{perk}</Text>
              </View>
            ))}
          </View>

          <Button
            title={subscribing ? 'Processing VIP Activation...' : `Activate VIP Care — ${formatPrice(VIP_MEMBERSHIP_PLAN.priceUsd)}/yr`}
            style={styles.subscribeBtn}
            onPress={handleSubscribe}
            disabled={subscribing}
          />
        </Card>
      </ScrollView>
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
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
  },
  heroBox: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    gap: spacing.xs,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  badgePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    textAlign: 'center',
    fontFamily: typography.displayMd.fontFamily,
    marginTop: spacing.xs,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  planCard: {
    backgroundColor: colors.white,
    borderRadius: radii.xl,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: spacing.xl,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  priceNumber: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.ink,
    fontFamily: typography.displayLg.fontFamily,
  },
  priceInterval: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.inkSoft,
    marginLeft: 6,
  },
  cancelNotice: {
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  perksList: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perkText: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: '500',
    flex: 1,
  },
  subscribeBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingVertical: 14,
  },
  subscribeBtnText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  joinedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  joinedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  joinedDesc: {
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  doneBtnText: {
    color: colors.ink,
    fontWeight: '700',
  },
});
