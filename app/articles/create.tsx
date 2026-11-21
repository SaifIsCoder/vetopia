import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Image as ImageIcon,
  Camera,
  X,
  Send,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react-native';
import { Screen } from '../../src/components/layout/Screen';
import { Heading } from '../../src/components/ui/Heading';
import { Text } from '../../src/components/ui/Text';
import { Button } from '../../src/components/ui/Button';
import { Input } from '../../src/components/ui/Input';
import { Card } from '../../src/components/ui/Card';
import { Chip } from '../../src/components/ui/Chip';
import { Skeleton } from '../../src/components/ui/Skeleton';
import {
  useArticle,
  useCreateArticle,
  useUpdateArticle,
} from '../../src/hooks/useArticles';
import { clubPhotoService } from '../../src/lib/clubs/clubPhotoService';
import { useAuthStore } from '../../src/store/authStore';
import { Article, ArticleCategory, ArticleStatus } from '../../src/types/article';
import { colors } from '../../src/theme/colors';
import { spacing } from '../../src/theme/spacing';
import { radii } from '../../src/theme/radii';

const ARTICLE_CATEGORIES: ArticleCategory[] = [
  'Canine Health',
  'Feline Nutrition',
  'Avian Care',
  'Equine Wellness',
  'Livestock',
  'Preventative',
];

interface ArticleFormProps {
  initialArticle?: Article | null;
  articleId?: string;
  isEditing: boolean;
}

