import React from 'react';
import { View, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Clock, Eye, ShieldCheck, BookOpen } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Article } from '../../types/article';
import { Card } from '../ui/Card';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface ArticleCardProps {
  article: Article;
  onPress?: (article: Article) => void;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ article, onPress }) => {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress(article);
    } else {
      router.push(`/articles/${article.id}` as any);
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Read article: ${article.title}. ${article.reading_time_minutes} minute read.`}
      testID={`article-card-${article.id}`}
    >
      <Card style={styles.card}>
        {/* Cover Image or Thematic Placeholder */}
        <View style={styles.imageContainer}>
          {article.cover_image ? (
            <Image
              source={{ uri: article.cover_image }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.placeholderContainer}>
              <BookOpen size={36} color={colors.primaryDark} />
            </View>
          )}
          <View style={styles.badgeOverlay}>
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
        </View>

        {/* Content Body */}
        <View style={styles.content}>
          <Heading level={4} numberOfLines={2} style={styles.title}>
            {article.title}
          </Heading>

          <Text variant="bodySm" color={colors.inkSoft} numberOfLines={2} style={styles.summary}>
            {article.summary}
          </Text>

          {/* Metadata Footer */}
          <View style={styles.footer}>
            <View style={styles.authorRow}>
              <Text variant="caption" color={colors.ink} style={styles.authorName} numberOfLines={1}>
                {article.author?.full_name || 'Verified Veterinarian'}
              </Text>
              {article.is_vet_verified ? (
                <ShieldCheck size={13} color="#15803D" style={{ marginLeft: 3 }} />
              ) : null}
            </View>

            <View style={styles.metaRight}>
              <View style={styles.metaItem}>
                <Clock size={12} color={colors.muted} style={{ marginRight: 3 }} />
                <Text variant="caption" color={colors.muted}>
                  {article.reading_time_minutes} min
                </Text>
              </View>

              <View style={styles.metaDot} />

              <View style={styles.metaItem}>
                <Eye size={12} color={colors.muted} style={{ marginRight: 3 }} />
                <Text variant="caption" color={colors.muted}>
                  {article.view_count}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 0,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  imageContainer: {
    width: '100%',
    height: 150,
    backgroundColor: colors.surface,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.ink,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: spacing.xs,
  },
  summary: {
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  authorName: {
    fontWeight: '600',
    fontSize: 12,
  },
  metaRight: {
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
    marginHorizontal: 6,
  },
});
