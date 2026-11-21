import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft,
  Image as ImageIcon,
  Camera,
  X,
  Send,
  AlertCircle,
} from 'lucide-react-native';
import { Screen } from '../../../src/components/layout/Screen';
import { Heading } from '../../../src/components/ui/Heading';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Card } from '../../../src/components/ui/Card';
import { useClub, useCreatePost, useUpdatePost } from '../../../src/hooks/useClubs';
import { clubPhotoService } from '../../../src/lib/clubs/clubPhotoService';
import { useAuthStore } from '../../../src/store/authStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { radii } from '../../../src/theme/radii';

export default function CreateEditPostScreen() {
  const { id: clubId, postId, initialContent, initialImage } = useLocalSearchParams<{
    id: string;
    postId?: string;
    initialContent?: string;
    initialImage?: string;
  }>();

  const router = useRouter();
  const { user } = useAuthStore();
  const { data: club } = useClub(clubId);

  const isEditing = Boolean(postId);

  const [content, setContent] = useState(initialContent || '');
  const [imageUri, setImageUri] = useState<string | null>(initialImage || null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createPostMutation = useCreatePost();
  const updatePostMutation = useUpdatePost();

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
    if (!content.trim()) {
      setErrorMsg('Please write some content for your post.');
      return;
    }

    if (content.trim().length > 5000) {
      setErrorMsg('Post content cannot exceed 5000 characters.');
      return;
    }

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to publish your post.');
      return;
    }

    setErrorMsg(null);
    setIsUploading(true);

    try {
      let finalImageUrl = imageUri;

      // If new local image was selected (e.g. starts with file:// or ph:// or blob:), upload to storage
      if (imageUri && (imageUri.startsWith('file:') || imageUri.startsWith('content:') || imageUri.startsWith('blob:'))) {
        finalImageUrl = await clubPhotoService.uploadPostImage(
          imageUri,
          user.id,
          (pct) => setUploadPercent(pct),
        );
      }

      if (isEditing && postId) {
        await updatePostMutation.mutateAsync({
          postId,
          input: {
            content: content.trim(),
            image_url: finalImageUrl,
          },
        });
        Alert.alert('Post Updated', 'Your post has been successfully updated.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        await createPostMutation.mutateAsync({
          club_id: clubId,
          content: content.trim(),
          image_url: finalImageUrl,
        });
        Alert.alert('Post Published', 'Your post has been published to the club.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to publish post. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadPercent(0);
    }
  };

  const isSubmitting = isUploading || createPostMutation.isPending || updatePostMutation.isPending;

  return (
    <Screen scrollable>
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
          <Heading level={3}>
            {isEditing ? 'Edit Post' : `Post in ${club?.name || 'Club'}`}
          </Heading>
          <Text variant="caption" color={colors.muted}>
            Share tips, questions or pet updates
          </Text>
        </View>

        <Button
          title={isEditing ? 'Save' : 'Publish'}
          variant="primary"
          size="sm"
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !content.trim()}
          rightIcon={<Send size={14} color={colors.ink} />}
          style={styles.publishBtn}
          testID="btn-submit-post"
        />
      </View>

      {/* Error Banner */}
      {errorMsg ? (
        <View style={styles.errorBanner}>
          <AlertCircle size={16} color={colors.destructive} />
          <Text variant="bodySm" color={colors.destructive} style={styles.errorText}>
            {errorMsg}
          </Text>
        </View>
      ) : null}

      {/* Editor Card */}
      <Card style={styles.editorCard}>
        <Input
          placeholder="What would you like to discuss with the club? Share your question, experience, or pet photo..."
          value={content}
          onChangeText={setContent}
          multiline
          numberOfLines={8}
          style={styles.contentInput}
          editable={!isSubmitting}
          testID="input-post-content"
        />

        {/* Upload Progress Bar */}
        {isUploading && uploadPercent > 0 ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${uploadPercent}%` }]} />
            </View>
            <Text variant="caption" color={colors.muted} style={{ marginTop: 4 }}>
              Uploading image... {uploadPercent}%
            </Text>
          </View>
        ) : null}

        {/* Attached Image Preview */}
        {imageUri ? (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            <TouchableOpacity
              onPress={handleRemoveImage}
              style={styles.removeImageBtn}
              accessibilityLabel="Remove attached image"
              disabled={isSubmitting}
            >
              <X size={16} color={colors.white} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Media Attachment Toolbar */}
        <View style={styles.toolbar}>
          <Text variant="caption" color={colors.muted}>
            Attach Photo:
          </Text>
          <View style={styles.toolbarActions}>
            <TouchableOpacity
              onPress={handlePickLibrary}
              style={styles.toolbarBtn}
              disabled={isSubmitting}
              accessibilityLabel="Choose from library"
            >
              <ImageIcon size={18} color={colors.ink} style={{ marginRight: 6 }} />
              <Text variant="bodySm" color={colors.ink}>
                Library
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTakePhoto}
              style={styles.toolbarBtn}
              disabled={isSubmitting}
              accessibilityLabel="Take a photo"
            >
              <Camera size={18} color={colors.ink} style={{ marginRight: 6 }} />
              <Text variant="bodySm" color={colors.ink}>
                Camera
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Card>

      {/* Community Guidelines Notice */}
      <Card style={styles.guidelinesCard}>
        <Heading level={4} style={{ marginBottom: 4 }}>
          Community Guidelines
        </Heading>
        <Text variant="caption" color={colors.muted} style={{ lineHeight: 16 }}>
          Vetopia clubs are safe, supportive spaces. Please be respectful, avoid medical misinformation, and consult licensed veterinarians for urgent diagnosis or emergencies.
        </Text>
      </Card>
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
  headerTitle: {
    flex: 1,
  },
  publishBtn: {
    minWidth: 84,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: radii.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    flex: 1,
  },
  editorCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  contentInput: {
    minHeight: 160,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22,
    borderWidth: 0,
    backgroundColor: 'transparent',
    padding: 0,
    marginBottom: spacing.md,
  },
  progressContainer: {
    marginBottom: spacing.md,
  },
  progressBar: {
    height: 6,
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primaryDark,
  },
  imagePreviewContainer: {
    position: 'relative',
    height: 200,
    width: '100%',
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  toolbarActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
  },
  guidelinesCard: {
    backgroundColor: '#F7FEE7',
    borderColor: '#D9F99D',
    borderWidth: 1,
    padding: spacing.md,
  },
});
