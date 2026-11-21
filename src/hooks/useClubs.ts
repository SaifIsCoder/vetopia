/**
 * React Query Hooks for Pet Clubs
 * Provides cached data fetching, optimistic mutation updates, and error states.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clubService } from '../lib/clubs/clubService';
import {
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  UpdateCommentInput,
  CreateReportInput,
  ModerationActionInput,
  ClubPost,
} from '../types/club';

export const CLUB_QUERY_KEYS = {
  allClubs: (search?: string, category?: string) =>
    ['clubs', search || 'all', category || 'all'] as const,
  clubDetails: (id: string) => ['club', id] as const,
  joinedClubs: ['joined-clubs'] as const,
  feed: (clubId: string) => ['club-feed', clubId] as const,
  communityFeed: ['community-feed'] as const,
  post: (postId: string) => ['club-post', postId] as const,
  comments: (postId: string) => ['club-comments', postId] as const,
};

/**
 * Hook to retrieve all Pet Clubs (optionally filtered by search and category)
 */
export function useClubs(searchQuery?: string, category?: string) {
  return useQuery({
    queryKey: CLUB_QUERY_KEYS.allClubs(searchQuery, category),
    queryFn: () => clubService.getClubs(searchQuery, category),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to retrieve a single Pet Club by ID or slug
 */
export function useClub(clubIdOrSlug: string) {
  return useQuery({
    queryKey: CLUB_QUERY_KEYS.clubDetails(clubIdOrSlug),
    queryFn: () => clubService.getClubById(clubIdOrSlug),
    enabled: Boolean(clubIdOrSlug),
  });
}

/**
 * Hook to retrieve clubs the current user has joined
 */
export function useJoinedClubs() {
  return useQuery({
    queryKey: CLUB_QUERY_KEYS.joinedClubs,
    queryFn: () => clubService.getJoinedClubs(),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to join a Pet Club with optimistic UI update
 */
export function useJoinClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => clubService.joinClub(clubId),
    onMutate: async (clubId: string) => {
      await queryClient.cancelQueries({ queryKey: ['clubs'] });
      await queryClient.cancelQueries({ queryKey: CLUB_QUERY_KEYS.clubDetails(clubId) });

      const prevClub = queryClient.getQueryData<any>(CLUB_QUERY_KEYS.clubDetails(clubId));

      if (prevClub) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.clubDetails(clubId), {
          ...prevClub,
          is_member: true,
          member_count: prevClub.member_count + 1,
        });
      }

      queryClient.setQueriesData<any[]>({ queryKey: ['clubs'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((c) =>
          c.id === clubId ? { ...c, is_member: true, member_count: c.member_count + 1 } : c,
        );
      });

      return { prevClub, clubId };
    },
    onError: (_, __, context) => {
      if (context?.prevClub) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.clubDetails(context.clubId), context.prevClub);
      }
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
    onSettled: (_, __, clubId) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.clubDetails(clubId) });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.joinedClubs });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(clubId) });
    },
  });
}

/**
 * Hook to leave a Pet Club with optimistic UI update
 */
export function useLeaveClub() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clubId: string) => clubService.leaveClub(clubId),
    onMutate: async (clubId: string) => {
      await queryClient.cancelQueries({ queryKey: ['clubs'] });
      await queryClient.cancelQueries({ queryKey: CLUB_QUERY_KEYS.clubDetails(clubId) });

      const prevClub = queryClient.getQueryData<any>(CLUB_QUERY_KEYS.clubDetails(clubId));

      if (prevClub) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.clubDetails(clubId), {
          ...prevClub,
          is_member: false,
          member_count: Math.max(0, prevClub.member_count - 1),
        });
      }

      queryClient.setQueriesData<any[]>({ queryKey: ['clubs'] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.map((c) =>
          c.id === clubId
            ? { ...c, is_member: false, member_count: Math.max(0, c.member_count - 1) }
            : c,
        );
      });

      return { prevClub, clubId };
    },
    onError: (_, __, context) => {
      if (context?.prevClub) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.clubDetails(context.clubId), context.prevClub);
      }
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
    onSettled: (_, __, clubId) => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.clubDetails(clubId) });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.joinedClubs });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(clubId) });
    },
  });
}

/**
 * Hook to retrieve feed posts for a club
 */
export function useClubFeed(clubId: string, limit = 20) {
  return useQuery({
    queryKey: CLUB_QUERY_KEYS.feed(clubId),
    queryFn: () => clubService.getClubFeed(clubId, limit),
    enabled: Boolean(clubId),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to retrieve global community feed posts across all clubs and general discussions
 */
export function useCommunityFeed(limit = 20) {
  return useQuery({
    queryKey: CLUB_QUERY_KEYS.communityFeed,
    queryFn: () => clubService.getCommunityFeed(limit),
    staleTime: 1000 * 30, // 30 seconds
  });
}

/**
 * Hook to retrieve a single post by ID
 */
export function usePost(postId: string) {
  return useQuery({
    queryKey: CLUB_QUERY_KEYS.post(postId),
    queryFn: () => clubService.getPostById(postId),
    enabled: Boolean(postId),
  });
}

/**
 * Hook to publish a new post (general or club-associated)
 */
export function useCreatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => clubService.createPost(input),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });
      if (post.club_id) {
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(post.club_id) });
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.clubDetails(post.club_id) });
      }
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

