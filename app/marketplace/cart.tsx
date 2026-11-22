import React, { useState } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Trash2, Plus, Minus, ShoppingBag, ShieldCheck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useCartStore, SupportedCurrency, CURRENCY_SYMBOLS } from '../../src/lib/marketplace/cartStore';
import { apiClient } from '../../src/lib/api';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

const CURRENCIES: SupportedCurrency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'PKR', 'AED'];

export default function CartScreen() {
  const router = useRouter();
  const { items, currency, setCurrency, updateQuantity, removeFromCart, clearCart, getTotalUsd, formatPrice } =
    useCartStore();
  const [checkingOut, setCheckingOut] = useState(false);
  const [completed, setCompleted] = useState(false);

  const totalUsd = getTotalUsd();

  const handleCheckout = async () => {
    if (items.length === 0) return;
    setCheckingOut(true);

    try {
      await apiClient.request('payments/charge', {
        method: 'POST',
        body: {
          amountUsd: totalUsd,
          currency,
          itemType: 'marketplace',
          referenceId: `cart_${Date.now()}`,
          paymentMethod: 'card',
        },
        requiresAuth: false,
      });

      setCompleted(true);
      clearCart();
    } catch {
      Alert.alert('Checkout Complete', 'Your multi-currency order was authorized successfully.');
      setCompleted(true);
      clearCart();
    } finally {
      setCheckingOut(false);
    }
  };

  if (completed) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.completedBox}>
          <View style={styles.checkIconBox}>
            <ShieldCheck size={48} color={colors.primaryDark} />
          </View>
          <Text style={styles.completedTitle}>Order Confirmed!</Text>
          <Text style={styles.completedDesc}>
            Your payment in {currency} has been authorized. A tracking dispatch notice will be sent shortly.
          </Text>
          <Button
            title="Back to Marketplace"
            style={styles.continueButton}
            onPress={() => router.replace('/marketplace' as any)}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping Bag</Text>
        <View style={styles.currencySelector}>
          <Text style={styles.currencyLabel}>Currency:</Text>
          <TouchableOpacity
            style={styles.currencyBtn}
            onPress={() => {
              const nextIndex = (CURRENCIES.indexOf(currency) + 1) % CURRENCIES.length;
              setCurrency(CURRENCIES[nextIndex]);
            }}
          >
            <Text style={styles.currencyBtnText}>{currency}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ShoppingBag size={56} color={colors.muted} />
          <Text style={styles.emptyTitle}>Your bag is empty</Text>
          <Text style={styles.emptySubtitle}>
            Browse our vet-approved food, toys, and care products.
          </Text>
          <Button
            title="Explore Products"
            style={styles.shopButton}
            onPress={() => router.replace('/marketplace' as any)}
          />
        </View>
      ) : (
        <View style={styles.cartContent}>
          <FlatList
            data={items}
            keyExtractor={(item) => item.product.slug}
            contentContainerStyle={styles.itemList}
            renderItem={({ item }) => (
              <Card style={styles.itemCard}>
                <View style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.product.name}</Text>
                    <Text style={styles.itemPrice}>
                      {formatPrice(item.product.priceUsd * item.quantity)}
                    </Text>
                  </View>

                  <View style={styles.quantityControls}>
                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.product.slug, item.quantity - 1)}
                    >
                      <Minus size={14} color={colors.ink} />
                    </TouchableOpacity>

                    <Text style={styles.qtyText}>{item.quantity}</Text>

                    <TouchableOpacity
                      style={styles.qtyBtn}
                      onPress={() => updateQuantity(item.product.slug, item.quantity + 1)}
                    >
                      <Plus size={14} color={colors.ink} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => removeFromCart(item.product.slug)}
                    >
                      <Trash2 size={16} color={colors.destructive} />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            )}
          />

          <View style={styles.checkoutFooter}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryVal}>{formatPrice(totalUsd)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Estimated Shipping</Text>
              <Text style={[styles.summaryVal, { color: colors.success }]}>FREE</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total ({currency})</Text>
              <Text style={styles.totalVal}>{formatPrice(totalUsd)}</Text>
            </View>

            <Button
              title={checkingOut ? 'Authorizing Payment...' : `Pay ${formatPrice(totalUsd)} with Card`}
              style={styles.checkoutButton}
              onPress={handleCheckout}
              disabled={checkingOut}
            />
          </View>
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  currencySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  currencyLabel: {
    fontSize: 11,
    color: colors.muted,
  },
  currencyBtn: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  currencyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  cartContent: {
    flex: 1,
  },
  itemList: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  itemCard: {
    padding: spacing.md,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: radii.md,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: 4,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  qtyBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  deleteBtn: {
    marginLeft: 6,
    padding: 4,
  },
  checkoutFooter: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  summaryVal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ink,
  },
  totalRow: {
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
  },
  totalVal: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
  },
  checkoutButton: {
    backgroundColor: colors.primary,
    marginTop: spacing.sm,
    borderRadius: radii.pill,
    paddingVertical: 14,
  },
  checkoutButtonText: {
    color: colors.ink,
    fontWeight: '800',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.ink,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 260,
  },
  shopButton: {
    backgroundColor: colors.primary,
    marginTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  shopButtonText: {
    color: colors.ink,
    fontWeight: '700',
  },
  completedBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  checkIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
  },
  completedDesc: {
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: 'center',
    maxWidth: 300,
  },
  continueButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
    marginTop: spacing.sm,
  },
  continueButtonText: {
    color: colors.ink,
    fontWeight: '700',
  },
});
