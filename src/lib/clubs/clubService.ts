/**
 * Pet Clubs Service
 * Business logic, Supabase database interactions, RLS enforcement,
 * and optimistic caching contracts for Pet Clubs.
 */

import { supabase } from '../supabase/client';
import {
  Club,
  ClubPost,
  ClubComment,
  ContentReport,
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
  UpdateCommentInput,
  CreateReportInput,
  ModerationActionInput,
  ClubFeedResponse,
} from '../../types/club';
import {
  AuthError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  normalizeError,
} from '../api/errors';

export const DEFAULT_SEED_CLUBS: Club[] = [
  {
    id: 'club-dogs-default',
    slug: 'dogs',
    name: 'Dogs Club',
    description:
      'Everything canine: puppy care, training tips, nutrition, breed discussions, and dog health.',
    category: 'Dogs',
    cover_image:
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Dog',
    member_count: 0,
    post_count: 0,
    is_active: true,
    created_at: '2026-10-12T00:00:00Z',
    updated_at: '2026-10-12T00:00:00Z',
    is_member: false,
  },
  {
    id: 'club-cats-default',
    slug: 'cats',
    name: 'Cats Club',
    description:
      'Feline wellness, behavior insights, playful antics, enrichment, and preventative care.',
    category: 'Cats',
    cover_image:
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Cat',
    member_count: 0,
    post_count: 0,
    is_active: true,
    created_at: '2026-10-12T00:00:00Z',
    updated_at: '2026-10-12T00:00:00Z',
    is_member: false,
  },
  {
    id: 'club-birds-default',
    slug: 'birds',
    name: 'Birds Club',
    description:
      'Avian enthusiasts community: parakeets, parrots, songbirds, nutrition, and flight health.',
    category: 'Birds',
    cover_image:
      'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Feather',
    member_count: 0,
    post_count: 0,
    is_active: true,
    created_at: '2026-10-12T00:00:00Z',
    updated_at: '2026-10-12T00:00:00Z',
    is_member: false,
  },
  {
    id: 'club-horses-default',
    slug: 'horses',
    name: 'Horses & Equine Club',
    description:
      'Equine management, equestrian training, hoof care, stable practices, and equine veterinary care.',
    category: 'Horses',
    cover_image:
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Compass',
    member_count: 0,
    post_count: 0,
    is_active: true,
    created_at: '2026-10-12T00:00:00Z',
    updated_at: '2026-10-12T00:00:00Z',
    is_member: false,
  },
  {
    id: 'club-farm-animals-default',
    slug: 'farm-animals',
    name: 'Farm Animals Club',
    description:
      'Ruminants, goats, sheep, pigs, and livestock management, biosecurity, and herd health.',
    category: 'Farm Animals',
    cover_image:
      'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Tractor',
    member_count: 0,
    post_count: 0,
    is_active: true,
    created_at: '2026-10-12T00:00:00Z',
    updated_at: '2026-10-12T00:00:00Z',
    is_member: false,
  },
  {
    id: 'club-poultry-default',
    slug: 'poultry',
    name: 'Poultry Club',
    description:
      'Chickens, ducks, turkeys, coop management, egg production, flock biosecurity, and avian vitality.',
    category: 'Poultry',
    cover_image:
      'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=800&q=80',
    icon_name: 'Egg',
    member_count: 0,
    post_count: 0,
    is_active: true,
    created_at: '2026-10-12T00:00:00Z',
    updated_at: '2026-10-12T00:00:00Z',
    is_member: false,
  },
];

