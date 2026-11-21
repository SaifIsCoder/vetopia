-- ==============================================================================
-- Migration: 20261012210000_pet_clubs_schema.sql
-- Description: Pet Clubs Architecture, Schema, RLS, Triggers, RPCs & Seed Data
-- ==============================================================================

-- 0. Ensure Role & Helper Functions Exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('pet_parent', 'vet', 'admin');
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 1. Clubs Table
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  cover_image TEXT,
  icon_name TEXT,
  member_count INTEGER NOT NULL DEFAULT 0,
  post_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clubs_slug ON public.clubs(slug);
CREATE INDEX IF NOT EXISTS idx_clubs_category ON public.clubs(category);
CREATE INDEX IF NOT EXISTS idx_clubs_active ON public.clubs(is_active) WHERE is_active = TRUE;

GRANT SELECT ON public.clubs TO anon;
GRANT SELECT ON public.clubs TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;

-- 2. Club Memberships Table
CREATE TABLE IF NOT EXISTS public.club_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'moderator', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_club_memberships_club_user UNIQUE (club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_memberships_club ON public.club_memberships(club_id);
CREATE INDEX IF NOT EXISTS idx_club_memberships_user ON public.club_memberships(user_id);

GRANT SELECT ON public.club_memberships TO anon;
GRANT SELECT, INSERT, DELETE ON public.club_memberships TO authenticated;
GRANT ALL ON public.club_memberships TO service_role;

-- 3. Posts Table (Creates if not exists, then ensures club columns exist)
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  caption TEXT NOT NULL DEFAULT '',
  content TEXT,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  location TEXT,
  pet_ids UUID[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden', 'removed', 'flagged')),
  likes_count INTEGER NOT NULL DEFAULT 0,
  comments_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all club-related columns exist if table was previously created
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden', 'removed', 'flagged')),
  ADD COLUMN IF NOT EXISTS likes_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_club_created ON public.posts(club_id, created_at DESC) WHERE club_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status ON public.posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_author ON public.posts(author_id, created_at DESC);

GRANT SELECT ON public.posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;

-- 4. Post Comments Table (Creates if not exists, then ensures club columns exist)
CREATE TABLE IF NOT EXISTS public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden', 'removed', 'flagged')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden', 'removed', 'flagged')),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON public.post_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_post_comments_status ON public.post_comments(status);

GRANT SELECT ON public.post_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;

-- 4b. Post Likes Table (Creates if not exists)
CREATE TABLE IF NOT EXISTS public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_likes_post ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user ON public.post_likes(user_id);

GRANT SELECT ON public.post_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;

-- 4c. Post Media Table (Creates if not exists)
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'image',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post ON public.post_media(post_id, position);

GRANT SELECT ON public.post_media TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO authenticated;
GRANT ALL ON public.post_media TO service_role;

-- Link Profiles Foreign Keys if profiles table exists (for PostgREST introspection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'posts_author_id_fkey' AND table_name = 'posts'
  ) THEN
    ALTER TABLE public.posts
      ADD CONSTRAINT posts_author_id_fkey
      FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'post_comments_user_id_fkey' AND table_name = 'post_comments'
  ) THEN
    ALTER TABLE public.post_comments
      ADD CONSTRAINT post_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- 5. Content Reports Table
