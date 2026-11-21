/**
 * Educational Blog Article Type Definitions (M4)
 *
 * Mirrors the `public.articles` table created in migration
 * 20261025120000_m4_community_blogs_events.sql. Authoring is restricted at the
 * database (RLS) layer to verified veterinarians and administrators; drafts and
 * archived articles are hidden from the public via RLS.
 */

export type ArticleStatus = 'draft' | 'published' | 'archived';

export type ArticleCategory =
  | 'Canine Health'
  | 'Feline Nutrition'
  | 'Avian Care'
  | 'Equine Wellness'
  | 'Livestock'
  | 'Preventative'
  | string;

export interface ArticleAuthor {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  cover_image: string | null;
  category: ArticleCategory;
  tags: string[];
  author_id: string;
  status: ArticleStatus;
  published_at: string | null;
  reading_time_minutes: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  author?: ArticleAuthor;
  is_vet_verified?: boolean;
}

export interface CreateArticleDTO {
  slug?: string;
  title: string;
  summary: string;
  content: string;
  cover_image?: string | null;
  category: ArticleCategory;
  tags?: string[];
  status?: ArticleStatus;
  reading_time_minutes?: number;
}

export interface UpdateArticleDTO {
  slug?: string;
  title?: string;
  summary?: string;
  content?: string;
  cover_image?: string | null;
  category?: ArticleCategory;
  tags?: string[];
  status?: ArticleStatus;
  reading_time_minutes?: number;
}

export interface ArticleListResponse {
  articles: Article[];
  hasMore: boolean;
  nextCursor?: string;
}
