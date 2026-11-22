import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { ShoppingBag, Search, Sparkles, Filter } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Text } from '../../src/components/ui/Text';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { ProductCard } from '../../src/components/marketplace/ProductCard';
import { useCartStore, SupportedCurrency } from '../../src/lib/marketplace/cartStore';
import { fetchMarketplaceItems } from '../../src/lib/marketplace/marketplaceService';
import { Product, MarketplaceCategory } from '../../src/types/marketplace';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';
import { typography } from '../../src/theme/typography';

const CATEGORIES: MarketplaceCategory[] = [
  'All',
  'Food',
  'Toys',
  'Grooming',
  'Health',
  'Farm Supplies',
  'Pre-loved',
];

const CURRENCIES: SupportedCurrency[] = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'PKR', 'AED'];

export default function MarketplaceScreen() {
  const router = useRouter();
  const { items: cartItems, currency, setCurrency } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MarketplaceCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const loadProducts = async () => {
    setLoading(true);
    const data = await fetchMarketplaceItems(selectedCategory);
    setProducts(data);
    setLoading(false);
  };

  const filtered = products.filter((p) => {
    if (!searchQuery) return true;
    return (
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.blurb.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <Screen style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Vet Marketplace</Text>
          <Text style={styles.headerSubtitle}>Vet-approved nutrition, gear & care</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.currencyBadge}
            onPress={() => {
              const nextIndex = (CURRENCIES.indexOf(currency) + 1) % CURRENCIES.length;
              setCurrency(CURRENCIES[nextIndex]);
            }}
          >
            <Text style={styles.currencyText}>{currency}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cartIconContainer}
            onPress={() => router.push('/marketplace/cart' as any)}
          >
            <ShoppingBag size={20} color={colors.ink} />
            {totalCartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <SearchInput
          placeholder="Search vet-approved products..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.categoryScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryScroll}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, active && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.slug}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <ProductCard
            product={item}
            onPress={() => router.push(`/marketplace/${item.slug}` as any)}
          />
        )}
      />
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    fontFamily: typography.displayMd.fontFamily,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.inkSoft,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  currencyBadge: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  currencyText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  cartIconContainer: {
    position: 'relative',
    backgroundColor: colors.primary,
    width: 42,
    height: 42,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    backgroundColor: colors.ink,
    borderRadius: radii.pill,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.cream,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    marginVertical: spacing.xs,
  },
  categoryScrollContainer: {
    marginVertical: spacing.sm,
  },
  categoryScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryChipActive: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inkSoft,
  },
  categoryChipTextActive: {
    color: colors.cream,
    fontWeight: '700',
  },
  listContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['4xl'],
  },
});
