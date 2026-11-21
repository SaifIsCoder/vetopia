import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { Screen } from '../../../src/components/layout/Screen';
import { Heading } from '../../../src/components/ui/Heading';
import { Text } from '../../../src/components/ui/Text';
import { Button } from '../../../src/components/ui/Button';
import { Input } from '../../../src/components/ui/Input';
import { Skeleton } from '../../../src/components/ui/Skeleton';
import { Card } from '../../../src/components/ui/Card';
import { EmptyState } from '../../../src/components/feedback/EmptyState';
import { ErrorState } from '../../../src/components/feedback/ErrorState';
import { PostCard } from '../../../src/components/clubs/PostCard';
import { CommentItem } from '../../../src/components/clubs/CommentItem';
import {
  usePost,
  useComments,
  useCreateComment,
  useClub,
  useJoinClub,
} from '../../../src/hooks/useClubs';
import { useAuthStore } from '../../../src/store/authStore';
import { colors } from '../../../src/theme/colors';
import { spacing } from '../../../src/theme/spacing';
import { radii } from '../../../src/theme/radii';

export default function PostDetailScreen() {
  const { id: postId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [commentText, setCommentText] = useState('');

  const {
    data: post,
    isLoading: postLoading,
    isError: postError,
    error: postErrorObj,
    refetch: refetchPost,
    isRefetching: postRefetching,
  } = usePost(postId);

  const {
    data: comments = [],
    isLoading: commentsLoading,
    refetch: refetchComments,
    isRefetching: commentsRefetching,
  } = useComments(postId);

  const { data: club } = useClub(post?.club_id || '');

  const createCommentMutation = useCreateComment();
  const joinClubMutation = useJoinClub();

  const handleSendComment = async () => {
    if (!commentText.trim()) return;

    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to join the conversation.');
      return;
    }

    if (club && !club.is_member) {
      Alert.alert(
        'Club Membership Required',
        `You must join ${club.name} before commenting.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Join Club',
            onPress: () => {
              if (joinClubMutation.mutateAsync) {
                joinClubMutation.mutateAsync(club.id).catch((err: any) => {
                  Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                });
              } else if (joinClubMutation.mutate) {
                joinClubMutation.mutate(club.id, {
                  onError: (err: any) => {
                    Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                  },
                });
              }
            },
          },
        ],
      );
      return;
    }

    try {
      await createCommentMutation.mutateAsync({
        post_id: postId,
        body: commentText.trim(),
        club_id: post?.club_id || undefined,
      });
      setCommentText('');
    } catch (err: any) {
      if (err?.message?.includes('Must be a member') || err?.message?.includes('violates row-level security')) {
        Alert.alert(
          'Club Membership Required',
          `You must join ${club?.name || 'this Pet Club'} before commenting.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Join Club',
              onPress: () => {
                if (club?.id && joinClubMutation) {
                  if (joinClubMutation.mutateAsync) {
                    joinClubMutation.mutateAsync(club.id).catch((e: any) => {
                      Alert.alert('Unable to Join', e?.message || 'Could not join club.');
                    });
                  } else if (joinClubMutation.mutate) {
                    joinClubMutation.mutate(club.id);
                  }
                }
              },
            },
          ],
        );
      } else {
        Alert.alert('Comment Failed', err?.message || 'Unable to post comment.');
      }
    }
  };

  const handleRefresh = async () => {
    await Promise.all([refetchPost(), refetchComments()]);
  };

  if (postLoading) {
    return (
      <Screen scrollable>
        <Card style={{ padding: spacing.md }}>
          <Skeleton width="50%" height={20} />
          <Skeleton width="100%" height={100} style={{ marginTop: spacing.md }} />
        </Card>
      </Screen>
    );
  }

  if (postError || !post) {
    return (
      <Screen>
        <ErrorState
          title="Post Not Found"
          message={postErrorObj?.message || 'The post could not be retrieved or has been removed.'}
          onRetry={refetchPost}
        />
      </Screen>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <Screen
        scrollable
        scrollViewProps={{
          refreshControl: (
            <RefreshControl
              refreshing={postRefetching || commentsRefetching}
              onRefresh={handleRefresh}
              tintColor={colors.primaryDark}
              colors={[colors.primaryDark]}
            />
          ),
        }}
      >
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.navBtn}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <ArrowLeft size={20} color={colors.ink} />
          </TouchableOpacity>
          <Heading level={3} numberOfLines={1} style={styles.navTitle}>
            Discussion
          </Heading>
        </View>

        {/* Post Card */}
        <PostCard
          post={post}
          clubName={club?.name}
          isMember={club ? club.is_member : true}
          showCommentAction={false}
        />

        {/* Comments Section */}
        <View style={styles.commentsSection}>
          <View style={styles.commentsHeader}>
            <Heading level={3}>
              Comments ({comments.length})
            </Heading>
          </View>

          {commentsLoading ? (
            <View style={{ gap: spacing.sm }}>
              {[1, 2].map((k) => (
                <Skeleton key={k} width="100%" height={50} style={{ borderRadius: radii.md }} />
              ))}
            </View>
          ) : comments.length === 0 ? (
            <EmptyState
              title="No Comments Yet"
              description="Be the first to share your thoughts, advice, or support on this discussion."
            />
          ) : (
            comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                clubId={post.club_id || undefined}
              />
            ))
          )}
        </View>
      </Screen>

      {/* Bottom Comment Input Bar or Join Action Bar */}
      {club && !club.is_member ? (
        <View style={styles.joinPromptBar} testID="join-club-comment-bar">
          <View style={styles.joinPromptTextContainer}>
            <Text variant="bodySm" color={colors.ink} style={styles.joinPromptTitle}>
              Join {club.name}
            </Text>
            <Text variant="caption" color={colors.muted}>
              You must join this club to comment and like posts.
            </Text>
          </View>
          <Button
            title="Join Club"
            variant="primary"
            size="sm"
            loading={joinClubMutation.isPending}
            onPress={() => {
              if (joinClubMutation.mutateAsync) {
                joinClubMutation.mutateAsync(club.id).catch((err: any) => {
                  Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                });
              } else if (joinClubMutation.mutate) {
                joinClubMutation.mutate(club.id, {
                  onError: (err: any) => {
                    Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                  },
                });
              }
            }}
            testID="btn-join-club-comment"
          />
        </View>
      ) : (
        <View style={styles.inputBar}>
          <Input
            placeholder="Write a supportive comment..."
            value={commentText}
            onChangeText={setCommentText}
            containerStyle={styles.textInput}
            testID="input-comment-body"
          />
          <Button
            title=""
            variant="primary"
            onPress={handleSendComment}
            loading={createCommentMutation.isPending}
            disabled={!commentText.trim() || createCommentMutation.isPending}
            leftIcon={<Send size={18} color={colors.ink} />}
            style={styles.sendBtn}
            testID="btn-send-comment"
            accessibilityLabel="Post comment"
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  navBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  navTitle: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  commentsSection: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  commentsHeader: {
    marginBottom: spacing.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    marginBottom: 0,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    paddingHorizontal: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinPromptBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  joinPromptTextContainer: {
    flex: 1,
  },
  joinPromptTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
});
