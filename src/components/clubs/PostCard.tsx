import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Heart,
  MessageCircle,
  MoreVertical,
  ShieldCheck,
  Flag,
  Trash2,
  Edit2,
  EyeOff,
  Eye,
} from 'lucide-react-native';
import { ClubPost } from '../../types/club';
import { Card } from '../ui/Card';
import { Avatar } from '../ui/Avatar';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Badge } from '../ui/Badge';
import { ReportModal } from './ReportModal';
import { useAuthStore } from '../../store/authStore';
import {
  useToggleLike,
  useDeletePost,
  useModerateContent,
  useJoinClub,
  useJoinedClubs,
} from '../../hooks/useClubs';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface PostCardProps {
  post: ClubPost;
  clubName?: string;
  isMember?: boolean;
  onEditPress?: (post: ClubPost) => void;
  showCommentAction?: boolean;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  clubName,
  isMember: isMemberProp,
  onEditPress,
  showCommentAction = true,
}) => {
  const router = useRouter();
  const { user, role } = useAuthStore();
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const toggleLikeMutation = useToggleLike();
  const deletePostMutation = useDeletePost();
  const moderateMutation = useModerateContent();
  const joinClubMutation = useJoinClub?.();
  const { data: joinedClubs } = useJoinedClubs?.() || { data: undefined };

  const targetClubId = post.club_id || post.club?.id;
  const displayClubName = clubName || post.club?.name;

  const isMember =
    isMemberProp !== undefined
      ? isMemberProp
      : targetClubId
        ? Boolean(joinedClubs?.some((c) => c.id === targetClubId))
        : true;

  const isAuthor = user?.id === post.author_id;
  const isAdmin = role === 'admin';
  const hasLiked = Boolean(post.user_has_liked);

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const handleClubPress = () => {
    if (targetClubId) {
      router.push(`/clubs/${targetClubId}` as any);
    }
  };

  const promptJoinClub = (actionText: string, onJoined?: () => void) => {
    Alert.alert(
      'Club Membership Required',
      `You must join ${displayClubName || 'this Pet Club'} to ${actionText}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Join Club',
          onPress: () => {
            if (targetClubId && joinClubMutation) {
              if (joinClubMutation.mutateAsync) {
                Promise.resolve(joinClubMutation.mutateAsync(targetClubId))
                  .then(() => onJoined?.())
                  .catch((err: any) => {
                    Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                  });
              } else if (joinClubMutation.mutate) {
                joinClubMutation.mutate(targetClubId, {
                  onSuccess: () => onJoined?.(),
                  onError: (err: any) => {
                    Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                  },
                });
              }
            }
          },
        },
      ],
    );
  };

  const handleLikePress = () => {
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to like club discussions.');
      return;
    }
    if (targetClubId && !isMember) {
      promptJoinClub('like posts', () => {
        toggleLikeMutation.mutate({ postId: post.id, clubId: post.club_id });
      });
      return;
    }
    toggleLikeMutation.mutate({ postId: post.id, clubId: post.club_id });
  };

  const handleCommentPress = () => {
    if (targetClubId && !isMember) {
      Alert.alert(
        'Club Membership Required',
        `You must join ${displayClubName || 'this Pet Club'} to comment on this post.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'View Comments',
            onPress: () => router.push(`/clubs/post/${post.id}` as any),
          },
          {
            text: 'Join Club',
            onPress: () => {
              if (targetClubId && joinClubMutation) {
                if (joinClubMutation.mutateAsync) {
                  Promise.resolve(joinClubMutation.mutateAsync(targetClubId))
                    .then(() => {
                      router.push(`/clubs/post/${post.id}` as any);
                    })
                    .catch((err: any) => {
                      Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                    });
                } else if (joinClubMutation.mutate) {
                  joinClubMutation.mutate(targetClubId, {
                    onSuccess: () => router.push(`/clubs/post/${post.id}` as any),
                    onError: (err: any) => {
                      Alert.alert('Unable to Join', err?.message || 'Could not join club at this time.');
                    },
                  });
                }
              }
            },
          },
        ],
      );
      return;
    }
    router.push(`/clubs/post/${post.id}` as any);
  };

  const handleDeletePress = () => {
    setMenuVisible(false);
    Alert.alert(
      'Delete Post',
      'Are you sure you want to permanently delete this post? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePostMutation.mutate({ postId: post.id, clubId: post.club_id });
          },
        },
      ],
    );
  };

  const handleModerateToggle = (action: 'hide' | 'restore') => {
    setMenuVisible(false);
    moderateMutation.mutate({
      target_type: 'post',
      target_id: post.id,
      action,
    });
  };

  return (
    <Card style={styles.card} testID={`post-card-${post.id}`}>
      {/* Post Header */}
      <View style={styles.header}>
        <Avatar
          name={post.author?.full_name || 'Pet Parent'}
          source={post.author?.avatar_url || undefined}
          size={42}
        />
        <View style={styles.authorMeta}>
          <View style={styles.authorNameRow}>
            <Heading level={4} numberOfLines={1} style={styles.authorName}>
              {post.author?.full_name || 'Pet Parent'}
            </Heading>
            {post.is_vet_verified ? (
              <View style={styles.vetBadge}>
                <ShieldCheck size={14} color="#15803D" />
                <Text variant="caption" color="#15803D" style={styles.vetBadgeText}>
                  Verified Vet
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.timestampRow}>
            <Text variant="caption" color={colors.muted}>
              {formatTimestamp(post.created_at)}
            </Text>
            {displayClubName ? (
              <>
                <View style={styles.metaDot} />
                <TouchableOpacity
                  onPress={handleClubPress}
                  disabled={!targetClubId}
                  accessibilityRole={targetClubId ? 'button' : undefined}
                  accessibilityLabel={`Club: ${displayClubName}`}
                  testID={`club-badge-${post.id}`}
                  style={styles.clubPill}
                >
                  <Text variant="caption" color={colors.primaryDark} style={styles.clubPillText}>
                    {displayClubName}
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}
            {post.status !== 'approved' ? (
              <>
                <View style={styles.metaDot} />
                <Badge
                  variant={post.status === 'hidden' ? 'pending' : 'cancelled'}
                  label={post.status.toUpperCase()}
                />
              </>
            ) : null}
          </View>
        </View>

        {/* Options Button */}
        <TouchableOpacity
          onPress={() => setMenuVisible(!menuVisible)}
          style={styles.moreBtn}
          accessibilityLabel="Post options"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MoreVertical size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu */}
      {menuVisible ? (
        <View style={styles.dropdownMenu}>
          {isAuthor ? (
            <>
              {onEditPress ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    onEditPress(post);
                  }}
                >
                  <Edit2 size={16} color={colors.ink} style={{ marginRight: 8 }} />
                  <Text variant="bodySm">Edit Post</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity style={styles.menuItem} onPress={handleDeletePress}>
                <Trash2 size={16} color={colors.destructive} style={{ marginRight: 8 }} />
                <Text variant="bodySm" color={colors.destructive}>
                  Delete Post
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {/* Admin Moderation Actions */}
          {isAdmin ? (
            <>
              {post.status === 'approved' ? (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleModerateToggle('hide')}
                >
                  <EyeOff size={16} color={colors.warning} style={{ marginRight: 8 }} />
                  <Text variant="bodySm" color={colors.warning}>
                    Moderate: Hide Post
                  </Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => handleModerateToggle('restore')}
                >
                  <Eye size={16} color={colors.success} style={{ marginRight: 8 }} />
                  <Text variant="bodySm" color={colors.success}>
                    Moderate: Restore Post
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}

          {/* Report Action */}
          {!isAuthor ? (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                setReportModalVisible(true);
              }}
            >
              <Flag size={16} color={colors.destructive} style={{ marginRight: 8 }} />
              <Text variant="bodySm" color={colors.destructive}>
                Report Content
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {/* Post Text Content */}
      <Text variant="bodyMd" color={colors.ink} style={styles.content}>
        {post.content || post.caption}
      </Text>

      {/* Post Media Attachment */}
      {post.image_url ? (
        <View style={styles.mediaContainer}>
          <Image
            source={{ uri: post.image_url }}
            style={styles.mediaImage}
            resizeMode="cover"
          />
        </View>
      ) : null}

      {/* Post Footer Actions */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.actionBtn, hasLiked && styles.actionBtnActive]}
          onPress={handleLikePress}
          activeOpacity={0.7}
          accessibilityLabel={`${hasLiked ? 'Unlike' : 'Like'} post. ${post.likes_count} likes.`}
          accessibilityRole="button"
          testID={`like-button-${post.id}`}
        >
          <Heart
            size={18}
            color={hasLiked ? colors.destructive : colors.muted}
            fill={hasLiked ? colors.destructive : 'transparent'}
          />
          <Text
            variant="bodySm"
            color={hasLiked ? colors.destructive : colors.inkSoft}
            style={styles.actionCount}
          >
            {post.likes_count}
          </Text>
        </TouchableOpacity>

        {showCommentAction ? (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleCommentPress}
            activeOpacity={0.7}
            accessibilityLabel={`View comments. ${post.comments_count} comments.`}
            accessibilityRole="button"
            testID={`comment-button-${post.id}`}
          >
            <MessageCircle size={18} color={colors.muted} />
            <Text variant="bodySm" color={colors.inkSoft} style={styles.actionCount}>
              {post.comments_count}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Report Modal */}
      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetType="post"
        targetId={post.id}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    position: 'relative',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  authorMeta: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  authorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  authorName: {
    marginRight: 4,
  },
  vetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.pill,
    gap: 3,
  },
  vetBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.muted,
    marginHorizontal: 6,
  },
  moreBtn: {
    padding: spacing.xs,
  },
  dropdownMenu: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    marginBottom: spacing.sm,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
  },
  content: {
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  mediaContainer: {
    width: '100%',
    height: 220,
    borderRadius: radii.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    gap: spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.pill,
  },
  actionBtnActive: {
    backgroundColor: '#FEE2E2',
  },
  actionCount: {
    marginLeft: 6,
    fontWeight: '600',
  },
  clubPill: {
    backgroundColor: '#F0FDF4',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: '#DCFCE7',
  },
  clubPillText: {
    fontWeight: '600',
    fontSize: 11,
  },
});