function ArticleForm({ initialArticle, articleId, isEditing }: ArticleFormProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const [title, setTitle] = useState(initialArticle?.title || '');
  const [summary, setSummary] = useState(initialArticle?.summary || '');
  const [content, setContent] = useState(initialArticle?.content || '');
  const [category, setCategory] = useState<ArticleCategory>(
    initialArticle?.category || 'Canine Health',
  );
  const [tagsStr, setTagsStr] = useState(initialArticle?.tags?.join(', ') || '');
  const [status, setStatus] = useState<ArticleStatus>(initialArticle?.status || 'published');
  const [imageUri, setImageUri] = useState<string | null>(initialArticle?.cover_image || null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useCreateArticle();
  const updateMutation = useUpdateArticle();

  const handlePickLibrary = async () => {
    setErrorMsg(null);
    const result = await clubPhotoService.pickFromLibrary();
    if (!result.canceled && result.uri) {
      setImageUri(result.uri);
    } else if (result.error) {
      setErrorMsg(result.error);
    }
  };

  const handleTakePhoto = async () => {
    setErrorMsg(null);
    const result = await clubPhotoService.takePhoto();
    if (!result.canceled && result.uri) {
      setImageUri(result.uri);
    } else if (result.error) {
      setErrorMsg(result.error);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || title.trim().length < 3 || title.trim().length > 200) {
      setErrorMsg('Title must be between 3 and 200 characters.');
      return;
    }

    if (!summary.trim() || summary.trim().length < 10 || summary.trim().length > 500) {
      setErrorMsg('Summary must be between 10 and 500 characters.');
      return;
    }

    if (!content.trim() || content.trim().length < 50) {
      setErrorMsg('Article content must contain at least 50 characters.');
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to publish articles.');
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);

    try {
      let finalCoverImage = imageUri;

      if (
        imageUri &&
        (imageUri.startsWith('file:') ||
          imageUri.startsWith('content:') ||
          imageUri.startsWith('blob:') ||
          imageUri.startsWith('ph:'))
      ) {
        finalCoverImage = await clubPhotoService.uploadPostImage(
          imageUri,
          user.id,
          (pct) => setUploadPercent(pct),
        );
      }

      const tags = tagsStr
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (isEditing && articleId) {
        await updateMutation.mutateAsync({
          articleId,
          input: {
            title: title.trim(),
            summary: summary.trim(),
            content: content.trim(),
            category,
            tags,
            cover_image: finalCoverImage,
            status,
          },
        });

        Alert.alert('Article Updated', 'Your article changes have been saved.', [
          {
            text: 'View Article',
            onPress: () => router.replace(`/articles/${articleId}` as any),
          },
        ]);
      } else {
        const created = await createMutation.mutateAsync({
          title: title.trim(),
          summary: summary.trim(),
          content: content.trim(),
          category,
          tags,
          cover_image: finalCoverImage,
          status,
        });

        Alert.alert(
          status === 'published' ? 'Article Published!' : 'Draft Saved',
          status === 'published'
            ? 'Your educational article is now live and visible in the library.'
            : 'Your draft has been saved securely.',
          [
            {
              text: 'View Article',
              onPress: () => router.replace(`/articles/${created.id}` as any),
            },
          ],
        );
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not save article. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
    }
  };

  const isSubmitting = isUploading || createMutation.isPending || updateMutation.isPending;

  return (
    <Screen scrollable testID="create-article-screen">
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityLabel="Cancel"
          disabled={isSubmitting}
        >
          <ArrowLeft size={20} color={colors.ink} />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Heading level={3}>{isEditing ? 'Edit Article' : 'Write Clinical Article'}</Heading>
        </View>

        <Button
          title={status === 'published' ? 'Publish' : 'Save'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          size="sm"
          testID="btn-submit-article"
        />
      </View>

      {/* Validation Banner */}
      {errorMsg ? (
        <View style={styles.errorBanner} testID="article-error-banner">
          <AlertCircle size={18} color={colors.destructive} />
          <Text variant="bodySm" color={colors.destructive} style={{ flex: 1, marginLeft: 8 }}>
            {errorMsg}
          </Text>
        </View>
      ) : null}

      {/* Cover Image Picker Card */}
      <Card style={styles.formCard}>
        <Heading level={4} style={{ marginBottom: spacing.xs }}>
          Hero Cover Image (Optional)
        </Heading>
        <Text variant="caption" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          High-resolution photos increase engagement and help pet owners identify topic relevance.
        </Text>

        {imageUri ? (
          <View style={styles.imagePreviewWrapper}>
            <Image
              source={{ uri: imageUri }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <TouchableOpacity
              onPress={handleRemoveImage}
              style={styles.removeImageBtn}
              accessibilityLabel="Remove cover image"
              accessibilityRole="button"
              testID="btn-remove-cover-image"
            >
              <X size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.photoActionsRow}>
            <Button
              title="Pick Photo"
              variant="outline"
              size="sm"
              leftIcon={<ImageIcon size={16} color={colors.primary} />}
              onPress={handlePickLibrary}
              testID="btn-pick-cover-photo"
            />
            <Button
              title="Take Photo"
              variant="outline"
              size="sm"
              leftIcon={<Camera size={16} color={colors.primary} />}
              onPress={handleTakePhoto}
              testID="btn-take-cover-photo"
            />
          </View>
        )}
      </Card>

      {/* Core Article Metadata */}
      <Card style={styles.formCard}>
        <Input
          label="Article Title *"
          placeholder="e.g. Recognizing Early Signs of Feline Kidney Disease"
          value={title}
          onChangeText={setTitle}
          maxLength={200}
          testID="input-article-title"
        />

        <Text variant="caption" color={colors.inkSoft} style={{ marginBottom: spacing.xs }}>
          Medical Category *
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {ARTICLE_CATEGORIES.map((cat) => (
            <Chip
              key={cat}
              label={cat}
              selected={category === cat}
              onPress={() => setCategory(cat)}
              testID={`chip-category-${cat.toLowerCase().replace(/\s+/g, '-')}`}
            />
          ))}
        </ScrollView>

        <Input
          label="Summary / Clinical Abstract *"
          placeholder="Brief 1-2 sentence overview of findings and takeaways (10–500 chars)..."
          value={summary}
          onChangeText={setSummary}
          multiline
          numberOfLines={2}
          maxLength={500}
          testID="input-article-summary"
        />

        <Input
          label="Keywords / Tags (comma separated)"
          placeholder="e.g. renal, hydration, senior cat, clinical"
          value={tagsStr}
          onChangeText={setTagsStr}
          testID="input-article-tags"
        />
      </Card>

      {/* Article Content Body */}
      <Card style={styles.formCard}>
        <Heading level={4} style={{ marginBottom: spacing.xs }}>
          Article Content *
        </Heading>
        <Text variant="caption" color={colors.inkSoft} style={{ marginBottom: spacing.sm }}>
          Provide evidence-based guidance, clinical signs, diagnostics, and owner recommendations (min 50 chars). Markdown supported.
        </Text>

        <Input
          placeholder="Write article content here. Use ## Headings, - Bullet lists, and **bold text** for readability..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={10}
          style={styles.contentTextArea}
          testID="input-article-content"
        />

        <Text variant="caption" color={colors.inkSoft} style={{ marginTop: 4 }}>
          {content.length} characters (minimum 50)
        </Text>
      </Card>

      {/* Visibility Status Selector */}
      <Card style={styles.formCard}>
        <Heading level={4} style={{ marginBottom: spacing.xs }}>
          Publication Status
        </Heading>

        <View style={styles.statusOptions}>
          <TouchableOpacity
            style={[
              styles.statusOption,
              status === 'published' && styles.statusOptionSelected,
            ]}
            onPress={() => setStatus('published')}
            accessibilityRole="radio"
            accessibilityState={{ selected: status === 'published' }}
            testID="option-status-published"
          >
            <Text
              variant="bodySm"
              style={[
                styles.statusOptionText,
                status === 'published' && styles.statusOptionTextSelected,
              ]}
            >
              Publish Immediately (Public)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.statusOption,
              status === 'draft' && styles.statusOptionSelected,
            ]}
            onPress={() => setStatus('draft')}
            accessibilityRole="radio"
            accessibilityState={{ selected: status === 'draft' }}
            testID="option-status-draft"
          >
            <Text
              variant="bodySm"
              style={[
                styles.statusOptionText,
                status === 'draft' && styles.statusOptionTextSelected,
              ]}
            >
              Save as Draft (Private to Author)
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* Submit / Action Bar */}
      <View style={styles.submitSection}>
        <Button
          title={
            isUploading
              ? `Uploading Cover Photo (${uploadPercent}%)...`
              : isSubmitting
              ? 'Saving Article...'
              : isEditing
              ? 'Update Article'
              : status === 'published'
              ? 'Publish Article'
              : 'Save Draft'
          }
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          leftIcon={<Send size={18} color={colors.ink} />}
          testID="btn-bottom-submit"
        />
      </View>

      <View style={{ height: spacing['2xl'] }} />
    </Screen>
  );
}

