import { articleService } from '../../src/lib/articles/articleService';
import { supabase } from '../../src/lib/supabase/client';
import {
  AuthError,
  ValidationError,
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
    },
  };
});

describe('ArticleService — Comprehensive Unit & Security Tests', () => {
  const mockPetParent = { id: 'user-parent-1', email: 'parent@example.com' };
  const mockVet = { id: 'user-vet-1', email: 'vet@vetopia.com' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Utility Functions: Slugs & Reading Time', () => {
    test('generateSlug produces URL-friendly lowercase slugs', () => {
      const slug = articleService.generateSlug('Managing Feline Osteoarthritis: 2026 Clinical Guide!');
      expect(slug).toBe('managing-feline-osteoarthritis-2026-clinical-guide');
    });

    test('generateSlug handles special characters and multiple spaces', () => {
      const slug = articleService.generateSlug('  Dog Care & Nutrition: Tips & Tricks!  ');
      expect(slug).toBe('dog-care-nutrition-tips-tricks');
    });

    test('calculateReadingTime computes accurate estimates (min 1 minute)', () => {
      expect(articleService.calculateReadingTime('Short text with ten words total for a quick check.')).toBe(1);

      // ~500 words should be ~2-3 minutes at 200 wpm
      const words500 = new Array(500).fill('clinical').join(' ');
      expect(articleService.calculateReadingTime(words500)).toBe(3);
    });
  });

  describe('2. Article Discovery & Search Filtering', () => {
    test('getArticles retrieves published articles from Supabase', async () => {
      const mockData = [
        {
          id: 'art-1',
          slug: 'senior-dog-health',
          title: 'Senior Dog Health',
          summary: 'A clinical guide for senior dogs.',
          content: 'Full article text containing clinical instructions...',
          cover_image: null,
          category: 'Canine Health',
          tags: ['senior', 'canine'],
          author_id: 'user-vet-1',
          status: 'published',
          published_at: '2026-10-20T00:00:00Z',
          reading_time_minutes: 4,
          view_count: 120,
          created_at: '2026-10-20T00:00:00Z',
          updated_at: '2026-10-20T00:00:00Z',
          author: { id: 'user-vet-1', full_name: 'Dr. Smith', avatar_url: null },
        },
      ];

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        or: jest.fn().mockResolvedValue({ data: mockData, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const articles = await articleService.getArticles('Senior', 'Canine Health');
      expect(supabase.from).toHaveBeenCalledWith('articles');
      expect(articles).toHaveLength(1);
      expect(articles[0].slug).toBe('senior-dog-health');
      expect(articles[0].is_vet_verified).toBe(true);
    });

    test('falls back gracefully to DEFAULT_SEED_ARTICLES when table does not exist', async () => {
      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({
            data: null,
            error: { code: '42P01', message: 'relation "articles" does not exist' },
          }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const articles = await articleService.getArticles();
      expect(articles.length).toBeGreaterThan(0);
      expect(articles[0].title).toBeDefined();
    });

    test('getArticleByIdOrSlug returns single article by slug with fallback', async () => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42P01', message: 'relation does not exist' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const article = await articleService.getArticleByIdOrSlug(
        'canine-parvovirus-prevention-protocol',
      );
      expect(article).toBeDefined();
      expect(article.title).toContain('Parvovirus');
    });

    test('incrementViewCount updates article view count via atomic RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });
      await expect(articleService.incrementViewCount('art-1')).resolves.not.toThrow();
      expect(supabase.rpc).toHaveBeenCalledWith('increment_article_views', {
        p_article_id: 'art-1',
      });
    });
  });

  describe('3. Validation Rules', () => {
    test('createArticle validates title length (3 to 200 chars)', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      await expect(
        articleService.createArticle({
          title: 'Hi',
          summary: 'Valid summary text that meets length minimums.',
          content: 'Valid content that has more than 50 characters in its body for review.',
          category: 'Canine Health',
        }),
      ).rejects.toThrow(ValidationError);
    });

    test('createArticle validates summary length (10 to 500 chars)', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      await expect(
        articleService.createArticle({
          title: 'Valid Medical Title',
          summary: 'Too short',
          content: 'Valid content that has more than 50 characters in its body for review.',
          category: 'Canine Health',
        }),
      ).rejects.toThrow(ValidationError);
    });

    test('createArticle validates content length (>= 50 chars)', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      await expect(
        articleService.createArticle({
          title: 'Valid Medical Title',
          summary: 'Valid summary text that meets length minimums.',
          content: 'Short content',
          category: 'Canine Health',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('4. Authorization & Security Enforcement', () => {
    test('createArticle rejects unauthenticated requests with AuthError', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(
        articleService.createArticle({
          title: 'Valid Title Here',
          summary: 'Valid summary of adequate length for submission.',
          content: 'Valid content that satisfies the minimum requirement of fifty characters.',
          category: 'Canine Health',
        }),
      ).rejects.toThrow(AuthError);
    });

    test('createArticle rejects non-vet and non-admin with ForbiddenError', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockPetParent } },
      });

      // Mock user_roles returns only pet_parent
      const rolesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ role: 'pet_parent' }], error: null }),
      };

      // Mock vet_profiles returns null or unverified
      const vetBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_roles') return rolesBuilder;
        if (table === 'vet_profiles') return vetBuilder;
        return {};
      });

      await expect(
        articleService.createArticle({
          title: 'Valid Title Here',
          summary: 'Valid summary of adequate length for submission.',
          content: 'Valid content that satisfies the minimum requirement of fifty characters.',
          category: 'Canine Health',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    test('verified veterinarian can create article successfully', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      const rolesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      const vetBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { verified: true }, error: null }),
      };

      const createdArticleRow = {
        id: 'new-art-1',
        slug: 'valid-title-here',
        title: 'Valid Title Here',
        summary: 'Valid summary of adequate length for submission.',
        content: 'Valid content that satisfies the minimum requirement of fifty characters.',
        cover_image: null,
        category: 'Canine Health',
        tags: [],
        author_id: mockVet.id,
        status: 'published',
        published_at: new Date().toISOString(),
        reading_time_minutes: 1,
        view_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        author: { id: mockVet.id, full_name: 'Dr. Vet', avatar_url: null },
      };

      const articlesBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createdArticleRow, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_roles') return rolesBuilder;
        if (table === 'vet_profiles') return vetBuilder;
        if (table === 'articles') return articlesBuilder;
        return {};
      });

      const result = await articleService.createArticle({
        title: 'Valid Title Here',
        summary: 'Valid summary of adequate length for submission.',
        content: 'Valid content that satisfies the minimum requirement of fifty characters.',
        category: 'Canine Health',
      });

      expect(result.id).toBe('new-art-1');
      expect(result.author_id).toBe(mockVet.id);
      expect(result.is_vet_verified).toBe(true);
    });
  });

  describe('5. Update & Delete Management', () => {
    test('author can update existing article', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      const existingArticleRow = {
        id: 'art-edit-1',
        author_id: mockVet.id,
        status: 'published',
      };



      const rolesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ role: 'vet' }], error: null }),
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            ...existingArticleRow,
            title: 'Updated Title',
            summary: 'Updated summary of sufficient length.',
            content: 'Updated content body containing at least fifty characters for test.',
            category: 'Canine Health',
            tags: [],
            cover_image: null,
            published_at: null,
            reading_time_minutes: 2,
            view_count: 5,
            created_at: '2026-10-24T00:00:00Z',
            updated_at: '2026-10-24T00:00:00Z',
            author: { id: mockVet.id, full_name: 'Dr. Vet', avatar_url: null },
          },
          error: null,
        }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_roles') return rolesBuilder;
        if (table === 'articles') return updateBuilder;
        return {};
      });

      // Spy on getArticleByIdOrSlug
      jest.spyOn(articleService, 'getArticleByIdOrSlug').mockResolvedValue({
        id: 'art-edit-1',
        slug: 'art-edit-1',
        title: 'Original Title',
        summary: 'Original summary of length.',
        content: 'Original content of length greater than fifty characters.',
        cover_image: null,
        category: 'Canine Health',
        tags: [],
        author_id: mockVet.id,
        status: 'published',
        published_at: null,
        reading_time_minutes: 1,
        view_count: 0,
        created_at: '',
        updated_at: '',
      });

      const updated = await articleService.updateArticle('art-edit-1', {
        title: 'Updated Title',
        summary: 'Updated summary of sufficient length.',
        content: 'Updated content body containing at least fifty characters for test.',
      });

      expect(updated.title).toBe('Updated Title');
    });

    test('deleteArticle throws ForbiddenError if not author or admin', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockPetParent } },
      });

      jest.spyOn(articleService, 'getArticleByIdOrSlug').mockResolvedValue({
        id: 'art-delete-1',
        slug: 'art-delete-1',
        title: 'Delete Test',
        summary: 'Summary test text.',
        content: 'Content test text of sufficient length for the test.',
        cover_image: null,
        category: 'Canine Health',
        tags: [],
        author_id: mockVet.id, // owned by vet, not pet parent
        status: 'published',
        published_at: null,
        reading_time_minutes: 1,
        view_count: 0,
        created_at: '',
        updated_at: '',
      });

      const rolesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(rolesBuilder);

      await expect(articleService.deleteArticle('art-delete-1')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  describe('7. Article View Counter — Atomic RPC & Telemetry', () => {
    test('incrementViewCount invokes increment_article_views RPC', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: null, error: null });

      await articleService.incrementViewCount('art-test-123');

      expect(supabase.rpc).toHaveBeenCalledWith('increment_article_views', {
        p_article_id: 'art-test-123',
      });
    });

    test('incrementViewCount falls back to direct query when RPC returns error', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'function increment_article_views does not exist' },
      });

      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { view_count: 7 }, error: null }),
        update: jest.fn().mockReturnThis(),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      await articleService.incrementViewCount('art-test-123');

      expect(supabase.rpc).toHaveBeenCalledWith('increment_article_views', {
        p_article_id: 'art-test-123',
      });
    });
  });
});