/**
 * Hook to update an existing post
 */
export function useUpdatePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, input }: { postId: string; input: UpdatePostInput }) =>
      clubService.updatePost(postId, input),
    onSuccess: (post) => {
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.post(post.id) });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });
      if (post.club_id) {
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(post.club_id) });
      }
    },
  });
}

/**
 * Hook to delete a post
 */
export function useDeletePost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, clubId }: { postId: string; clubId?: string | null }) =>
      clubService.deletePost(postId),
    onSuccess: (_, { clubId }) => {
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });
      if (clubId) {
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(clubId) });
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.clubDetails(clubId) });
      }
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
    },
  });
}

/**
 * Hook to toggle like with optimistic UI update across club and community feeds
 */
export function useToggleLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId }: { postId: string; clubId?: string | null }) =>
      clubService.toggleLike(postId),
    onMutate: async ({ postId, clubId }) => {
      if (clubId) {
        await queryClient.cancelQueries({ queryKey: CLUB_QUERY_KEYS.feed(clubId) });
      }
      await queryClient.cancelQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });

      const prevClubFeed = clubId
        ? queryClient.getQueryData<{ posts: ClubPost[]; hasMore: boolean }>(
            CLUB_QUERY_KEYS.feed(clubId),
          )
        : undefined;

      const prevCommunityFeed = queryClient.getQueryData<{ posts: ClubPost[]; hasMore: boolean }>(
        CLUB_QUERY_KEYS.communityFeed,
      );

      const updatePostInList = (post: ClubPost) => {
        if (post.id === postId) {
          const userHasLiked = !post.user_has_liked;
          const likesCount = userHasLiked
            ? post.likes_count + 1
            : Math.max(0, post.likes_count - 1);
          return { ...post, user_has_liked: userHasLiked, likes_count: likesCount };
        }
        return post;
      };

      if (prevClubFeed && clubId) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.feed(clubId), {
          ...prevClubFeed,
          posts: prevClubFeed.posts.map(updatePostInList),
        });
      }

      if (prevCommunityFeed) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.communityFeed, {
          ...prevCommunityFeed,
          posts: prevCommunityFeed.posts.map(updatePostInList),
        });
      }

      return { prevClubFeed, prevCommunityFeed, clubId };
    },
    onError: (_, __, context) => {
      if (context?.prevClubFeed && context.clubId) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.feed(context.clubId), context.prevClubFeed);
      }
      if (context?.prevCommunityFeed) {
        queryClient.setQueryData(CLUB_QUERY_KEYS.communityFeed, context.prevCommunityFeed);
      }
    },
    onSettled: (_, __, { postId, clubId }) => {
      if (clubId) {
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(clubId) });
      }
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.post(postId) });
    },
  });
}

/**
 * Hook to retrieve comments for a post
 */
export function useComments(postId: string) {
  return useQuery({
    queryKey: CLUB_QUERY_KEYS.comments(postId),
    queryFn: () => clubService.getComments(postId),
    enabled: Boolean(postId),
  });
}

/**
 * Hook to add a comment
 */
export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCommentInput) => clubService.createComment(input),
    onSuccess: (comment, variables) => {
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.comments(variables.post_id) });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.post(variables.post_id) });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });
      if (variables.club_id) {
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(variables.club_id) });
      }
    },
  });
}

/**
 * Hook to update a comment
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ commentId, input }: { commentId: string; input: UpdateCommentInput }) =>
      clubService.updateComment(commentId, input),
    onSuccess: (comment) => {
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.comments(comment.post_id) });
    },
  });
}

/**
 * Hook to delete a comment
 */
export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      commentId,
      postId,
      clubId,
    }: {
      commentId: string;
      postId: string;
      clubId?: string;
    }) => clubService.deleteComment(commentId),
    onSuccess: (_, { postId, clubId }) => {
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.comments(postId) });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.post(postId) });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });
      if (clubId) {
        queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.feed(clubId) });
      }
    },
  });
}

/**
 * Hook to report inappropriate content
 */
export function useReportContent() {
  return useMutation({
    mutationFn: (input: CreateReportInput) => clubService.reportContent(input),
  });
}

/**
 * Hook for administrator moderation actions
 */
export function useModerateContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ModerationActionInput) => clubService.moderateContent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-feed'] });
      queryClient.invalidateQueries({ queryKey: CLUB_QUERY_KEYS.communityFeed });
      queryClient.invalidateQueries({ queryKey: ['club-comments'] });
      queryClient.invalidateQueries({ queryKey: ['club-post'] });
    },
  });
}