export default function CreateEditArticleScreen() {
  const { articleId } = useLocalSearchParams<{ articleId?: string }>();
  const router = useRouter();
  const { user, role } = useAuthStore();

  const isEditing = Boolean(articleId);
  const { data: existingArticle, isLoading: articleLoading } = useArticle(articleId || '');

  const canAuthor =
    role === 'admin' ||
    user?.isVet === true ||
    user?.isVetVerified === true ||
    user?.roles?.includes('admin') ||
    user?.roles?.includes('vet');

  if (!canAuthor) {
    return (
      <Screen scrollable testID="unauthorized-article-screen">
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={2}>Authoring Restricted</Heading>
        </View>

        <Card style={styles.restrictedCard}>
          <View style={styles.restrictedIcon}>
            <ShieldAlert size={48} color={colors.destructive} />
          </View>
          <Heading level={3} align="center" style={{ marginBottom: 8 }}>
            Veterinary Authorization Required
          </Heading>
          <Text variant="bodyMd" color={colors.inkSoft} align="center" style={{ marginBottom: 16 }}>
            Educational pet care articles on Vetopia are clinically reviewed and restricted to licensed veterinarians and verified administrators.
          </Text>
          <Button
            title="Return to Articles Library"
            variant="outline"
            onPress={() => router.back()}
          />
        </Card>
      </Screen>
    );
  }

  if (isEditing && articleLoading) {
    return (
      <Screen scrollable testID="article-create-loading">
        <View style={styles.header}>
          <Skeleton width={140} height={28} />
        </View>
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <Skeleton width="100%" height={160} style={{ borderRadius: radii.md }} />
          <Skeleton width="100%" height={220} style={{ borderRadius: radii.md }} />
        </View>
      </Screen>
    );
  }

  return (
    <ArticleForm
      key={existingArticle?.id || 'new-article'}
      initialArticle={existingArticle}
      articleId={articleId}
      isEditing={isEditing}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
  },
  backBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  headerTitle: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  formCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  categoryScroll: {
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  imagePreviewWrapper: {
    position: 'relative',
    width: '100%',
    height: 180,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentTextArea: {
    minHeight: 180,
    textAlignVertical: 'top',
  },
  statusOptions: {
    gap: spacing.xs,
  },
  statusOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  statusOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  statusOptionText: {
    color: colors.inkSoft,
  },
  statusOptionTextSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  submitSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  restrictedCard: {
    padding: spacing.xl,
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  restrictedIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.pill,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
});
