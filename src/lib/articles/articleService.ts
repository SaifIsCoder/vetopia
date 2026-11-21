/**
 * Educational Blog Article Service (M4)
 * Handles article discovery, searching, category filtering, reading time calculation,
 * and authorized vet/admin publishing workflows with offline fallback support.
 */

import { supabase } from '../supabase/client';
import {
  Article,
  ArticleStatus,
  ArticleAuthor,
  CreateArticleDTO,
  UpdateArticleDTO,
} from '../../types/article';
import {
  AuthError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  normalizeError,
} from '../api/errors';

export const DEFAULT_SEED_ARTICLES: Article[] = [
  {
    id: 'art-canine-parvo-1',
    slug: 'canine-parvovirus-prevention-protocol',
    title: 'Canine Parvovirus: Critical Early Symptoms and Vaccine Timelines',
    summary:
      'A clinical guide on recognizing early gastrointestinal symptoms of parvovirus in puppies and adhering to core vaccine schedules.',
    content:
      'Canine Parvovirus (CPV) is a highly contagious viral illness that affects dogs, particularly puppies between six weeks and six months old. The virus attacks rapidly dividing cells in a dog’s body, most notably the intestinal tract and bone marrow.\n\n### Clinical Manifestations\nEarly clinical signs include severe lethargy, loss of appetite, high fever, and sudden vomiting. Within 24 to 48 hours, hemorrhagic diarrhea develops, rapidly causing dehydration and electrolyte imbalances.\n\n### Vaccination Protocol\nCore vaccination begins at 6–8 weeks of age, followed by boosters every 3–4 weeks until 16 weeks of age. Puppies must be kept away from public ground, dog parks, and unvaccinated dogs until 14 days following their final booster.\n\n### Emergency Triage\nIf your puppy shows acute lethargy or refuses water for over 6 hours, immediately contact a licensed veterinary hospital for an ELISA antigen test and IV fluid support.',
    cover_image:
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    category: 'Canine Health',
    tags: ['Puppy Care', 'Vaccines', 'Infectious Disease', 'Emergency'],
    author_id: 'seed-vet-author-1',
    status: 'published',
    published_at: '2026-10-15T09:00:00Z',
    reading_time_minutes: 4,
    view_count: 142,
    created_at: '2026-10-15T08:00:00Z',
    updated_at: '2026-10-15T09:00:00Z',
    author: {
      id: 'seed-vet-author-1',
      full_name: 'Dr. Sarah Wilson, DVM',
      avatar_url: null,
    },
    is_vet_verified: true,
  },
  {
    id: 'art-feline-hydration-2',
    slug: 'feline-urinary-health-and-hydration',
    title: 'Feline Lower Urinary Tract Disease & Optimal Hydration Strategies',
    summary:
      'How moisture-rich diets and fountain enrichment prevent chronic renal disease and FLUTD blockages in indoor domestic cats.',
    content:
      'Cats evolved as desert carnivores with a naturally low thirst drive, deriving most of their water from prey. In domestic environments, dry kibble diets can lead to chronic sub-clinical dehydration, predisposing cats to Feline Lower Urinary Tract Disease (FLUTD) and idiopathic cystitis.\n\n### Warning Signs\nLook for frequent trips to the litter box, straining (stranguria), vocalization during urination, or blood in the urine (hematuria). In male cats, urethral blockage is a fatal medical emergency requiring immediate de-obstruction.\n\n### Actionable Prevention\n1. Transition to wet or raw moisture-rich food providing at least 75% moisture.\n2. Place circulating water fountains away from food bowls.\n3. Add clean water or low-sodium bone broth to daily meals.\n4. Maintain multiple clean litter boxes in low-stress household zones.',
    cover_image:
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    category: 'Feline Nutrition',
    tags: ['Cats', 'Hydration', 'Renal Health', 'FLUTD'],
    author_id: 'seed-vet-author-2',
    status: 'published',
    published_at: '2026-10-18T14:30:00Z',
    reading_time_minutes: 5,
    view_count: 98,
    created_at: '2026-10-18T12:00:00Z',
    updated_at: '2026-10-18T14:30:00Z',
    author: {
      id: 'seed-vet-author-2',
      full_name: 'Dr. Michael Chen, DACVIM',
      avatar_url: null,
    },
    is_vet_verified: true,
  },
  {
    id: 'art-avian-respiratory-3',
    slug: 'avian-air-quality-and-toxins',
    title: 'Avian Respiratory Safety: Household Aerosols, PTFE, and Smoke Hazards',
    summary:
      'Why avian respiratory air sacs make parrots and songbirds hypersensitive to non-stick cookware fumes and volatile chemical toxins.',
    content:
      'The avian respiratory system is exceptionally efficient, featuring air sacs that pump air unidirectionally through the lungs. However, this high efficiency means birds absorb airborne toxins far more rapidly and severely than mammals.\n\n### Polymer Fume Fever (Teflon / PTFE Toxicity)\nOverheated non-stick cookware containing polytetrafluoroethylene (PTFE) emits odorless toxic gases that cause acute pulmonary edema and sudden death in pet birds within minutes.\n\n### Safe Environmental Practices\n* Completely eliminate PTFE/Teflon cookware, self-cleaning oven cycles, and scented candles.\n* Never use aerosol sprays, plug-in air fresheners, or harsh chemical cleaners near bird enclosures.\n* Ensure HEPA air filtration in living rooms and bird housing areas.',
    cover_image:
      'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=800&q=80',
    category: 'Avian Care',
    tags: ['Birds', 'Toxins', 'Air Quality', 'Safety'],
    author_id: 'seed-vet-author-1',
    status: 'published',
    published_at: '2026-10-20T10:00:00Z',
    reading_time_minutes: 4,
    view_count: 65,
    created_at: '2026-10-20T09:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    author: {
      id: 'seed-vet-author-1',
      full_name: 'Dr. Sarah Wilson, DVM',
      avatar_url: null,
    },
    is_vet_verified: true,
  },
  {
    id: 'art-equine-colic-4',
    slug: 'equine-colic-identification-and-management',
    title: 'Recognizing Equine Colic: Early Identification and Stable Management',
    summary:
      'Essential guidance for horse owners on detecting abdominal distress, checking vital signs, and immediate response protocols.',
    content:
      'Colic is a general term describing abdominal pain in equines. Because horses cannot vomit and have a long, mobile digestive tract, gastrointestinal distress can quickly escalate into a life-threatening crisis.\n\n### Recognizing Colic Signs\n* Pawing at the ground, looking at the flank, or kicking at the abdomen.\n* Repeated lying down and rolling, especially violent thrashing.\n* Elevated pulse (resting equine heart rate above 44–50 bpm indicates moderate to severe pain).\n* Absence of normal gut sounds (borborygmi) in four abdominal quadrants.\n\n### Immediate Protocol\n1. Remove all food and grain immediately.\n2. Check and record temperature, pulse, and respiration (TPR).\n3. Call your equine veterinarian without delay before administering banamine or sedatives, as NSAIDs can mask diagnostic signs.',
    cover_image:
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    category: 'Equine Wellness',
    tags: ['Horses', 'Equine Care', 'Colic', 'Emergency'],
    author_id: 'seed-vet-author-3',
    status: 'published',
    published_at: '2026-10-21T11:00:00Z',
    reading_time_minutes: 5,
    view_count: 83,
    created_at: '2026-10-21T10:00:00Z',
    updated_at: '2026-10-21T11:00:00Z',
    author: {
      id: 'seed-vet-author-3',
      full_name: 'Dr. Elena Rostova, Equine Surgeon',
      avatar_url: null,
    },
    is_vet_verified: true,
  },
];

