-- ==============================================================================
-- Migration: 20261025120000_m4_community_blogs_events.sql
-- Milestone:  M4 — Community Blogs (Articles), Events & Global Community Feed
-- Phase:      1 (Database Schema, Migrations, RLS, Storage, Global Feed Foundation)
--
-- Scope (ADDITIVE ONLY):
--   1. public.articles  — educational blog articles authored by verified vets/admins
--   2. public.events    — community events authored by verified vets/admins
--   3. public.is_verified_vet(uuid) — SECURITY DEFINER helper for RLS role gating
--   4. public.get_community_feed(...) — global + club-aware cursor-paginated feed
--
-- Safety / Backward Compatibility:
--   * No existing table, policy, function, RPC, or seed data is dropped or altered.
--   * get_club_feed and all M1/MVP functionality remain untouched.
--   * Reuses the existing `user-media` storage bucket and its policies unchanged.
--   * Safely repeatable: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS before
--     CREATE POLICY, CREATE OR REPLACE FUNCTION, and guarded index creation.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Role / verification helper (SECURITY DEFINER so RLS subqueries are robust)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_verified_vet(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vet_profiles
    WHERE user_id = _user_id
      AND verified = TRUE
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_verified_vet(UUID) TO authenticated;

-- ==============================================================================
-- 1. Table: public.articles
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 200),
  summary TEXT NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 500),
  content TEXT NOT NULL CHECK (char_length(content) >= 50),
  cover_image TEXT,
  category TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TIMESTAMPTZ,
  reading_time_minutes INTEGER NOT NULL DEFAULT 3 CHECK (reading_time_minutes > 0),
  view_count INTEGER NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_status_published
  ON public.articles(status, published_at DESC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_author ON public.articles(author_id);

GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

DROP TRIGGER IF EXISTS articles_set_updated_at ON public.articles;
CREATE TRIGGER articles_set_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 2. Table: public.events
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 150),
  description TEXT NOT NULL CHECK (char_length(description) >= 20),
  cover_image TEXT,
  category TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'virtual' CHECK (event_type IN ('virtual', 'in_person')),
  location_or_url TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL CHECK (end_time > start_time),
  organizer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organizer_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_status_time
  ON public.events(status, start_time ASC)
  WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_events_category ON public.events(category);
CREATE INDEX IF NOT EXISTS idx_events_organizer ON public.events(organizer_id);

GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==============================================================================
-- 3. Row Level Security
-- ==============================================================================
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ---- Articles RLS --------------------------------------------------------------
-- SELECT: published is public; drafts/archived visible only to the author or admin.
DROP POLICY IF EXISTS "articles_select_public_or_owner" ON public.articles;
CREATE POLICY "articles_select_public_or_owner" ON public.articles
  FOR SELECT
  USING (
    status = 'published'
    OR author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- INSERT: only verified vets or admins, and only as themselves.
DROP POLICY IF EXISTS "articles_insert_vet_or_admin" ON public.articles;
CREATE POLICY "articles_insert_vet_or_admin" ON public.articles
  FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_verified_vet(auth.uid())
    )
  );

-- UPDATE: the author (ownership preserved) or an admin.
DROP POLICY IF EXISTS "articles_update_owner_or_admin" ON public.articles;
CREATE POLICY "articles_update_owner_or_admin" ON public.articles
  FOR UPDATE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- DELETE: the author or an admin.
DROP POLICY IF EXISTS "articles_delete_owner_or_admin" ON public.articles;
CREATE POLICY "articles_delete_owner_or_admin" ON public.articles
  FOR DELETE TO authenticated
  USING (
    author_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ---- Events RLS ----------------------------------------------------------------
-- SELECT: published & completed are public; drafts/cancelled only to organizer/admin.
DROP POLICY IF EXISTS "events_select_public_or_owner" ON public.events;
CREATE POLICY "events_select_public_or_owner" ON public.events
  FOR SELECT
  USING (
    status IN ('published', 'completed')
    OR organizer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- INSERT: only verified vets or admins, and only as themselves.
DROP POLICY IF EXISTS "events_insert_vet_or_admin" ON public.events;
CREATE POLICY "events_insert_vet_or_admin" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    organizer_id = auth.uid()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.is_verified_vet(auth.uid())
    )
  );

-- UPDATE: the organizer (ownership preserved) or an admin.
DROP POLICY IF EXISTS "events_update_owner_or_admin" ON public.events;
CREATE POLICY "events_update_owner_or_admin" ON public.events
  FOR UPDATE TO authenticated
  USING (
    organizer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    organizer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- DELETE: the organizer or an admin.
DROP POLICY IF EXISTS "events_delete_owner_or_admin" ON public.events;
CREATE POLICY "events_delete_owner_or_admin" ON public.events
  FOR DELETE TO authenticated
  USING (
    organizer_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ==============================================================================
-- 4. RPC: public.get_community_feed
--    Global community feed with reverse-chronological cursor pagination and
--    author profile hydration. When p_club_id IS NULL, returns approved posts
--    across ALL clubs AND general posts (club_id IS NULL), so club posts appear
--    in both their club feed and the global feed. When p_club_id is provided,
--    behaves like a club-scoped feed.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_community_feed(
  p_club_id UUID DEFAULT NULL,
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
      'club', CASE
        WHEN c.id IS NOT NULL THEN jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug)
        ELSE NULL
      END,
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
    WHERE (p_club_id IS NULL OR club_id = p_club_id)
      AND status = 'approved'
      AND (p_cursor IS NULL OR created_at < p_cursor)
    ORDER BY created_at DESC
    LIMIT LEAST(p_limit, 50)
  ) p
  LEFT JOIN public.profiles prof ON prof.id = p.author_id
  LEFT JOIN public.vet_profiles vp ON vp.user_id = p.author_id
  LEFT JOIN public.clubs c ON c.id = p.club_id;

  RETURN COALESCE(v_results, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_feed(UUID, INTEGER, TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION public.get_community_feed(UUID, INTEGER, TIMESTAMPTZ) TO authenticated;

-- ==============================================================================
-- 5. RPC: public.increment_article_views
--    Atomic counter increment for published articles callable by general readers
--    (anon & authenticated) without granting direct UPDATE permissions on articles.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.increment_article_views(p_article_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.articles
  SET view_count = view_count + 1
  WHERE id = p_article_id
    AND status = 'published';
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_views(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_article_views(UUID) TO authenticated;

-- ==============================================================================
-- End of Migration 20261025120000_m4_community_blogs_events.sql
-- ==============================================================================

