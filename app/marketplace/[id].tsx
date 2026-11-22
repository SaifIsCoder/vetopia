import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ArrowLeft, Star, ShieldCheck, ShoppingCart, CheckCircle, Truck } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { useCartStore } from '../../src/lib/marketplace/cartStore';
import { fetchProductBySlug } from '../../src/lib/marketplace/marketplaceService';
import { Product } from '../../src/types/marketplace';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { addToCart, formatPrice } = useCartStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProductBySlug(id).then(setProduct);
    }
  }, [id]);

  if (!product) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.loadingContainer}>
          <Text>Loading product details...</Text>
        </View>
      </Screen>
    );
  }

  const handleAddToCart = () => {
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <Screen style={styles.screen}>
      <View style={styles.topNav}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>
          {product.name}
        </Text>
        <TouchableOpacity
          style={styles.cartNavButton}
          onPress={() => router.push('/marketplace/cart' as any)}
        >
          <ShoppingCart size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.imageBox}>
          <Image source={{ uri: product.imageUrl }} style={styles.image} contentFit="cover" />
          {product.isVetApproved && (
            <View style={styles.vetBadge}>
              <ShieldCheck size={14} color={colors.ink} />
              <Text style={styles.vetBadgeText}>Verified Vet Approved</Text>
            </View>
          )}
        </View>

        <View style={styles.infoBox}>
          <View style={styles.ratingRow}>
            <View style={styles.starGroup}>
              <Star size={16} color={colors.primaryDark} fill={colors.primaryDark} />
              <Text style={styles.ratingVal}>{product.rating.toFixed(1)}</Text>
              <Text style={styles.ratingCount}>({product.reviewsCount} customer reviews)</Text>
            </View>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>
          </View>

          <Text style={styles.title}>{product.name}</Text>
          <Text style={styles.price}>{formatPrice(product.priceUsd)}</Text>
          <Text style={styles.blurb}>{product.blurb}</Text>

          <View style={styles.shippingNotice}>
            <Truck size={16} color={colors.ink} />
            <Text style={styles.shippingText}>
              Free standard delivery on orders over $50
            </Text>
          </View>

          <View style={styles.detailsSection}>
            <Text style={styles.detailsHeading}>Product Highlights</Text>
            {product.details.map((detail, idx) => (
              <View key={idx} style={styles.detailRow}>
                <CheckCircle size={15} color={colors.success} />
                <Text style={styles.detailText}>{detail}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.bottomPriceGroup}>
          <Text style={styles.bottomTotalLabel}>Total Price</Text>
          <Text style={styles.bottomPriceVal}>{formatPrice(product.priceUsd)}</Text>
        </View>

        <Button
          title={added ? '✓ Added to Cart' : 'Add to Cart'}
          style={[styles.addButton, added && styles.addedButton]}
          onPress={handleAddToCart}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    maxWidth: '70%',
  },
  cartNavButton: {
    padding: spacing.xs,
  },
  content: {
    paddingBottom: 100,
  },
  imageBox: {
    width: '100%',
    height: 280,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  vetBadge: {
    position: 'absolute',
    bottom: spacing.md,
    left: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  vetBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  infoBox: {
    padding: spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  starGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  ratingCount: {
    fontSize: 12,
    color: colors.muted,
  },
  categoryBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: typography.displayMd.fontFamily,
    marginVertical: spacing.xs,
  },
  price: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: typography.displayLg.fontFamily,
    marginBottom: spacing.sm,
  },
  blurb: {
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  shippingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.lg,
  },
  shippingText: {
    fontSize: 13,
    color: colors.ink,
    fontWeight: '600',
  },
  detailsSection: {
    gap: spacing.sm,
  },
  detailsHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.inkSoft,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  bottomPriceGroup: {
    flexDirection: 'column',
  },
  bottomTotalLabel: {
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  bottomPriceVal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.pill,
  },
  addedButton: {
    backgroundColor: colors.success,
  },
  buttonText: {
    color: colors.ink,
    fontWeight: '700',
  },
});
