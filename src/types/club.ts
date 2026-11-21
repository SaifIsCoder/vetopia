/**
 * Pet Clubs Type Definitions
 * Covers Clubs, Memberships, Posts, Comments, Moderation & Reporting
 */

export type ClubCategory =
  | 'Dogs'
  | 'Cats'
  | 'Birds'
  | 'Horses'
  | 'Farm Animals'
  | 'Poultry'
  | string;

export interface Club {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: ClubCategory;
  cover_image: string | null;
  icon_name: string | null;
  member_count: number;
  post_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  is_member?: boolean;
}

export interface ClubMembership {
  id: string;
  club_id: string;
  user_id: string;
  role: 'member' | 'moderator' | 'admin';
  created_at: string;
}

export interface ClubAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

/**
 * Lightweight club reference attached to posts surfaced in the global community
 * feed (see `get_community_feed` RPC). Null/absent for general (clubless) posts.
 */
export interface ClubReference {
  id: string;
  name: string;
  slug: string;
}

export interface ClubPost {
  id: string;
  club_id: string | null;
  author_id: string;
  content: string;
  caption?: string;
  image_url: string | null;
  status: 'approved' | 'hidden' | 'removed' | 'flagged';
  likes_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
  author?: ClubAuthor;
  /** Present when the post is surfaced via the global community feed. */
  club?: ClubReference | null;
  is_vet_verified?: boolean;
  user_has_liked?: boolean;
}

export interface ClubComment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  status: 'approved' | 'hidden' | 'removed' | 'flagged';
  created_at: string;
  updated_at?: string;
  author?: ClubAuthor;
  is_vet_verified?: boolean;
}

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'misinformation'
  | 'other';

export interface ContentReport {
  id: string;
  reporter_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  reason: ReportReason;
  details: string | null;
  status: 'pending' | 'reviewed' | 'dismissed' | 'actioned';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface CreatePostInput {
  /**
   * Optional: when omitted (or null) the post is a general community post that
   * appears only in the global feed. When provided, the post is associated with
   * a club and appears in both that club's feed and the global community feed.
   */
  club_id?: string | null;
  content: string;
  image_url?: string | null;
}

export interface UpdatePostInput {
  content: string;
  image_url?: string | null;
}

export interface CreateCommentInput {
  post_id: string;
  body: string;
  club_id?: string;
}

export interface UpdateCommentInput {
  body: string;
}

export interface CreateReportInput {
  target_type: 'post' | 'comment';
  target_id: string;
  reason: ReportReason;
  details?: string;
}

export interface ModerationActionInput {
  target_type: 'post' | 'comment';
  target_id: string;
  action: 'hide' | 'remove' | 'restore';
  notes?: string;
}

export interface ClubFeedResponse {
  posts: ClubPost[];
  hasMore: boolean;
  nextCursor?: string;
}