export class ClubService {
  /**
   * Fetch all active clubs with optional search query, category filtering, and membership indicator.
   * Includes graceful offline seed fallback if network is unreachable.
   */
  async getClubs(searchQuery?: string, category?: string): Promise<Club[]> {
    try {
      let query = supabase
        .from('clubs')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (category && category.trim().toLowerCase() !== 'all') {
        const cleanCat = category.trim();
        query = query.ilike('category', `%${cleanCat}%`);
      }

      if (searchQuery && searchQuery.trim()) {
        const clean = searchQuery.trim();
        query = query.or(
          `name.ilike.%${clean}%,description.ilike.%${clean}%,category.ilike.%${clean}%`,
        );
      }

      const { data: clubs, error } = await query;
      if (error) throw normalizeError(error);

      // If user is logged in, attach is_member flag
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user && clubs && clubs.length > 0) {
        const { data: memberships } = await supabase
          .from('club_memberships')
          .select('club_id')
          .eq('user_id', session.user.id);

        const joinedClubIds = new Set((memberships || []).map((m) => m.club_id));

        return (clubs || []).map((c) => ({
          ...c,
          is_member: joinedClubIds.has(c.id),
        }));
      }

      return (clubs || []).map((c) => ({
        ...c,
        is_member: false,
      }));
    } catch (err: any) {
      // Offline fallback: if network failure or client offline, serve filtered seed clubs
      const isNetwork =
        err?.name === 'NetworkError' ||
        err?.message?.includes('Network') ||
        err?.message?.includes('Failed to fetch') ||
        err?.code === 'NETWORK_ERROR';

      if (isNetwork) {
        let results = DEFAULT_SEED_CLUBS;
        if (category && category.trim().toLowerCase() !== 'all') {
          const catLower = category.trim().toLowerCase();
          results = results.filter((c) => c.category.toLowerCase().includes(catLower));
        }
        if (searchQuery && searchQuery.trim()) {
          const qLower = searchQuery.trim().toLowerCase();
          results = results.filter(
            (c) =>
              c.name.toLowerCase().includes(qLower) ||
              c.description.toLowerCase().includes(qLower) ||
              c.category.toLowerCase().includes(qLower),
          );
        }
        return results;
      }
      throw normalizeError(err);
    }
  }

  /**
   * Fetch club details by ID or Slug
   */
  async getClubById(clubIdOrSlug: string): Promise<Club> {
    try {
      if (!clubIdOrSlug) throw new ValidationError('Club ID or slug is required.');

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        clubIdOrSlug,
      );

      let query = supabase.from('clubs').select('*');
      if (isUuid) {
        query = query.eq('id', clubIdOrSlug);
      } else {
        query = query.eq('slug', clubIdOrSlug);
      }

      const { data, error } = await query.single();
      if (error || !data) {
        const isNetwork =
          (error as any)?.message?.includes('Network') ||
          (error as any)?.message?.includes('Failed to fetch');
        if (isNetwork) {
          const fallback = DEFAULT_SEED_CLUBS.find(
            (c) => c.id === clubIdOrSlug || c.slug === clubIdOrSlug,
          );
          if (fallback) return fallback;
        }
        throw new NotFoundError('The requested pet club could not be found.');
      }

      // Check current user membership
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let isMember = false;
      if (session?.user) {
        const { data: memberData } = await supabase
          .from('club_memberships')
          .select('id')
          .eq('club_id', data.id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        isMember = !!memberData;
      }

      return {
        ...data,
        is_member: isMember,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Fetch clubs that the authenticated user has joined
   */
  async getJoinedClubs(): Promise<Club[]> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return [];

      const { data, error } = await supabase
        .from('club_memberships')
        .select(`
          club_id,
          clubs (*)
        `)
        .eq('user_id', session.user.id);

      if (error) throw normalizeError(error);

      const clubs: Club[] = [];
      for (const row of data || []) {
        if (row.clubs) {
          const clubItem = row.clubs as unknown as Club;
          clubs.push({
            ...clubItem,
            is_member: true,
          });
        }
      }

      return clubs;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Join a Pet Club (Idempotent)
   */
  async joinClub(clubId: string): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Please sign in to join pet clubs.');
      }

      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('join_club', {
        p_club_id: clubId,
      });

      if (!rpcError && rpcData?.success) {
        return true;
      }

      // Fallback direct insert
      const { error: insertError } = await supabase
        .from('club_memberships')
        .insert({
          club_id: clubId,
          user_id: session.user.id,
          role: 'member',
        });

      if (insertError) {
        // If unique constraint violation, it is already joined
        if (insertError.code === '23505') {
          return true;
        }
        throw normalizeError(insertError);
      }

      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Leave a Pet Club
   */
  async leaveClub(clubId: string): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Please sign in to leave a club.');
      }

      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('leave_club', {
        p_club_id: clubId,
      });

      if (!rpcError && rpcData?.success) {
        return true;
      }

      // Fallback direct delete
      const { error: deleteError } = await supabase
        .from('club_memberships')
        .delete()
        .eq('club_id', clubId)
        .eq('user_id', session.user.id);

      if (deleteError) {
        throw normalizeError(deleteError);
      }

      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Get Feed for a specific club with cursor pagination
   */
  async getClubFeed(
    clubId: string,
    limit = 20,
    cursor?: string,
  ): Promise<ClubFeedResponse> {
    try {
      if (!clubId) throw new ValidationError('Club ID is required to fetch feed.');

      // Try get_club_feed RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_club_feed', {
        p_club_id: clubId,
        p_limit: limit,
        p_cursor: cursor || null,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        const posts: ClubPost[] = rpcData;
        const hasMore = posts.length >= limit;
        const nextCursor = posts.length > 0 ? posts[posts.length - 1].created_at : undefined;
        return { posts, hasMore, nextCursor };
      }

      // Fallback query if RPC unavailable
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let query = supabase
        .from('posts')
        .select(`
          id,
          club_id,
          author_id,
          content,
          caption,
          image_url,
          status,
          likes_count,
          comments_count,
          created_at,
          updated_at,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('club_id', clubId)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;
      if (error) throw normalizeError(error);

      const postList = data || [];

      // Check liked status if user logged in
      let likedPostIds = new Set<string>();
      if (session?.user && postList.length > 0) {
        const postIds = postList.map((p) => p.id);
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', session.user.id)
          .in('post_id', postIds);

        if (likesData) {
          likedPostIds = new Set(likesData.map((l) => l.post_id));
        }
      }

      const posts: ClubPost[] = postList.map((item: any) => ({
        id: item.id,
        club_id: item.club_id,
        author_id: item.author_id,
        content: item.content || item.caption || '',
        caption: item.caption,
        image_url: item.image_url,
        status: item.status || 'approved',
        likes_count: item.likes_count || 0,
        comments_count: item.comments_count || 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        author: item.author,
        is_vet_verified: false,
        user_has_liked: likedPostIds.has(item.id),
      }));

      const hasMore = posts.length >= limit;
      const nextCursor = posts.length > 0 ? posts[posts.length - 1].created_at : undefined;

      return { posts, hasMore, nextCursor };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Get Global Community Feed across all clubs & general discussions with cursor pagination.
   * Attempts get_community_feed RPC first; falls back to direct query; includes offline fallback.
   */
  async getCommunityFeed(
    limit = 20,
    cursor?: string,
  ): Promise<ClubFeedResponse> {
    try {
      // 1. Try get_community_feed RPC
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_community_feed', {
        p_club_id: null,
        p_limit: limit,
        p_cursor: cursor || null,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        const posts: ClubPost[] = rpcData.map((p: any) => ({
          id: p.id,
          club_id: p.club_id ?? null,
          author_id: p.author_id,
          content: p.content || p.caption || '',
          caption: p.caption,
          image_url: p.image_url,
          status: p.status || 'approved',
          likes_count: Number(p.likes_count || 0),
          comments_count: Number(p.comments_count || 0),
          created_at: p.created_at,
          updated_at: p.updated_at,
          author: p.author,
          club: p.club ?? null,
          is_vet_verified: Boolean(p.is_vet_verified),
          user_has_liked: Boolean(p.user_has_liked),
        }));

        const hasMore = posts.length >= limit;
        const nextCursor = posts.length > 0 ? posts[posts.length - 1].created_at : undefined;
        return { posts, hasMore, nextCursor };
      }

      // 2. Query Builder Fallback if RPC unavailable
      const {
        data: { session },
      } = await supabase.auth.getSession();

      let query = supabase
        .from('posts')
        .select(`
          id,
          club_id,
          author_id,
          content,
          caption,
          image_url,
          status,
          likes_count,
          comments_count,
          created_at,
          updated_at,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error } = await query;
      if (error) throw normalizeError(error);

      const postList = data || [];

      // Check liked status if user logged in
      let likedPostIds = new Set<string>();
      if (session?.user && postList.length > 0) {
        const postIds = postList.map((p) => p.id);
        const { data: likesData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('user_id', session.user.id)
          .in('post_id', postIds);

        if (likesData) {
          likedPostIds = new Set(likesData.map((l) => l.post_id));
        }
      }

      // Check club references for club-associated posts
      const clubIds = Array.from(
        new Set(postList.filter((p) => Boolean(p.club_id)).map((p) => p.club_id as string)),
      );
      const clubMap = new Map<string, { id: string; name: string; slug: string }>();

      if (clubIds.length > 0) {
        try {
          const { data: clubsData } = await supabase
            .from('clubs')
            .select('id, name, slug')
            .in('id', clubIds);

          if (clubsData) {
            for (const c of clubsData) {
              clubMap.set(c.id, { id: c.id, name: c.name, slug: c.slug });
            }
          }
        } catch {
          // Gracefully continue without club titles if club lookup fails
        }
      }

      const posts: ClubPost[] = postList.map((item: any) => ({
        id: item.id,
        club_id: item.club_id ?? null,
        author_id: item.author_id,
        content: item.content || item.caption || '',
        caption: item.caption,
        image_url: item.image_url,
        status: item.status || 'approved',
        likes_count: item.likes_count || 0,
        comments_count: item.comments_count || 0,
        created_at: item.created_at,
        updated_at: item.updated_at,
        author: item.author,
        club: item.club_id ? clubMap.get(item.club_id) || null : null,
        is_vet_verified: false,
        user_has_liked: likedPostIds.has(item.id),
      }));

      const hasMore = posts.length >= limit;
      const nextCursor = posts.length > 0 ? posts[posts.length - 1].created_at : undefined;

      return { posts, hasMore, nextCursor };
    } catch (err: any) {
      // Offline fallback: if network failure or client offline, serve sample feed posts
      const isNetwork =
        err?.name === 'NetworkError' ||
        err?.message?.includes('Network') ||
        err?.message?.includes('Failed to fetch') ||
        err?.code === 'NETWORK_ERROR';

      if (isNetwork) {
        const seedPosts: ClubPost[] = [
          {
            id: 'seed-post-comm-1',
            club_id: 'club-dogs-default',
            author_id: 'seed-vet-1',
            content:
              'Vaccination schedules for spring puppies: what every new pet parent needs to know before their first park walk.',
            caption:
              'Vaccination schedules for spring puppies: what every new pet parent needs to know before their first park walk.',
            image_url:
              'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
            status: 'approved',
            likes_count: 14,
            comments_count: 3,
            created_at: new Date(Date.now() - 3600000).toISOString(),
            updated_at: new Date(Date.now() - 3600000).toISOString(),
            author: { id: 'seed-vet-1', full_name: 'Dr. Sarah Wilson, DVM', avatar_url: null },
            club: { id: 'club-dogs-default', name: 'Dogs Club', slug: 'dogs' },
            is_vet_verified: true,
            user_has_liked: false,
          },
          {
            id: 'seed-post-comm-2',
            club_id: null,
            author_id: 'seed-parent-1',
            content:
              'Hello Vetopia community! Excited to join and share updates from our mixed-animal rescue sanctuary.',
            caption:
              'Hello Vetopia community! Excited to join and share updates from our mixed-animal rescue sanctuary.',
            image_url: null,
            status: 'approved',
            likes_count: 8,
            comments_count: 2,
            created_at: new Date(Date.now() - 7200000).toISOString(),
            updated_at: new Date(Date.now() - 7200000).toISOString(),
            author: { id: 'seed-parent-1', full_name: 'Maya Lin', avatar_url: null },
            club: null,
            is_vet_verified: false,
            user_has_liked: false,
          },
        ];
        return { posts: seedPosts, hasMore: false };
      }

      throw normalizeError(err);
    }
  }

  /**
   * Get single post by ID
   */
  async getPostById(postId: string): Promise<ClubPost> {
    try {
      if (!postId) throw new ValidationError('Post ID is required.');

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { data, error } = await supabase
        .from('posts')
        .select(`
          id,
          club_id,
          author_id,
          content,
          caption,
          image_url,
          status,
          likes_count,
          comments_count,
          created_at,
          updated_at,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('id', postId)
        .single();

      if (error || !data) {
        throw new NotFoundError('The requested post could not be found.');
      }

      let isVetVerified = false;
      const { data: vetData } = await supabase
        .from('vet_profiles')
        .select('verified')
        .eq('user_id', data.author_id)
        .maybeSingle();

      if (vetData?.verified) {
        isVetVerified = true;
      }

      let userHasLiked = false;
      if (session?.user) {
        const { data: likeData } = await supabase
          .from('post_likes')
          .select('post_id')
          .eq('post_id', postId)
          .eq('user_id', session.user.id)
          .maybeSingle();

        userHasLiked = !!likeData;
      }

      let clubRef: { id: string; name: string; slug: string } | null = null;
      if (data.club_id) {
        const { data: clubData } = await supabase
          .from('clubs')
          .select('id, name, slug')
          .eq('id', data.club_id)
          .maybeSingle();
        if (clubData) {
          clubRef = clubData;
        }
      }

      return {
        id: data.id,
        club_id: data.club_id,
        author_id: data.author_id,
        content: data.content || data.caption || '',
        caption: data.caption,
        image_url: data.image_url,
        status: data.status,
        likes_count: data.likes_count || 0,
        comments_count: data.comments_count || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: data.author as unknown as ClubPost['author'],
        club: clubRef,
        is_vet_verified: isVetVerified,
        user_has_liked: userHasLiked,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Create a post (club-associated or general community post)
   */
  async createPost(input: CreatePostInput): Promise<ClubPost> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to create a post.');
      }

      if (!input.content || !input.content.trim()) {
        throw new ValidationError('Post content cannot be empty.');
      }

      if (input.content.length > 5000) {
        throw new ValidationError('Post content cannot exceed 5000 characters.');
      }

      let clubRef: { id: string; name: string; slug: string } | null = null;

      // Verify club membership only if posting inside a specific club
      if (input.club_id) {
        const { data: membership } = await supabase
          .from('club_memberships')
          .select('id')
          .eq('club_id', input.club_id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!membership) {
          throw new ForbiddenError('You must join this Pet Club before posting.');
        }

        const { data: clubData } = await supabase
          .from('clubs')
          .select('id, name, slug')
          .eq('id', input.club_id)
          .maybeSingle();
        if (clubData) {
          clubRef = clubData;
        }
      }

      const insertPayload = {
        club_id: input.club_id || null,
        author_id: session.user.id,
        content: input.content.trim(),
        caption: input.content.trim(),
        image_url: input.image_url || null,
        status: 'approved',
      };

      const { data, error } = await supabase
        .from('posts')
        .insert(insertPayload)
        .select(`
          id,
          club_id,
          author_id,
          content,
          caption,
          image_url,
          status,
          likes_count,
          comments_count,
          created_at,
          updated_at,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) {
        throw normalizeError(error);
      }

      return {
        id: data.id,
        club_id: data.club_id,
        author_id: data.author_id,
        content: data.content || data.caption,
        caption: data.caption,
        image_url: data.image_url,
        status: data.status,
        likes_count: data.likes_count || 0,
        comments_count: data.comments_count || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: data.author as unknown as ClubPost['author'],
        club: clubRef,
        is_vet_verified: false,
        user_has_liked: false,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Edit post content
   */
  async updatePost(postId: string, input: UpdatePostInput): Promise<ClubPost> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to edit post.');
      }

      if (!input.content || !input.content.trim()) {
        throw new ValidationError('Post content cannot be empty.');
      }

      const updatePayload: Record<string, unknown> = {
        content: input.content.trim(),
        caption: input.content.trim(),
        updated_at: new Date().toISOString(),
      };

      if (input.image_url !== undefined) {
        updatePayload.image_url = input.image_url;
      }

      const { data, error } = await supabase
        .from('posts')
        .update(updatePayload)
        .eq('id', postId)
        .eq('author_id', session.user.id)
        .select(`
          id,
          club_id,
          author_id,
          content,
          caption,
          image_url,
          status,
          likes_count,
          comments_count,
          created_at,
          updated_at,
          author:profiles!posts_author_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw normalizeError(error);

      return {
        id: data.id,
        club_id: data.club_id,
        author_id: data.author_id,
        content: data.content || data.caption,
        caption: data.caption,
        image_url: data.image_url,
        status: data.status,
        likes_count: data.likes_count || 0,
        comments_count: data.comments_count || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: data.author as unknown as ClubPost['author'],
        user_has_liked: false,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Delete post
   */
  async deletePost(postId: string): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to delete post.');
      }

      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

      if (error) throw normalizeError(error);
      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Toggle Like/Unlike on a post
   */
  async toggleLike(postId: string): Promise<{ liked: boolean; likes_count: number }> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Please sign in to like posts.');
      }

      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('toggle_post_like', {
        p_post_id: postId,
      });

      if (!rpcError && rpcData) {
        return {
          liked: Boolean(rpcData.liked),
          likes_count: Number(rpcData.likes_count || 0),
        };
      }

      // Fallback
      const { data: existingLike } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (existingLike) {
        await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', session.user.id);
        return { liked: false, likes_count: 0 };
      } else {
        await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: session.user.id });
        return { liked: true, likes_count: 1 };
      }
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Fetch comments for a post
   */
  async getComments(postId: string): Promise<ClubComment[]> {
    try {
      if (!postId) throw new ValidationError('Post ID is required to fetch comments.');

      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          id,
          post_id,
          user_id,
          body,
          status,
          created_at,
          updated_at,
          author:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq('post_id', postId)
        .eq('status', 'approved')
        .order('created_at', { ascending: true });

      if (error) throw normalizeError(error);

      return (data || []).map((c: any) => ({
        id: c.id,
        post_id: c.post_id,
        user_id: c.user_id,
        body: c.body,
        status: c.status || 'approved',
        created_at: c.created_at,
        updated_at: c.updated_at,
        author: c.author,
      }));
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Add a comment to a post
   */
  async createComment(input: CreateCommentInput): Promise<ClubComment> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Please sign in to add comments.');
      }

      if (!input.body || !input.body.trim()) {
        throw new ValidationError('Comment text cannot be empty.');
      }

      if (input.body.length > 1000) {
        throw new ValidationError('Comment cannot exceed 1000 characters.');
      }

      // Check post & membership
      const { data: postData } = await supabase
        .from('posts')
        .select('id, club_id, author_id')
        .eq('id', input.post_id)
        .single();

      if (postData?.club_id) {
        const { data: membership } = await supabase
          .from('club_memberships')
          .select('id')
          .eq('club_id', postData.club_id)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!membership) {
          throw new ForbiddenError('You must join this Pet Club to comment on posts.');
        }
      }

      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: input.post_id,
          user_id: session.user.id,
          body: input.body.trim(),
          status: 'approved',
        })
        .select(`
          id,
          post_id,
          user_id,
          body,
          status,
          created_at,
          updated_at,
          author:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw normalizeError(error);

      // Notification: Send in-app notification to post author if not the commenter
      if (postData && postData.author_id !== session.user.id) {
        (async () => {
          try {
            await supabase.from('notifications').insert({
              user_id: postData.author_id,
              type: 'club_post_comment',
              title: 'New comment on your post',
              body: `${session.user.user_metadata?.full_name || 'A club member'} commented on your post: "${input.body.trim().substring(0, 50)}..."`,
              data: {
                kind: 'club_post_comment',
                postId: input.post_id,
                clubId: postData.club_id,
                route: `/clubs/post/${input.post_id}`,
              },
            });
          } catch (notifErr: unknown) {
            console.warn('[ClubService] Failed to dispatch comment notification:', notifErr);
          }
        })();
      }

      return {
        id: data.id,
        post_id: data.post_id,
        user_id: data.user_id,
        body: data.body,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: data.author as unknown as ClubComment['author'],
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Edit own comment
   */
  async updateComment(commentId: string, input: UpdateCommentInput): Promise<ClubComment> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to edit comment.');
      }

      if (!input.body || !input.body.trim()) {
        throw new ValidationError('Comment text cannot be empty.');
      }

      const { data, error } = await supabase
        .from('post_comments')
        .update({
          body: input.body.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', commentId)
        .eq('user_id', session.user.id)
        .select(`
          id,
          post_id,
          user_id,
          body,
          status,
          created_at,
          updated_at,
          author:profiles!post_comments_user_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw normalizeError(error);

      return {
        id: data.id,
        post_id: data.post_id,
        user_id: data.user_id,
        body: data.body,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: data.author as unknown as ClubComment['author'],
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Delete own comment
   */
  async deleteComment(commentId: string): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to delete comment.');
      }

      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw normalizeError(error);
      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Report a post or comment
   */
  async reportContent(input: CreateReportInput): Promise<ContentReport> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to submit reports.');
      }

      const validReasons = ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'];
      if (!validReasons.includes(input.reason)) {
        throw new ValidationError('Invalid report reason provided.');
      }

      const { data, error } = await supabase
        .from('content_reports')
        .insert({
          reporter_id: session.user.id,
          target_type: input.target_type,
          target_id: input.target_id,
          reason: input.reason,
          details: input.details?.trim() || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new ValidationError('You have already submitted a report for this content.');
        }
        throw normalizeError(error);
      }

      return data as ContentReport;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Admin content moderation action (hide/remove/restore)
   */
  async moderateContent(input: ModerationActionInput): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Administrator authentication required.');
      }

      // Try RPC first
      const { data: rpcData, error: rpcError } = await supabase.rpc('moderate_content', {
        p_target_type: input.target_type,
        p_target_id: input.target_id,
        p_action: input.action,
        p_notes: input.notes || null,
      });

      if (!rpcError && rpcData?.success) {
        return true;
      }

      // Direct fallback update
      const statusMap = {
        hide: 'hidden',
        remove: 'removed',
        restore: 'approved',
      };
      const newStatus = statusMap[input.action];

      const table = input.target_type === 'post' ? 'posts' : 'post_comments';
      const { error } = await supabase
        .from(table)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', input.target_id);

      if (error) throw normalizeError(error);
      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }
}

export const clubService = new ClubService();
