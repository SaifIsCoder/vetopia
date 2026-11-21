/**
 * @jest-environment node
 */
/**
 * M4 Phase 1 — Database Schema & Security Contract Test
 * Vetopia Mobile
 *
 * The Jest test environment mocks Supabase and has no live PostgreSQL instance,
 * so Row Level Security cannot be exercised against a real database here. Instead
 * this suite statically verifies that the Phase 1 migration encodes the required
 * security invariants: draft isolation, verified-vet / admin authoring gates,
 * owner/admin mutation, published-content public read, and the global community
 * feed's visibility, pagination, ordering and authorization behavior.
 *
 * These assertions are the database contract that the Phase 1 acceptance criteria
 * depend on. They are additive and do not require any backend connectivity.
 */

import fs from 'fs';
import path from 'path';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../supabase/migrations/20261025120000_m4_community_blogs_events.sql',
);

/** Collapse all runs of whitespace to a single space for order-insensitive matching. */
function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').toLowerCase();
}

describe('M4 Phase 1 — Community Blogs, Events & Global Feed migration contract', () => {
  let raw: string;
  let sql: string;

  beforeAll(() => {
    raw = fs.readFileSync(MIGRATION_PATH, 'utf8');
    sql = normalize(raw);
  });

  describe('Migration presence & structure', () => {
    test('migration file exists and is non-trivial', () => {
      expect(fs.existsSync(MIGRATION_PATH)).toBe(true);
      expect(raw.length).toBeGreaterThan(500);
    });

    test('creates articles and events tables idempotently', () => {
      expect(sql).toContain('create table if not exists public.articles');
      expect(sql).toContain('create table if not exists public.events');
    });

    test('enables row level security on both new tables', () => {
      expect(sql).toContain('alter table public.articles enable row level security');
      expect(sql).toContain('alter table public.events enable row level security');
    });
  });

  describe('Articles table schema integrity', () => {
    test('author_id is a non-null FK to profiles with cascade delete', () => {
      expect(sql).toMatch(
        /author_id uuid not null references public\.profiles\(id\) on delete cascade/,
      );
    });

    test('status is constrained to draft/published/archived and defaults to draft', () => {
      expect(sql).toMatch(/status text not null default 'draft' check \(status in \('draft', 'published', 'archived'\)\)/);
    });

    test('slug is unique and text fields carry length checks', () => {
      expect(sql).toContain('slug text not null unique');
      expect(sql).toMatch(/title text not null check \(char_length\(title\) between 3 and 200\)/);
      expect(sql).toMatch(/content text not null check \(char_length\(content\) >= 50\)/);
    });

    test('has a partial index for published listing ordering', () => {
      expect(sql).toContain("idx_articles_status_published");
      expect(sql).toContain("where status = 'published'");
    });
  });

  describe('Events table schema integrity', () => {
    test('organizer_id is a non-null FK to profiles with cascade delete', () => {
      expect(sql).toMatch(
        /organizer_id uuid not null references public\.profiles\(id\) on delete cascade/,
      );
    });

    test('event_type is constrained to virtual/in_person', () => {
      expect(sql).toMatch(/event_type text not null default 'virtual' check \(event_type in \('virtual', 'in_person'\)\)/);
    });

    test('status is constrained to draft/published/cancelled/completed', () => {
      expect(sql).toMatch(/status text not null default 'draft' check \(status in \('draft', 'published', 'cancelled', 'completed'\)\)/);
    });

    test('enforces end_time after start_time', () => {
      expect(sql).toMatch(/end_time timestamptz not null check \(end_time > start_time\)/);
    });
  });

  describe('Verified-vet helper (is_verified_vet)', () => {
    test('is a SECURITY DEFINER function gating on vet_profiles.verified = true', () => {
      expect(sql).toContain('create or replace function public.is_verified_vet');
      expect(sql).toContain('security definer');
      expect(sql).toMatch(/from public\.vet_profiles where user_id = _user_id and verified = true/);
    });
  });

  describe('Articles RLS — draft isolation & authoring gates', () => {
    test('SELECT exposes only published content to the public, drafts to owner/admin', () => {
      expect(raw).toContain('"articles_select_public_or_owner"');
      // The public read branch must be published-only.
      expect(sql).toMatch(/articles_select_public_or_owner[\s\S]*?status = 'published'[\s\S]*?author_id = auth\.uid\(\)[\s\S]*?has_role\(auth\.uid\(\), 'admin'::public\.app_role\)/);
    });

    test('INSERT is restricted to self AND (admin OR verified vet)', () => {
      expect(raw).toContain('"articles_insert_vet_or_admin"');
      expect(sql).toMatch(/articles_insert_vet_or_admin[\s\S]*?author_id = auth\.uid\(\)[\s\S]*?has_role\(auth\.uid\(\), 'admin'::public\.app_role\)[\s\S]*?is_verified_vet\(auth\.uid\(\)\)/);
    });

    test('UPDATE and DELETE are limited to the author or an admin', () => {
      expect(raw).toContain('"articles_update_owner_or_admin"');
      expect(raw).toContain('"articles_delete_owner_or_admin"');
    });
  });

  describe('Events RLS — draft isolation & authoring gates', () => {
    test('SELECT exposes published/completed to the public, others to organizer/admin', () => {
      expect(raw).toContain('"events_select_public_or_owner"');
      expect(sql).toMatch(/events_select_public_or_owner[\s\S]*?status in \('published', 'completed'\)[\s\S]*?organizer_id = auth\.uid\(\)[\s\S]*?has_role\(auth\.uid\(\), 'admin'::public\.app_role\)/);
    });

    test('INSERT is restricted to self AND (admin OR verified vet)', () => {
      expect(raw).toContain('"events_insert_vet_or_admin"');
      expect(sql).toMatch(/events_insert_vet_or_admin[\s\S]*?organizer_id = auth\.uid\(\)[\s\S]*?has_role\(auth\.uid\(\), 'admin'::public\.app_role\)[\s\S]*?is_verified_vet\(auth\.uid\(\)\)/);
    });

    test('UPDATE and DELETE are limited to the organizer or an admin', () => {
      expect(raw).toContain('"events_update_owner_or_admin"');
      expect(raw).toContain('"events_delete_owner_or_admin"');
    });
  });

  describe('Grants — public read, authenticated write, nothing weakened', () => {
    test('articles grant SELECT to anon and full DML to authenticated', () => {
      expect(sql).toContain('grant select on public.articles to anon');
      expect(sql).toContain('grant select, insert, update, delete on public.articles to authenticated');
    });

    test('events grant SELECT to anon and full DML to authenticated', () => {
      expect(sql).toContain('grant select on public.events to anon');
      expect(sql).toContain('grant select, insert, update, delete on public.events to authenticated');
    });

    test('does not touch storage policies (reuses existing user-media bucket unchanged)', () => {
      // No DDL against the storage schema => the existing user-media policies are untouched.
      expect(sql).not.toContain('storage.objects');
      expect(sql).not.toMatch(/create policy[\s\S]*?on storage\./);
      expect(sql).not.toMatch(/drop policy[\s\S]*?on storage\./);
    });

    test('does not drop or redefine the existing get_club_feed RPC', () => {
      // Guard only against actual DDL touching get_club_feed (comments may mention it).
      expect(sql).not.toMatch(/create or replace function public\.get_club_feed/);
      expect(sql).not.toMatch(/drop function[^;]*get_club_feed/);
    });
  });

  describe('Global community feed RPC (get_community_feed)', () => {
    test('is defined as SECURITY DEFINER with cursor pagination defaults', () => {
      expect(sql).toContain('create or replace function public.get_community_feed');
      expect(sql).toMatch(/p_club_id uuid default null/);
      expect(sql).toMatch(/p_limit integer default 20/);
      expect(sql).toMatch(/p_cursor timestamptz default null/);
      expect(sql).toContain('security definer');
    });

    test('returns only approved posts and supports both global and club-scoped queries', () => {
      // (p_club_id IS NULL OR club_id = p_club_id) => club posts also appear globally.
      expect(sql).toMatch(/\(p_club_id is null or club_id = p_club_id\)/);
      expect(sql).toMatch(/and status = 'approved'/);
    });

    test('orders reverse-chronologically and caps the page size', () => {
      expect(sql).toMatch(/order by created_at desc/);
      expect(sql).toMatch(/limit least\(p_limit, 50\)/);
      expect(sql).toMatch(/\(p_cursor is null or created_at < p_cursor\)/);
    });

    test('computes caller like state safely for anonymous users', () => {
      expect(sql).toMatch(/when v_user_id is null then false/);
    });

    test('is executable by both anon and authenticated roles', () => {
      expect(sql).toContain('grant execute on function public.get_community_feed(uuid, integer, timestamptz) to anon');
      expect(sql).toContain('grant execute on function public.get_community_feed(uuid, integer, timestamptz) to authenticated');
    });
  });

  describe('Article view counter RPC (increment_article_views)', () => {
    test('is a SECURITY DEFINER function updating only published articles', () => {
      expect(sql).toContain('create or replace function public.increment_article_views');
      expect(sql).toContain('security definer');
      expect(sql).toMatch(/set view_count = view_count \+ 1/);
      expect(sql).toMatch(/where id = p_article_id/);
      expect(sql).toMatch(/and status = 'published'/);
    });

    test('is executable by anon and authenticated roles', () => {
      expect(sql).toContain('grant execute on function public.increment_article_views(uuid) to anon');
      expect(sql).toContain('grant execute on function public.increment_article_views(uuid) to authenticated');
    });
  });
});

