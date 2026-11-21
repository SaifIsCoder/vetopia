import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, PenSquare, BookOpen } from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { SearchInput } from '../../src/components/ui/SearchInput';
import { Chip } from '../../src/components/ui/Chip';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { ArticleCard } from '../../src/components/articles/ArticleCard';
import { useArticles } from '../../src/hooks/useArticles';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

const ARTICLE_CATEGORIES = [
  { id: 'all', label: 'All Articles' },
  { id: 'Canine Health', label: 'Canine Health' },
  { id: 'Feline Nutrition', label: 'Feline Nutrition' },
  { id: 'Avian Care', label: 'Avian Care' },
  { id: 'Equine Wellness', label: 'Equine Wellness' },
  { id: 'Livestock', label: 'Livestock' },
  { id: 'Preventative', label: 'Preventative' },
];

export default function ArticlesDirectoryScreen() {
  const router = useRouter();
  const { user, role } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const {
    data: articles = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useArticles(searchQuery, selectedCategory);

  const canAuthor =
    role === 'admin' ||
    user?.isVet === true ||
    user?.isVetVerified === true ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('vet');

  const handleRefresh = async () => {
    await refetch();
  };

  const handleCreateArticle = () => {
    router.push('/articles/create' as any);
  };

  if (isLoading) {
    return (
      <Screen scrollable testID="articles-loading-screen">
        <View style={styles.header}>
          <Skeleton width={140} height={28} />
          <Skeleton width={100} height={32} style={{ borderRadius: radii.pill }} />
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <Skeleton width="100%" height={200} style={{ borderRadius: radii.md }} />
          <Skeleton width="100%" height={200} style={{ borderRadius: radii.md }} />
        </View>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen scrollable testID="articles-error-screen">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={2}>Articles Library</Heading>
        </View>
        <ErrorState
          title="Could not load articles"
          message={(error as Error)?.message || 'Please check your connection and try again.'}
          onRetry={handleRefresh}
        />
      </Screen>
    );
  }

  return (
    <Screen
      scrollable
      scrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor={colors.primaryDark}
            colors={[colors.primaryDark]}
          />
        ),
      }}
      testID="articles-directory-screen"
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="btn-articles-back"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerTitles}>
          <Heading level={2} style={styles.title}>
            Educational Articles
          </Heading>
          <Text variant="caption" color={colors.muted}>
            Veterinary-authored clinical guides & wellness tips
          </Text>
        </View>

        {canAuthor ? (
          <Button
            title="Write"
            variant="primary"
            size="sm"
            onPress={handleCreateArticle}
            leftIcon={<PenSquare size={14} color={colors.ink} />}
            style={styles.writeBtn}
            testID="btn-write-article"
          />
        ) : null}
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <SearchInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="Search by symptom, topic, or species..."
          testID="input-search-articles"
        />
      </View>

      {/* Category Filter Chips */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {ARTICLE_CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Chip
                key={cat.id}
                label={cat.label}
                selected={isSelected}
                onPress={() => setSelectedCategory(cat.id)}
                testID={`chip-category-${cat.id}`}
              />
            );
          })}
        </ScrollView>
      </View>

      {/* Articles List */}
      {articles.length === 0 ? (
        <EmptyState
          title="No Articles Found"
          description={
            searchQuery
              ? `No educational articles matching "${searchQuery}". Try a different keyword.`
              : 'There are no published articles in this category yet.'
          }
          icon={<BookOpen size={48} color={colors.muted} />}
          actionTitle={searchQuery ? 'Clear Search' : undefined}
          onAction={searchQuery ? () => setSearchQuery('') : undefined}
        />
      ) : (
        <View style={styles.articlesList}>
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: 22,
  },
  writeBtn: {
    minWidth: 80,
  },
  searchSection: {
    marginBottom: spacing.sm,
  },
  categorySection: {
    marginBottom: spacing.md,
  },
  categoryScroll: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  articlesList: {
    marginTop: spacing.xs,
  },
});
