import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import {
  MoreVertical,
  Trash2,
  Edit2,
  Flag,
  ShieldCheck,
  Check,
  X,
  EyeOff,
  Eye,
} from 'lucide-react-native';
import { ClubComment } from '../../types/club';
import { Avatar } from '../ui/Avatar';
import { Heading } from '../ui/Heading';
import { Text } from '../ui/Text';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { ReportModal } from './ReportModal';
import { useAuthStore } from '../../store/authStore';
import {
  useUpdateComment,
  useDeleteComment,
  useModerateContent,
} from '../../hooks/useClubs';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { radii } from '../../theme/radii';

export interface CommentItemProps {
  comment: ClubComment;
  clubId?: string;
}

export const CommentItem: React.FC<CommentItemProps> = ({ comment, clubId }) => {
  const { user, role } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const updateMutation = useUpdateComment();
  const deleteMutation = useDeleteComment();
  const moderateMutation = useModerateContent();

  const isAuthor = user?.id === comment.user_id;
  const isAdmin = role === 'admin';

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

  const handleSaveEdit = async () => {
    if (!editBody.trim()) {
      Alert.alert('Validation Error', 'Comment cannot be empty.');
      return;
    }

    try {
      await updateMutation.mutateAsync({
        commentId: comment.id,
        input: { body: editBody.trim() },
      });
      setIsEditing(false);
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Could not update comment.');
    }
  };

  const handleDeletePress = () => {
    setMenuVisible(false);
    Alert.alert(
      'Delete Comment',
      'Are you sure you want to delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate({
              commentId: comment.id,
              postId: comment.post_id,
              clubId,
            });
          },
        },
      ],
    );
  };

  const handleModerateToggle = (action: 'hide' | 'restore') => {
    setMenuVisible(false);
    moderateMutation.mutate({
      target_type: 'comment',
      target_id: comment.id,
      action,
    });
  };

  return (
    <View style={styles.container} testID={`comment-item-${comment.id}`}>
      <Avatar
        name={comment.author?.full_name || 'User'}
        source={comment.author?.avatar_url || undefined}
        size={36}
      />

      <View style={styles.contentContainer}>
        {/* Header Row */}
        <View style={styles.headerRow}>
          <View style={styles.authorMeta}>
            <Heading level={4} numberOfLines={1} style={styles.authorName}>
              {comment.author?.full_name || 'Club Member'}
            </Heading>
            {comment.is_vet_verified ? (
              <View style={styles.vetBadge}>
                <ShieldCheck size={12} color="#15803D" />
                <Text variant="caption" color="#15803D" style={styles.vetBadgeText}>
                  Vet
                </Text>
              </View>
            ) : null}
            <Text variant="caption" color={colors.muted} style={styles.timestamp}>
              {formatTimestamp(comment.created_at)}
            </Text>
            {comment.status !== 'approved' ? (
              <Badge variant="pending" label={comment.status.toUpperCase()} />
            ) : null}
          </View>

          <TouchableOpacity
            onPress={() => setMenuVisible(!menuVisible)}
            style={styles.moreBtn}
            accessibilityLabel="Comment options"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={16} color={colors.muted} />
          </TouchableOpacity>
        </View>

        {/* Menu */}
        {menuVisible ? (
          <View style={styles.menu}>
            {isAuthor ? (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMenuVisible(false);
                    setIsEditing(true);
                  }}
                >
                  <Edit2 size={14} color={colors.ink} style={{ marginRight: 6 }} />
                  <Text variant="bodySm">Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={handleDeletePress}>
                  <Trash2 size={14} color={colors.destructive} style={{ marginRight: 6 }} />
                  <Text variant="bodySm" color={colors.destructive}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </>
            ) : null}

            {isAdmin ? (
              <>
                {comment.status === 'approved' ? (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleModerateToggle('hide')}
                  >
                    <EyeOff size={14} color={colors.warning} style={{ marginRight: 6 }} />
                    <Text variant="bodySm" color={colors.warning}>
                      Hide
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => handleModerateToggle('restore')}
                  >
                    <Eye size={14} color={colors.success} style={{ marginRight: 6 }} />
                    <Text variant="bodySm" color={colors.success}>
                      Restore
                    </Text>
                  </TouchableOpacity>
                )}
              </>
            ) : null}

            {!isAuthor ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  setReportModalVisible(true);
                }}
              >
                <Flag size={14} color={colors.destructive} style={{ marginRight: 6 }} />
                <Text variant="bodySm" color={colors.destructive}>
                  Report
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {/* Body or Inline Edit Form */}
        {isEditing ? (
          <View style={styles.editContainer}>
            <Input
              value={editBody}
              onChangeText={setEditBody}
              multiline
              numberOfLines={2}
              style={styles.editInput}
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.editActionBtn}
                onPress={() => {
                  setIsEditing(false);
                  setEditBody(comment.body);
                }}
              >
                <X size={16} color={colors.muted} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editActionBtn, styles.saveActionBtn]}
                onPress={handleSaveEdit}
              >
                <Check size={16} color={colors.ink} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text variant="bodySm" color={colors.ink} style={styles.bodyText}>
            {comment.body}
          </Text>
        )}
      </View>

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetType="comment"
        targetId={comment.id}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  contentContainer: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  authorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  authorName: {
    fontSize: 13,
  },
  vetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radii.pill,
    gap: 2,
  },
  vetBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 11,
  },
  moreBtn: {
    padding: 2,
  },
  bodyText: {
    lineHeight: 18,
    marginTop: 2,
  },
  menu: {
    backgroundColor: colors.white,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xs,
    marginBottom: spacing.xs,
    alignSelf: 'flex-end',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editContainer: {
    marginTop: spacing.xs,
  },
  editInput: {
    marginBottom: spacing.xs,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  editActionBtn: {
    padding: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  saveActionBtn: {
    backgroundColor: colors.primary,
  },
});
