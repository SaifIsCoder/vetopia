import { clubService } from '../../src/lib/clubs/clubService';
import { clubPhotoService } from '../../src/lib/clubs/clubPhotoService';
import { supabase } from '../../src/lib/supabase/client';
import {
  AuthError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from '../../src/lib/api/errors';

// Mock Supabase Client
jest.mock('../../src/lib/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getSession: jest.fn(),
      },
      from: jest.fn(),
      rpc: jest.fn(),
      storage: {
        from: jest.fn(),
      },
    },
  };
});

describe('ClubService — Comprehensive Unit & Security Tests', () => {
  const mockUser = { id: 'user-parent-123', email: 'parent@example.com' };
  const mockAdmin = { id: 'admin-456', email: 'admin@vetopia.com' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Club Discovery & Listing', () => {
    test('getClubs returns active clubs with is_member flag for logged in user', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const mockClubsData = [
        { id: 'club-1', slug: 'dogs', name: 'Dogs Club', member_count: 42, is_active: true },
        { id: 'club-2', slug: 'cats', name: 'Cats Club', member_count: 35, is_active: true },
      ];

      const mockMembershipsData = [{ club_id: 'club-1' }];

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockClubsData, error: null }),
        or: jest.fn().mockReturnThis(),
      };

      const membershipsBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: mockMembershipsData, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'clubs') return queryBuilder;
        if (table === 'club_memberships') return membershipsBuilder;
        return queryBuilder;
      });

      const clubs = await clubService.getClubs();
      expect(clubs).toHaveLength(2);
      expect(clubs[0].id).toBe('club-1');
      expect(clubs[0].is_member).toBe(true);
      expect(clubs[1].is_member).toBe(false);
    });

    test('getClubs applies search filter correctly', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({
          data: [{ id: 'club-1', slug: 'dogs', name: 'Dogs Club', is_active: true }],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const clubs = await clubService.getClubs('dog');
      expect(queryBuilder.or).toHaveBeenCalled();
      expect(clubs).toHaveLength(1);
      expect(clubs[0].is_member).toBe(false);
    });

    test('getClubs applies category filter correctly', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockResolvedValue({
          data: [
            { id: 'club-1', slug: 'dogs', name: 'Dogs Club', category: 'Dogs', is_active: true },
          ],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const clubs = await clubService.getClubs(undefined, 'Dogs');
      expect(queryBuilder.ilike).toHaveBeenCalledWith('category', '%Dogs%');
      expect(clubs).toHaveLength(1);
      expect(clubs[0].category).toBe('Dogs');
    });

    test('getClubs handles offline network failure with filtered seed clubs fallback', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Failed to fetch (Network connection lost)' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const fallbackClubs = await clubService.getClubs(undefined, 'Cats');
      expect(fallbackClubs).toHaveLength(1);
      expect(fallbackClubs[0].slug).toBe('cats');
      expect(fallbackClubs[0].category).toBe('Cats');
    });

    test('getClubById returns seed fallback on offline network failure', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Network request failed' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const club = await clubService.getClubById('dogs');
      expect(club.slug).toBe('dogs');
      expect(club.name).toBe('Dogs Club');
    });

    test('getClubById returns club details or throws NotFoundError if non-existent', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      await expect(clubService.getClubById('non-existent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('2. Club Membership Authorization (Join & Leave)', () => {
    test('joinClub throws AuthError if unauthenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(clubService.joinClub('club-1')).rejects.toThrow(AuthError);
    });

    test('joinClub succeeds idempotently via RPC', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true, club_id: 'club-1' },
        error: null,
      });

      const result = await clubService.joinClub('club-1');
      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('join_club', { p_club_id: 'club-1' });
    });

    test('leaveClub successfully removes membership', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await clubService.leaveClub('club-1');
      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('leave_club', { p_club_id: 'club-1' });
    });
  });

  describe('3. Post Creation, Validation & Membership Enforcement', () => {
    test('createPost throws ValidationError if content is empty', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      await expect(
        clubService.createPost({ club_id: 'club-1', content: '' }),
      ).rejects.toThrow(ValidationError);
    });

    test('createPost throws ValidationError if content exceeds 5000 characters', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const oversizedContent = 'a'.repeat(5001);
      await expect(
        clubService.createPost({ club_id: 'club-1', content: oversizedContent }),
      ).rejects.toThrow(ValidationError);
    });

    test('createPost throws ForbiddenError if author is not a club member', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      // Mock membership lookup returning null
      const membershipBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(membershipBuilder);

      await expect(
        clubService.createPost({ club_id: 'club-1', content: 'Hello club members!' }),
      ).rejects.toThrow(ForbiddenError);
    });

    test('createPost creates post successfully when user is a member', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const membershipBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'mem-1' }, error: null }),
      };

      const postInsertBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'post-1',
            club_id: 'club-1',
            author_id: mockUser.id,
            content: 'Great puppy training advice!',
            caption: 'Great puppy training advice!',
            image_url: null,
            status: 'approved',
            likes_count: 0,
            comments_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'club_memberships') return membershipBuilder;
        if (table === 'posts') return postInsertBuilder;
        return membershipBuilder;
      });

      const post = await clubService.createPost({
        club_id: 'club-1',
        content: 'Great puppy training advice!',
      });

      expect(post.id).toBe('post-1');
      expect(post.content).toBe('Great puppy training advice!');
      expect(post.author_id).toBe(mockUser.id);
    });
  });

  describe('4. Post Edit & Delete Ownership', () => {
    test('updatePost updates post content for authorized author', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'post-1',
            club_id: 'club-1',
            author_id: mockUser.id,
            content: 'Updated post content',
            status: 'approved',
            likes_count: 0,
            comments_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(updateBuilder);

      const updated = await clubService.updatePost('post-1', { content: 'Updated post content' });
      expect(updated.content).toBe('Updated post content');
    });

    test('deletePost deletes post for author', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const deleteBuilder = {
        delete: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(deleteBuilder);

      const result = await clubService.deletePost('post-1');
      expect(result).toBe(true);
    });
  });

  describe('5. Like & Unlike Concurrency & Counter Handling', () => {
    test('toggleLike returns liked true and updated counter via RPC', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { post_id: 'post-1', liked: true, likes_count: 5 },
        error: null,
      });

      const result = await clubService.toggleLike('post-1');
      expect(result.liked).toBe(true);
      expect(result.likes_count).toBe(5);
    });

    test('toggleLike throws AuthError if unauthenticated', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(clubService.toggleLike('post-1')).rejects.toThrow(AuthError);
    });
  });

  describe('6. Comments Validation & Authorization', () => {
    test('createComment validates empty text and maximum 1000 characters', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      await expect(
        clubService.createComment({ post_id: 'post-1', body: '' }),
      ).rejects.toThrow(ValidationError);

      const longComment = 'b'.repeat(1001);
      await expect(
        clubService.createComment({ post_id: 'post-1', body: longComment }),
      ).rejects.toThrow(ValidationError);
    });

    test('createComment throws ForbiddenError if user is not a club member', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const postBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'post-1', club_id: 'club-1', author_id: 'author-999' },
          error: null,
        }),
      };

      const membershipBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'posts') return postBuilder;
        if (table === 'club_memberships') return membershipBuilder;
        return postBuilder;
      });

      await expect(
        clubService.createComment({ post_id: 'post-1', body: 'Nice photo!' }),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('7. Content Reporting & Moderation', () => {
    test('reportContent validates reason and creates report', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const reportBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'rep-1',
            reporter_id: mockUser.id,
            target_type: 'post',
            target_id: 'post-1',
            reason: 'spam',
            status: 'pending',
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(reportBuilder);

      const report = await clubService.reportContent({
        target_type: 'post',
        target_id: 'post-1',
        reason: 'spam',
        details: 'Repetitive advertising links',
      });

      expect(report.id).toBe('rep-1');
      expect(report.reason).toBe('spam');
    });

    test('reportContent throws ValidationError for duplicate active report (23505)', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const reportBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(reportBuilder);

      await expect(
        clubService.reportContent({
          target_type: 'post',
          target_id: 'post-1',
          reason: 'spam',
        }),
      ).rejects.toThrow(ValidationError);
    });

    test('moderateContent succeeds via RPC for administrators', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockAdmin } },
      });

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: { success: true, target_id: 'post-1', action: 'hide', new_status: 'hidden' },
        error: null,
      });

      const result = await clubService.moderateContent({
        target_type: 'post',
        target_id: 'post-1',
        action: 'hide',
      });

      expect(result).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith('moderate_content', {
        p_target_type: 'post',
        p_target_id: 'post-1',
        p_action: 'hide',
        p_notes: null,
      });
    });
  });

  describe('8. Photo Upload Service Validation & Storage Path Security', () => {
    test('uploadPostImage throws ValidationError when URI is missing', async () => {
      await expect(
        clubPhotoService.uploadPostImage('', mockUser.id),
      ).rejects.toThrow(ValidationError);
    });

    test('uploadPostImage enforces path convention starting with userId for RLS compliance', async () => {
      const uploadMock = jest.fn().mockResolvedValue({
        data: { path: `${mockUser.id}/posts/12345.jpg` },
        error: null,
      });

      const getPublicUrlMock = jest.fn().mockReturnValue({
        data: { publicUrl: `https://supabase.co/storage/v1/object/public/user-media/${mockUser.id}/posts/12345.jpg` },
      });

      (supabase.storage.from as jest.Mock).mockReturnValue({
        upload: uploadMock,
        getPublicUrl: getPublicUrlMock,
      });

      const result = await clubPhotoService.uploadPostImage('file:///test.jpg', mockUser.id);
      expect(uploadMock).toHaveBeenCalled();
      const uploadedPath = uploadMock.mock.calls[0][0];
      // Must start with userId to pass storage RLS: (storage.foldername(name))[1] = auth.uid()::text
      expect(uploadedPath.startsWith(`${mockUser.id}/posts/`)).toBe(true);
      expect(result).toContain(mockUser.id);
    });
  });

  describe('9. Global Community Feed & Cross-Club Integration (Phase 3)', () => {
    test('getCommunityFeed fetches reverse-chronological posts via get_community_feed RPC', async () => {
      const mockRpcPosts = [
        {
          id: 'post-feed-1',
          club_id: 'club-dogs-1',
          author_id: 'vet-1',
          content: 'Important rabies booster advisory',
          caption: 'Important rabies booster advisory',
          image_url: null,
          status: 'approved',
          likes_count: 12,
          comments_count: 4,
          created_at: '2026-10-24T12:00:00Z',
          updated_at: '2026-10-24T12:00:00Z',
          author: { id: 'vet-1', full_name: 'Dr. Jane Vet', avatar_url: null },
          club: { id: 'club-dogs-1', name: 'Dogs Club', slug: 'dogs' },
          is_vet_verified: true,
          user_has_liked: false,
        },
        {
          id: 'post-feed-2',
          club_id: null,
          author_id: mockUser.id,
          content: 'General pet nutrition discussion across all species',
          caption: 'General pet nutrition discussion across all species',
          image_url: null,
          status: 'approved',
          likes_count: 5,
          comments_count: 1,
          created_at: '2026-10-24T11:00:00Z',
          updated_at: '2026-10-24T11:00:00Z',
          author: { id: mockUser.id, full_name: 'Parent User', avatar_url: null },
          club: null,
          is_vet_verified: false,
          user_has_liked: true,
        },
      ];

      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: mockRpcPosts,
        error: null,
      });

      const feed = await clubService.getCommunityFeed(20);

      expect(supabase.rpc).toHaveBeenCalledWith('get_community_feed', {
        p_club_id: null,
        p_limit: 20,
        p_cursor: null,
      });
      expect(feed.posts).toHaveLength(2);
      expect(feed.posts[0].club?.name).toBe('Dogs Club');
      expect(feed.posts[1].club).toBeNull();
      expect(feed.posts[1].club_id).toBeNull();
      expect(feed.posts[1].user_has_liked).toBe(true);
      expect(feed.hasMore).toBe(false);
      expect(feed.nextCursor).toBe('2026-10-24T11:00:00Z');
    });

    test('getCommunityFeed gracefully falls back to query builder if RPC fails or is missing', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      // RPC fails (e.g. function does not exist before migration)
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'function get_community_feed does not exist' },
      });

      const mockQueryPosts = [
        {
          id: 'post-fallback-1',
          club_id: 'club-cats-1',
          author_id: 'author-1',
          content: 'Indoor enrichment for cats',
          caption: 'Indoor enrichment for cats',
          image_url: null,
          status: 'approved',
          likes_count: 3,
          comments_count: 0,
          created_at: '2026-10-24T10:00:00Z',
          updated_at: '2026-10-24T10:00:00Z',
          author: { id: 'author-1', full_name: 'Cat Parent', avatar_url: null },
        },
      ];

      const postsQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue({ data: mockQueryPosts, error: null }),
        lt: jest.fn().mockReturnThis(),
      };

      const likesQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      const clubsQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        in: jest.fn().mockResolvedValue({
          data: [{ id: 'club-cats-1', name: 'Cats Club', slug: 'cats' }],
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'posts') return postsQueryBuilder;
        if (table === 'post_likes') return likesQueryBuilder;
        if (table === 'clubs') return clubsQueryBuilder;
        return postsQueryBuilder;
      });

      const feed = await clubService.getCommunityFeed(10);

      expect(feed.posts).toHaveLength(1);
      expect(feed.posts[0].id).toBe('post-fallback-1');
      expect(feed.posts[0].club?.name).toBe('Cats Club');
      expect(feed.hasMore).toBe(false);
    });

    test('getCommunityFeed provides offline seed posts when network is unavailable', async () => {
      (supabase.rpc as jest.Mock).mockRejectedValue(new Error('Network request failed'));

      const feed = await clubService.getCommunityFeed(20);

      expect(feed.posts.length).toBeGreaterThan(0);
      expect(feed.hasMore).toBe(false);
      const generalPost = feed.posts.find((p) => p.club_id === null);
      expect(generalPost).toBeDefined();
    });

    test('createPost allows general community post without club membership check', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockUser } },
      });

      const postInsertBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'post-general-1',
            club_id: null,
            author_id: mockUser.id,
            content: 'Hello everyone across all pet clubs!',
            caption: 'Hello everyone across all pet clubs!',
            image_url: null,
            status: 'approved',
            likes_count: 0,
            comments_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            author: { id: mockUser.id, full_name: 'Parent User', avatar_url: null },
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'posts') return postInsertBuilder;
        return postInsertBuilder;
      });

      const post = await clubService.createPost({
        content: 'Hello everyone across all pet clubs!',
        club_id: null,
      });

      expect(post.id).toBe('post-general-1');
      expect(post.club_id).toBeNull();
      expect(post.club).toBeNull();
      expect(postInsertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          club_id: null,
          author_id: mockUser.id,
          content: 'Hello everyone across all pet clubs!',
        }),
      );
    });
  });
});
