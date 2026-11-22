import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Star, ShieldCheck, ShoppingCart } from 'lucide-react-native';
import { Product } from '../../types/marketplace';
import { useCartStore } from '../../lib/marketplace/cartStore';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { radii } from '../../theme/radii';
import { spacing } from '../../theme/spacing';
import { Text } from '../ui/Text';
import { Card } from '../ui/Card';

interface ProductCardProps {
  product: Product;
  onPress: () => void;
}

export function ProductCard({ product, onPress }: ProductCardProps) {
  const { formatPrice, addToCart } = useCartStore();

  return (
    <Card style={styles.card}>
      <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: product.imageUrl }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
          {product.isVetApproved && (
            <View style={styles.badge}>
              <ShieldCheck size={12} color={colors.ink} />
              <Text style={styles.badgeText}>Vet Approved</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <View style={styles.ratingRow}>
            <Star size={13} color={colors.primaryDark} fill={colors.primaryDark} />
            <Text style={styles.ratingText}>{product.rating.toFixed(1)}</Text>
            <Text style={styles.reviewText}>({product.reviewsCount})</Text>
          </View>

          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>

          <Text style={styles.blurb} numberOfLines={2}>
            {product.blurb}
          </Text>

          <View style={styles.footer}>
            <View>
              <Text style={styles.price}>{formatPrice(product.priceUsd)}</Text>
            </View>

            <TouchableOpacity
              style={styles.cartButton}
              onPress={(e) => {
                e.stopPropagation?.();
                addToCart(product);
              }}
              activeOpacity={0.8}
            >
              <ShoppingCart size={15} color={colors.ink} />
              <Text style={styles.cartButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
  },
  imageContainer: {
    width: '100%',
    height: 150,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: typography.caption.fontFamily,
  },
  content: {
    padding: spacing.md,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  reviewText: {
    fontSize: 11,
    color: colors.muted,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: typography.headingMd.fontFamily,
    marginBottom: 4,
  },
  blurb: {
    fontSize: 12,
    color: colors.inkSoft,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  price: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: typography.headingLg.fontFamily,
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  cartButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
});