export class ArticleService {
  /**
   * Helper: Calculate reading time in minutes based on ~200 wpm
   */
  calculateReadingTime(content: string): number {
    if (!content) return 1;
    const wordCount = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(wordCount / 200));
  }

  /**
   * Helper: Generate URL-safe slug from title
   */
  generateSlug(title: string, addSuffix = false): string {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);
    if (!addSuffix) return baseSlug;
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${baseSlug}-${randomSuffix}`;
  }

  /**
   * Helper: Check if user is an administrator
   */
  async verifyAdminRole(userId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      return Boolean(data);
    } catch {
      return false;
    }
  }

  /**
   * Verify if a user is a verified veterinarian or administrator
   */
  async verifyAuthorPermission(userId: string): Promise<boolean> {
    try {
      if (await this.verifyAdminRole(userId)) return true;

      // Check verified vet profile
      const { data: vetData } = await supabase
        .from('vet_profiles')
        .select('verified')
        .eq('user_id', userId)
        .maybeSingle();

      return Boolean(vetData?.verified);
    } catch {
      return false;
    }
  }

  /**
   * Fetch published articles with search and category filtering.
   * If author requests, can also return their own drafts.
   */
  async getArticles(
    search?: string,
    category?: string,
    status: ArticleStatus = 'published',
  ): Promise<Article[]> {
    try {
      let query = supabase
        .from('articles')
        .select(`
          id,
          slug,
          title,
          summary,
          content,
          cover_image,
          category,
          tags,
          author_id,
          status,
          published_at,
          reading_time_minutes,
          view_count,
          created_at,
          updated_at,
          author:profiles!articles_author_id_fkey(id, full_name, avatar_url)
        `)
        .order('published_at', { ascending: false, nullsFirst: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (category && category.trim().toLowerCase() !== 'all') {
        query = query.ilike('category', `%${category.trim()}%`);
      }

      if (search && search.trim()) {
        const clean = search.trim();
        query = query.or(`title.ilike.%${clean}%,summary.ilike.%${clean}%,category.ilike.%${clean}%`);
      }

      const { data, error } = await query;
      if (error) throw normalizeError(error);

      const articlesList = (data || []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        content: row.content,
        cover_image: row.cover_image,
        category: row.category,
        tags: Array.isArray(row.tags) ? row.tags : [],
        author_id: row.author_id,
        status: row.status,
        published_at: row.published_at,
        reading_time_minutes: row.reading_time_minutes || 3,
        view_count: row.view_count || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        author: row.author,
        is_vet_verified: true,
      }));

      return articlesList;
    } catch (err: any) {
      // Graceful offline fallback
      const isNetwork =
        err?.name === 'NetworkError' ||
        err?.message?.includes('Network') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('relation "public.articles" does not exist') ||
        err?.code === 'NETWORK_ERROR' ||
        err?.code === '42P01';

      if (isNetwork) {
        let results = DEFAULT_SEED_ARTICLES;
        if (category && category.trim().toLowerCase() !== 'all') {
          const catLower = category.trim().toLowerCase();
          results = results.filter((a) => a.category.toLowerCase().includes(catLower));
        }
        if (search && search.trim()) {
          const qLower = search.trim().toLowerCase();
          results = results.filter(
            (a) =>
              a.title.toLowerCase().includes(qLower) ||
              a.summary.toLowerCase().includes(qLower) ||
              a.category.toLowerCase().includes(qLower) ||
              a.tags.some((t) => t.toLowerCase().includes(qLower)),
          );
        }
        return results;
      }
      throw normalizeError(err);
    }
  }

  /**
   * Fetch single article by UUID or slug
   */
  async getArticleByIdOrSlug(idOrSlug: string): Promise<Article> {
    try {
      if (!idOrSlug) throw new ValidationError('Article identifier is required.');

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );

      let query = supabase
        .from('articles')
        .select(`
          id,
          slug,
          title,
          summary,
          content,
          cover_image,
          category,
          tags,
          author_id,
          status,
          published_at,
          reading_time_minutes,
          view_count,
          created_at,
          updated_at,
          author:profiles!articles_author_id_fkey(id, full_name, avatar_url)
        `);

      if (isUuid) {
        query = query.eq('id', idOrSlug);
      } else {
        query = query.eq('slug', idOrSlug);
      }

      const { data, error } = await query.single();
      if (error || !data) {
        // Fallback check in seed articles
        const seed = DEFAULT_SEED_ARTICLES.find(
          (a) => a.id === idOrSlug || a.slug === idOrSlug,
        );
        if (seed) return seed;
        throw new NotFoundError('The requested educational article could not be found.');
      }

      // Check author verification
      let isVetVerified = false;
      const { data: vetData } = await supabase
        .from('vet_profiles')
        .select('verified')
        .eq('user_id', data.author_id)
        .maybeSingle();

      if (vetData?.verified) {
        isVetVerified = true;
      }

      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        content: data.content,
        cover_image: data.cover_image,
        category: data.category,
        tags: Array.isArray(data.tags) ? data.tags : [],
        author_id: data.author_id,
        status: data.status,
        published_at: data.published_at,
        reading_time_minutes: data.reading_time_minutes || 3,
        view_count: data.view_count || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: (Array.isArray(data.author) ? data.author[0] : data.author) as ArticleAuthor | undefined,
        is_vet_verified: isVetVerified,
      };
    } catch (err: any) {
      const seed = DEFAULT_SEED_ARTICLES.find(
        (a) => a.id === idOrSlug || a.slug === idOrSlug,
      );
      if (seed) return seed;
      throw normalizeError(err);
    }
  }

  /**
   * Create educational article (Restricted to verified vets & admins)
   */
  async createArticle(input: CreateArticleDTO): Promise<Article> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to author articles.');
      }

      // Input validation according to database constraints
      if (!input.title || input.title.trim().length < 3 || input.title.trim().length > 200) {
        throw new ValidationError('Article title must be between 3 and 200 characters.');
      }

      if (!input.summary || input.summary.trim().length < 10 || input.summary.trim().length > 500) {
        throw new ValidationError('Article summary must be between 10 and 500 characters.');
      }

      if (!input.content || input.content.trim().length < 50) {
        throw new ValidationError('Article content must contain at least 50 characters.');
      }

      if (!input.category || !input.category.trim()) {
        throw new ValidationError('A valid article category is required.');
      }

      // Server/RLS aligned permission check
      const hasPermission = await this.verifyAuthorPermission(session.user.id);
      if (!hasPermission) {
        throw new ForbiddenError(
          'Authoring articles is restricted to verified veterinarians and administrators.',
        );
      }

      const status = input.status || 'draft';
      const readingTime =
        input.reading_time_minutes || this.calculateReadingTime(input.content);
      const slug = input.slug || this.generateSlug(input.title);
      const publishedAt = status === 'published' ? new Date().toISOString() : null;

      const payload = {
        slug,
        title: input.title.trim(),
        summary: input.summary.trim(),
        content: input.content.trim(),
        cover_image: input.cover_image || null,
        category: input.category.trim(),
        tags: input.tags || [],
        author_id: session.user.id,
        status,
        published_at: publishedAt,
        reading_time_minutes: readingTime,
        view_count: 0,
      };

      const { data, error } = await supabase
        .from('articles')
        .insert(payload)
        .select(`
          id,
          slug,
          title,
          summary,
          content,
          cover_image,
          category,
          tags,
          author_id,
          status,
          published_at,
          reading_time_minutes,
          view_count,
          created_at,
          updated_at,
          author:profiles!articles_author_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw normalizeError(error);

      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        content: data.content,
        cover_image: data.cover_image,
        category: data.category,
        tags: Array.isArray(data.tags) ? data.tags : [],
        author_id: data.author_id,
        status: data.status,
        published_at: data.published_at,
        reading_time_minutes: data.reading_time_minutes,
        view_count: data.view_count || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: (Array.isArray(data.author) ? data.author[0] : data.author) as ArticleAuthor | undefined,
        is_vet_verified: true,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Update educational article (Author or Admin)
   */
  async updateArticle(articleId: string, input: UpdateArticleDTO): Promise<Article> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to edit articles.');
      }

      if (input.title !== undefined && (input.title.trim().length < 3 || input.title.trim().length > 200)) {
        throw new ValidationError('Article title must be between 3 and 200 characters.');
      }

      if (input.summary !== undefined && (input.summary.trim().length < 10 || input.summary.trim().length > 500)) {
        throw new ValidationError('Article summary must be between 10 and 500 characters.');
      }

      if (input.content !== undefined && input.content.trim().length < 50) {
        throw new ValidationError('Article content must contain at least 50 characters.');
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) updatePayload.title = input.title.trim();
      if (input.summary !== undefined) updatePayload.summary = input.summary.trim();
      if (input.content !== undefined) {
        updatePayload.content = input.content.trim();
        updatePayload.reading_time_minutes =
          input.reading_time_minutes || this.calculateReadingTime(input.content);
      }
      if (input.cover_image !== undefined) updatePayload.cover_image = input.cover_image;
      if (input.category !== undefined) updatePayload.category = input.category.trim();
      if (input.tags !== undefined) updatePayload.tags = input.tags;
      if (input.status !== undefined) {
        updatePayload.status = input.status;
        if (input.status === 'published') {
          updatePayload.published_at = new Date().toISOString();
        }
      }

      const { data, error } = await supabase
        .from('articles')
        .update(updatePayload)
        .eq('id', articleId)
        .select(`
          id,
          slug,
          title,
          summary,
          content,
          cover_image,
          category,
          tags,
          author_id,
          status,
          published_at,
          reading_time_minutes,
          view_count,
          created_at,
          updated_at,
          author:profiles!articles_author_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw normalizeError(error);

      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        summary: data.summary,
        content: data.content,
        cover_image: data.cover_image,
        category: data.category,
        tags: Array.isArray(data.tags) ? data.tags : [],
        author_id: data.author_id,
        status: data.status,
        published_at: data.published_at,
        reading_time_minutes: data.reading_time_minutes,
        view_count: data.view_count || 0,
        created_at: data.created_at,
        updated_at: data.updated_at,
        author: (Array.isArray(data.author) ? data.author[0] : data.author) as ArticleAuthor | undefined,
        is_vet_verified: true,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Delete article (Author or Admin)
   */
  async deleteArticle(articleId: string): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to delete articles.');
      }

      const article = await this.getArticleByIdOrSlug(articleId);
      const isAdmin = await this.verifyAdminRole(session.user.id);
      if (article.author_id !== session.user.id && !isAdmin) {
        throw new ForbiddenError('You can only delete your own articles.');
      }

      const { error } = await supabase.from('articles').delete().eq('id', articleId);
      if (error) throw normalizeError(error);
      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Increment article view count atomically via RPC.
   * If the RPC is unavailable (e.g. migration pending), falls back to direct update.
   */
  async incrementViewCount(articleId: string): Promise<void> {
    try {
      // 1. Primary: Atomic increment RPC
      const { error: rpcError } = await supabase.rpc('increment_article_views', {
        p_article_id: articleId,
      });

      if (!rpcError) return;

      // 2. Fallback: Direct read-modify-update (for author/admin or local testing)
      const { data: current } = await supabase
        .from('articles')
        .select('view_count')
        .eq('id', articleId)
        .single();

      if (current) {
        await supabase
          .from('articles')
          .update({ view_count: (current.view_count || 0) + 1 })
          .eq('id', articleId);
      }
    } catch {
      // Non-critical background telemetry
    }
  }

  /**
   * Fetch articles authored by the current user (includes drafts & archived)
   */
  async getMyArticles(): Promise<Article[]> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return [];

      const { data, error } = await supabase
        .from('articles')
        .select(`
          id,
          slug,
          title,
          summary,
          content,
          cover_image,
          category,
          tags,
          author_id,
          status,
          published_at,
          reading_time_minutes,
          view_count,
          created_at,
          updated_at,
          author:profiles!articles_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false });

      if (error) throw normalizeError(error);

      return (data || []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        summary: row.summary,
        content: row.content,
        cover_image: row.cover_image,
        category: row.category,
        tags: Array.isArray(row.tags) ? row.tags : [],
        author_id: row.author_id,
        status: row.status,
        published_at: row.published_at,
        reading_time_minutes: row.reading_time_minutes || 3,
        view_count: row.view_count || 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        author: row.author,
        is_vet_verified: true,
      }));
    } catch (err) {
      throw normalizeError(err);
    }
  }
}

export const articleService = new ArticleService();
