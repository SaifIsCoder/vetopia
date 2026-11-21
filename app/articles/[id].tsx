import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Clock,
  Eye,
  ShieldCheck,
  Edit2,
  Trash2,
  Calendar,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Badge } from '../../src/components/ui/Badge';
import { Card } from '../../src/components/ui/Card';
import { Avatar } from '../../src/components/ui/Avatar';
import { Skeleton } from '../../src/components/ui/Skeleton';
import { ErrorState } from '../../src/components/feedback/ErrorState';
import { useArticle, useDeleteArticle } from '../../src/hooks/useArticles';
import { articleService } from '../../src/lib/articles/articleService';
import { useAuthStore } from '../../src/store/authStore';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

export default function ArticleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, role } = useAuthStore();

  const { data: article, isLoading, isError, error, refetch } = useArticle(id);
  const deleteMutation = useDeleteArticle();

  useEffect(() => {
    if (article?.id) {
      articleService.incrementViewCount(article.id).catch(() => {});
    }
  }, [article?.id]);

  const isAuthor = user?.id === article?.author_id;
  const isAdmin = role === 'admin';
  const canManage = isAuthor || isAdmin;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unpublished';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const handleEditPress = () => {
    if (!article) return;
    router.push({
      pathname: '/articles/create' as any,
      params: { articleId: article.id },
    });
  };

  const handleDeletePress = () => {
    if (!article) return;
    Alert.alert(
      'Delete Article',
      `Are you sure you want to delete "${article.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(article.id);
              Alert.alert('Article Deleted', 'The article has been permanently removed.', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Could not delete article.');
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <Screen scrollable testID="article-detail-loading">
        <Skeleton width="100%" height={220} style={{ borderRadius: radii.md }} />
        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Skeleton width="40%" height={20} />
          <Skeleton width="90%" height={32} />
          <Skeleton width="70%" height={24} />
          <Skeleton width="100%" height={120} style={{ marginTop: spacing.md }} />
        </View>
      </Screen>
    );
  }

  if (isError || !article) {
    return (
      <Screen scrollable testID="article-detail-error">
        <View style={styles.topNav}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={2}>Article</Heading>
        </View>
        <ErrorState
          title="Article Not Found"
          message={(error as Error)?.message || 'The requested article could not be loaded.'}
          onRetry={refetch}
        />
      </Screen>
    );
  }

  return (
    <Screen scrollable testID="article-detail-screen">
      {/* Top Navigation */}
      <View style={styles.topNav}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Go back"
          accessibilityRole="button"
          testID="btn-article-back"
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        {canManage ? (
          <View style={styles.actionControls}>
            <TouchableOpacity
              onPress={handleEditPress}
              style={styles.controlBtn}
              accessibilityLabel="Edit article"
              accessibilityRole="button"
              testID="btn-edit-article"
            >
              <Edit2 size={16} color={colors.ink} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDeletePress}
              style={[styles.controlBtn, { backgroundColor: '#FEE2E2' }]}
              accessibilityLabel="Delete article"
              accessibilityRole="button"
              testID="btn-delete-article"
            >
              <Trash2 size={16} color={colors.destructive} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {/* Hero Cover Image */}
      {article.cover_image ? (
        <View style={styles.coverImageContainer}>
          <Image
            source={{ uri: article.cover_image }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Article Header & Metadata */}
      <View style={styles.headerSection}>
        <View style={styles.categoryRow}>
          <View style={styles.categoryBadge}>
            <Text variant="caption" style={styles.categoryBadgeText}>
              {article.category}
            </Text>
          </View>
          {article.status !== 'published' ? (
            <Badge
              variant={article.status === 'draft' ? 'pending' : 'cancelled'}
              label={article.status.toUpperCase()}
            />
          ) : null}
        </View>

        <Heading level={1} style={styles.articleTitle}>
          {article.title}
        </Heading>

        <Text variant="bodyMd" color={colors.inkSoft} style={styles.summaryText}>
          {article.summary}
        </Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Calendar size={13} color={colors.muted} style={{ marginRight: 4 }} />
            <Text variant="caption" color={colors.muted}>
              {formatDate(article.published_at || article.created_at)}
            </Text>
          </View>

          <View style={styles.metaDot} />

          <View style={styles.metaItem}>
            <Clock size={13} color={colors.muted} style={{ marginRight: 4 }} />
            <Text variant="caption" color={colors.muted}>
              {article.reading_time_minutes} min read
            </Text>
          </View>

          <View style={styles.metaDot} />

          <View style={styles.metaItem}>
            <Eye size={13} color={colors.muted} style={{ marginRight: 4 }} />
            <Text variant="caption" color={colors.muted}>
              {article.view_count} views
            </Text>
          </View>
        </View>
      </View>

      {/* Author Card */}
      <Card style={styles.authorCard}>
        <View style={styles.authorRow}>
          <Avatar
            name={article.author?.full_name || 'Veterinarian'}
            source={article.author?.avatar_url || undefined}
            size={48}
          />
          <View style={styles.authorMeta}>
            <View style={styles.authorNameRow}>
              <Heading level={4}>{article.author?.full_name || 'Veterinary Clinical Author'}</Heading>
              {article.is_vet_verified ? (
                <View style={styles.vetBadge}>
                  <ShieldCheck size={12} color="#15803D" />
                  <Text variant="caption" color="#15803D" style={styles.vetBadgeText}>
                    Verified Vet
                  </Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" color={colors.muted}>
              Licensed Veterinary Medical Professional
            </Text>
          </View>
        </View>
      </Card>

      {/* Main Content Body */}
      <Card style={styles.contentCard}>
        <Text variant="bodyMd" color={colors.ink} style={styles.articleBody}>
          {article.content}
        </Text>

        {/* Tags */}
        {article.tags && article.tags.length > 0 ? (
          <View style={styles.tagsSection}>
            <Text variant="caption" color={colors.muted} style={{ marginBottom: 6 }}>
              TAGS:
            </Text>
            <View style={styles.tagsRow}>
              {article.tags.map((tag, idx) => (
                <View key={idx} style={styles.tagPill}>
                  <Text variant="caption" color={colors.inkSoft}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </Card>

      {/* Medical Disclaimer */}
      <Card style={styles.disclaimerCard}>
        <Text variant="caption" color={colors.inkSoft} style={styles.disclaimerText}>
          Medical Disclaimer: This article is provided for educational and preventive wellness guidance. It does not replace individualized diagnosis, prescription, or emergency clinical intervention by your licensed veterinarian.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  backBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  actionControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  controlBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  coverImageContainer: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  headerSection: {
    marginBottom: spacing.md,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: `${colors.primary}25`,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.ink,
  },
  articleTitle: {
    fontSize: 24,
    lineHeight: 32,
    marginBottom: spacing.xs,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.md,
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.muted,
    marginHorizontal: 8,
  },
  authorCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
    borderWidth: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorMeta: {
    marginLeft: spacing.sm,
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  vetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    gap: 3,
  },
  vetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  contentCard: {
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  articleBody: {
    fontSize: 16,
    lineHeight: 26,
  },
  tagsSection: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tagPill: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  disclaimerCard: {
    backgroundColor: '#FEF9C3',
    borderColor: '#FEF08A',
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  disclaimerText: {
    lineHeight: 18,
  },
});