CREATE TABLE IF NOT EXISTS public.content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
  target_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'actioned')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_content_reports_reporter_target UNIQUE (reporter_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_content_reports_target ON public.content_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_status ON public.content_reports(status);
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter ON public.content_reports(reporter_id);

GRANT SELECT, INSERT ON public.content_reports TO authenticated;
GRANT UPDATE, DELETE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;

-- ==============================================================================
-- 6. Trigger Functions for Counter Synchronization
-- ==============================================================================

-- Sync posts content and caption
CREATE OR REPLACE FUNCTION public.sync_post_caption_content()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.content IS NOT NULL AND (NEW.caption IS NULL OR NEW.caption = '') THEN
    NEW.caption := NEW.content;
  ELSIF NEW.caption IS NOT NULL AND (NEW.content IS NULL OR NEW.content = '') THEN
    NEW.content := NEW.caption;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_post_caption_content ON public.posts;
CREATE TRIGGER trg_sync_post_caption_content
  BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_caption_content();

-- Member counter on public.clubs
CREATE OR REPLACE FUNCTION public.sync_club_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.clubs
    SET member_count = member_count + 1,
        updated_at = NOW()
    WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.clubs
    SET member_count = GREATEST(0, member_count - 1),
        updated_at = NOW()
    WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_club_member_count ON public.club_memberships;
CREATE TRIGGER trg_club_member_count
  AFTER INSERT OR DELETE ON public.club_memberships
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_member_count();

-- Post counter on public.clubs
CREATE OR REPLACE FUNCTION public.sync_club_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.club_id IS NOT NULL THEN
    UPDATE public.clubs
    SET post_count = post_count + 1,
        updated_at = NOW()
    WHERE id = NEW.club_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' AND OLD.club_id IS NOT NULL THEN
    UPDATE public.clubs
    SET post_count = GREATEST(0, post_count - 1),
        updated_at = NOW()
    WHERE id = OLD.club_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_club_post_count ON public.posts;
CREATE TRIGGER trg_club_post_count
  AFTER INSERT OR DELETE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.sync_club_post_count();

-- Likes counter on public.posts
CREATE OR REPLACE FUNCTION public.sync_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET likes_count = GREATEST(0, likes_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_likes_count ON public.post_likes;
CREATE TRIGGER trg_post_likes_count
  AFTER INSERT OR DELETE ON public.post_likes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_likes_count();

-- Comments counter on public.posts
CREATE OR REPLACE FUNCTION public.sync_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts
    SET comments_count = GREATEST(0, comments_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_post_comments_count ON public.post_comments;
CREATE TRIGGER trg_post_comments_count
  AFTER INSERT OR DELETE ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_comments_count();

-- ==============================================================================
-- 7. Row Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Clubs Policies
DROP POLICY IF EXISTS "clubs_public_read" ON public.clubs;
CREATE POLICY "clubs_public_read" ON public.clubs
  FOR SELECT USING (is_active = TRUE OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "clubs_admin_insert" ON public.clubs;
CREATE POLICY "clubs_admin_insert" ON public.clubs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "clubs_admin_update" ON public.clubs;
CREATE POLICY "clubs_admin_update" ON public.clubs
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "clubs_admin_delete" ON public.clubs;
CREATE POLICY "clubs_admin_delete" ON public.clubs
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Club Memberships Policies
DROP POLICY IF EXISTS "club_memberships_read" ON public.club_memberships;
CREATE POLICY "club_memberships_read" ON public.club_memberships
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "club_memberships_insert" ON public.club_memberships;
CREATE POLICY "club_memberships_insert" ON public.club_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (role = 'member' OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

DROP POLICY IF EXISTS "club_memberships_delete" ON public.club_memberships;
CREATE POLICY "club_memberships_delete" ON public.club_memberships
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Posts Policies (Refined for Club Membership & Status)
DROP POLICY IF EXISTS "posts are publicly viewable" ON public.posts;
DROP POLICY IF EXISTS "posts_select_approved_or_author" ON public.posts;
CREATE POLICY "posts_select_approved_or_author" ON public.posts
  FOR SELECT USING (
    status = 'approved'
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "author creates own posts" ON public.posts;
DROP POLICY IF EXISTS "posts_insert_member" ON public.posts;
CREATE POLICY "posts_insert_member" ON public.posts
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      club_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.club_memberships cm
        WHERE cm.club_id = posts.club_id AND cm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "author updates own posts" ON public.posts;
DROP POLICY IF EXISTS "posts_update_author_or_admin" ON public.posts;
CREATE POLICY "posts_update_author_or_admin" ON public.posts
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    (author_id = auth.uid() AND status IN ('approved', 'pending'))
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "author deletes own posts" ON public.posts;
DROP POLICY IF EXISTS "posts_delete_author_or_admin" ON public.posts;
CREATE POLICY "posts_delete_author_or_admin" ON public.posts
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Post Comments Policies (Refined for Club Membership & Status)
DROP POLICY IF EXISTS "comments are publicly viewable" ON public.post_comments;
DROP POLICY IF EXISTS "comments_select_approved_or_author" ON public.post_comments;
CREATE POLICY "comments_select_approved_or_author" ON public.post_comments
  FOR SELECT USING (
    status = 'approved'
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "members comment" ON public.post_comments;
DROP POLICY IF EXISTS "comments_insert_member" ON public.post_comments;
CREATE POLICY "comments_insert_member" ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_comments.post_id AND p.club_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.posts p
        JOIN public.club_memberships cm ON cm.club_id = p.club_id
        WHERE p.id = post_comments.post_id AND cm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "members update own comments" ON public.post_comments;
CREATE POLICY "members update own comments" ON public.post_comments
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "members delete own comments" ON public.post_comments;
DROP POLICY IF EXISTS "comments_delete_author_or_admin" ON public.post_comments;
CREATE POLICY "comments_delete_author_or_admin" ON public.post_comments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Post Likes Policies (Require Club Membership)
DROP POLICY IF EXISTS "likes are publicly viewable" ON public.post_likes;
CREATE POLICY "likes are publicly viewable" ON public.post_likes
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "members like posts" ON public.post_likes;
CREATE POLICY "members like posts" ON public.post_likes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      NOT EXISTS (
        SELECT 1 FROM public.posts p
        WHERE p.id = post_likes.post_id AND p.club_id IS NOT NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.posts p
        JOIN public.club_memberships cm ON cm.club_id = p.club_id
        WHERE p.id = post_likes.post_id AND cm.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "members unlike posts" ON public.post_likes;
CREATE POLICY "members unlike posts" ON public.post_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Post Media Policies
DROP POLICY IF EXISTS "post media is publicly viewable" ON public.post_media;
CREATE POLICY "post media is publicly viewable" ON public.post_media
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "author adds own post media" ON public.post_media;
CREATE POLICY "author adds own post media" ON public.post_media
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

DROP POLICY IF EXISTS "author deletes own post media" ON public.post_media;
CREATE POLICY "author deletes own post media" ON public.post_media
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_id AND p.author_id = auth.uid())
  );

-- Content Reports Policies
DROP POLICY IF EXISTS "reports_select_reporter_or_admin" ON public.content_reports;
CREATE POLICY "reports_select_reporter_or_admin" ON public.content_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "reports_insert_reporter" ON public.content_reports;
CREATE POLICY "reports_insert_reporter" ON public.content_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "reports_update_admin_only" ON public.content_reports;
CREATE POLICY "reports_update_admin_only" ON public.content_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "reports_delete_admin_only" ON public.content_reports;
CREATE POLICY "reports_delete_admin_only" ON public.content_reports
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Storage Object Read Policy for user-media
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'public read user media'
  ) THEN
    CREATE POLICY "public read user media" ON storage.objects
      FOR SELECT USING (bucket_id = 'user-media');
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ==============================================================================
-- 8. High-Performance RPC Functions
-- ==============================================================================

-- Join Club RPC (Idempotent)
CREATE OR REPLACE FUNCTION public.join_club(p_club_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_membership RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to join club';
  END IF;

  -- Ensure club exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id AND is_active = TRUE) THEN
    RAISE EXCEPTION 'Club not found or inactive';
  END IF;

  INSERT INTO public.club_memberships (club_id, user_id, role)
  VALUES (p_club_id, v_user_id, 'member')
  ON CONFLICT (club_id, user_id) DO NOTHING;

  SELECT * INTO v_membership
  FROM public.club_memberships
  WHERE club_id = p_club_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'club_id', p_club_id,
    'user_id', v_user_id,
    'role', v_membership.role,
    'created_at', v_membership.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_club(UUID) TO authenticated;

-- Leave Club RPC
CREATE OR REPLACE FUNCTION public.leave_club(p_club_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to leave club';
  END IF;

  DELETE FROM public.club_memberships
  WHERE club_id = p_club_id AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'club_id', p_club_id,
    'user_id', v_user_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_club(UUID) TO authenticated;

-- Atomic Post Like / Unlike Toggle RPC
CREATE OR REPLACE FUNCTION public.toggle_post_like(p_post_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_post RECORD;
  v_liked BOOLEAN;
  v_count INTEGER;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to like posts';
  END IF;

  SELECT * INTO v_post FROM public.posts WHERE id = p_post_id;
  IF v_post IS NULL THEN
    RAISE EXCEPTION 'Post not found';
  END IF;

  -- If post belongs to a club, verify user is a member
  IF v_post.club_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.club_memberships
      WHERE club_id = v_post.club_id AND user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'Must be a member of the club to like posts';
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.post_likes WHERE post_id = p_post_id AND user_id = v_user_id) THEN
    DELETE FROM public.post_likes WHERE post_id = p_post_id AND user_id = v_user_id;
    v_liked := false;
  ELSE
    INSERT INTO public.post_likes (post_id, user_id) VALUES (p_post_id, v_user_id);
    v_liked := true;
  END IF;

  SELECT likes_count INTO v_count FROM public.posts WHERE id = p_post_id;

  RETURN jsonb_build_object(
    'post_id', p_post_id,
    'liked', v_liked,
    'likes_count', COALESCE(v_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID) TO authenticated;

-- Feed Fetching RPC with Cursor Pagination & Author Hydration
CREATE OR REPLACE FUNCTION public.get_club_feed(
  p_club_id UUID,
  p_limit INTEGER DEFAULT 20,
  p_cursor TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_results JSONB;
BEGIN
  v_user_id := auth.uid();

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'club_id', p.club_id,
      'author_id', p.author_id,
      'content', COALESCE(p.content, p.caption),
      'caption', COALESCE(p.caption, p.content),
      'image_url', p.image_url,
      'status', p.status,
      'likes_count', p.likes_count,
      'comments_count', p.comments_count,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'author', jsonb_build_object(
        'id', prof.id,
        'full_name', prof.full_name,
        'avatar_url', prof.avatar_url
      ),
      'is_vet_verified', COALESCE(vp.verified, false),
      'user_has_liked', CASE 
        WHEN v_user_id IS NULL THEN false
        ELSE EXISTS (
          SELECT 1 FROM public.post_likes pl 
          WHERE pl.post_id = p.id AND pl.user_id = v_user_id
        )
      END
    )
    ORDER BY p.created_at DESC
  ) INTO v_results
  FROM (
    SELECT *
    FROM public.posts
    WHERE club_id = p_club_id
      AND status = 'approved'
      AND (p_cursor IS NULL OR created_at < p_cursor)
    ORDER BY created_at DESC
    LIMIT LEAST(p_limit, 50)
  ) p
  LEFT JOIN public.profiles prof ON prof.id = p.author_id
  LEFT JOIN public.vet_profiles vp ON vp.user_id = p.author_id;

  RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_club_feed(UUID, INTEGER, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION public.get_club_feed(UUID, INTEGER, TIMESTAMPTZ) TO authenticated;

-- Content Moderation RPC (Admins Only)
CREATE OR REPLACE FUNCTION public.moderate_content(
  p_target_type TEXT,
  p_target_id UUID,
  p_action TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_is_admin BOOLEAN;
  v_new_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_is_admin := public.has_role(v_user_id, 'admin'::public.app_role);
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: Administrator role required for moderation';
  END IF;

  IF p_action = 'hide' THEN
    v_new_status := 'hidden';
  ELSIF p_action = 'remove' THEN
    v_new_status := 'removed';
  ELSIF p_action = 'restore' THEN
    v_new_status := 'approved';
  ELSE
    RAISE EXCEPTION 'Invalid moderation action: %', p_action;
  END IF;

  IF p_target_type = 'post' THEN
    UPDATE public.posts
    SET status = v_new_status,
        updated_at = NOW()
    WHERE id = p_target_id;
  ELSIF p_target_type = 'comment' THEN
    UPDATE public.post_comments
    SET status = v_new_status,
        updated_at = NOW()
    WHERE id = p_target_id;
  ELSE
    RAISE EXCEPTION 'Invalid target type: %', p_target_type;
  END IF;

  -- Update associated reports to reviewed/actioned
  UPDATE public.content_reports
  SET status = CASE WHEN v_new_status = 'approved' THEN 'dismissed' ELSE 'actioned' END,
      reviewed_by = v_user_id,
      reviewed_at = NOW(),
      review_notes = p_notes
  WHERE target_type = p_target_type AND target_id = p_target_id;

  RETURN jsonb_build_object(
    'success', true,
    'target_type', p_target_type,
    'target_id', p_target_id,
    'new_status', v_new_status,
    'action', p_action
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.moderate_content(TEXT, UUID, TEXT, TEXT) TO authenticated;

-- ==============================================================================
-- 9. Idempotent Seed Data: Six Pet Clubs
-- ==============================================================================

INSERT INTO public.clubs (slug, name, description, category, cover_image, icon_name)
VALUES
  (
    'dogs',
    'Dogs Club',
    'Everything canine: puppy care, training tips, nutrition, breed discussions, and dog health.',
    'Dogs',
    'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    'Dog'
  ),
  (
    'cats',
    'Cats Club',
    'Feline wellness, behavior insights, playful antics, enrichment, and preventative care.',
    'Cats',
    'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    'Cat'
  ),
  (
    'birds',
    'Birds Club',
    'Avian enthusiasts community: parakeets, parrots, songbirds, nutrition, and flight health.',
    'Birds',
    'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80',
    'Feather'
  ),
  (
    'horses',
    'Horses & Equine Club',
    'Equine management, equestrian training, hoof care, stable practices, and equine veterinary care.',
    'Horses',
    'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    'Compass'
  ),
  (
    'farm-animals',
    'Farm Animals Club',
    'Ruminants, goats, sheep, pigs, and livestock management, biosecurity, and herd health.',
    'Farm Animals',
    'https://images.unsplash.com/photo-1516467508483-a7212febe31a?auto=format&fit=crop&w=800&q=80',
    'Tractor'
  ),
  (
    'poultry',
    'Poultry Club',
    'Chickens, ducks, turkeys, coop management, egg production, flock biosecurity, and avian vitality.',
    'Poultry',
    'https://images.unsplash.com/photo-1548550023-2bdb3c5beed7?auto=format&fit=crop&w=800&q=80',
    'Egg'
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  cover_image = EXCLUDED.cover_image,
  icon_name = EXCLUDED.icon_name,
  is_active = TRUE,
  updated_at = NOW();

-- ==============================================================================
-- 10. Security Notice Compliance: Enable RLS on Auxiliary Tables If Present
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'announcement_reads') THEN
    EXECUTE 'ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'events') THEN
    EXECUTE 'ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;';
  END IF;
END $$;
