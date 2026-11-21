import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ArticlesDirectoryScreen from '../../app/articles/index';
import ArticleDetailScreen from '../../app/articles/[id]';
import CreateEditArticleScreen from '../../app/articles/create';
import { Article } from '../../src/types/article';

// Mock router
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({ id: 'art-1', articleId: undefined }),
}));

// Mock auth store
let mockCurrentUser: any = {
  id: 'user-vet-1',
  fullName: 'Dr. Sarah Wilson',
  isVet: true,
  isVetVerified: true,
  roles: ['vet'],
};
let mockCurrentRole: any = 'vet';

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({
    user: mockCurrentUser,
    role: mockCurrentRole,
    isAuthenticated: true,
  }),
}));

const mockArticles: Article[] = [
  {
    id: 'art-1',
    slug: 'feline-urinary-care',
    title: 'Feline Urinary Health & Hydration Guide',
    summary: 'Clinical preventative strategies for preventing FLUTD in indoor cats.',
    content: 'Full clinical guidance text for veterinary hydration protocols...',
    cover_image: null,
    category: 'Feline Nutrition',
    tags: ['Feline', 'FLUTD', 'Hydration'],
    author_id: 'user-vet-1',
    status: 'published',
    published_at: '2026-10-20T00:00:00Z',
    reading_time_minutes: 4,
    view_count: 142,
    created_at: '2026-10-20T00:00:00Z',
    updated_at: '2026-10-20T00:00:00Z',
    author: { id: 'user-vet-1', full_name: 'Dr. Sarah Wilson', avatar_url: null },
    is_vet_verified: true,
  },
  {
    id: 'art-2',
    slug: 'canine-hip-dysplasia',
    title: 'Canine Hip Dysplasia Diagnostics',
    summary: 'Orthopedic evaluation protocols for large breed canines.',
    content: 'Detailed diagnostic radiographic parameters for hip screening...',
    cover_image: null,
    category: 'Canine Health',
    tags: ['Canine', 'Orthopedics'],
    author_id: 'user-vet-2',
    status: 'published',
    published_at: '2026-10-18T00:00:00Z',
    reading_time_minutes: 6,
    view_count: 88,
    created_at: '2026-10-18T00:00:00Z',
    updated_at: '2026-10-18T00:00:00Z',
    author: { id: 'user-vet-2', full_name: 'Dr. Michael Chen', avatar_url: null },
    is_vet_verified: true,
  },
];

// Mock hooks
const mockCreateArticleMutateAsync = jest.fn();
const mockUpdateArticleMutateAsync = jest.fn();
const mockDeleteArticleMutateAsync = jest.fn();

jest.mock('../../src/hooks/useArticles', () => ({
  useArticles: () => ({
    data: mockArticles,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useArticle: (idOrSlug: string) => ({
    data: idOrSlug
      ? mockArticles.find((a) => a.id === idOrSlug || a.slug === idOrSlug) || mockArticles[0]
      : null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useCreateArticle: () => ({
    mutateAsync: mockCreateArticleMutateAsync,
    isPending: false,
  }),
  useUpdateArticle: () => ({
    mutateAsync: mockUpdateArticleMutateAsync,
    isPending: false,
  }),
  useDeleteArticle: () => ({
    mutateAsync: mockDeleteArticleMutateAsync,
    isPending: false,
  }),
}));

describe('Article Experience — Component & Screen Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = {
      id: 'user-vet-1',
      fullName: 'Dr. Sarah Wilson',
      isVet: true,
      isVetVerified: true,
      roles: ['vet'],
    };
    mockCurrentRole = 'vet';
  });

  describe('1. ArticlesDirectoryScreen (app/articles/index.tsx)', () => {
    test('renders articles list, search bar, and category chips', () => {
      const { getByText, getByTestId } = render(<ArticlesDirectoryScreen />);

      expect(getByText('Educational Articles')).toBeTruthy();
      expect(getByTestId('input-search-articles')).toBeTruthy();
      expect(getByText('Feline Urinary Health & Hydration Guide')).toBeTruthy();
      expect(getByText('Canine Hip Dysplasia Diagnostics')).toBeTruthy();
    });

    test('shows Write Article button for verified veterinarian', () => {
      const { getByTestId } = render(<ArticlesDirectoryScreen />);
      const writeBtn = getByTestId('btn-write-article');
      expect(writeBtn).toBeTruthy();

      fireEvent.press(writeBtn);
      expect(mockPush).toHaveBeenCalledWith('/articles/create');
    });

    test('hides Write Article button for standard pet parent', () => {
      mockCurrentUser = {
        id: 'user-parent-1',
        fullName: 'Jane PetParent',
        isVet: false,
        isVetVerified: false,
        roles: ['pet_parent'],
      };
      mockCurrentRole = 'pet_parent';

      const { queryByTestId } = render(<ArticlesDirectoryScreen />);
      expect(queryByTestId('btn-write-article')).toBeNull();
    });

    test('pressing category chip updates category selection', () => {
      const { getByTestId } = render(<ArticlesDirectoryScreen />);
      const chip = getByTestId('chip-category-Feline Nutrition');
      fireEvent.press(chip);
      expect(chip).toBeTruthy();
    });
  });

  describe('2. ArticleDetailScreen (app/articles/[id].tsx)', () => {
    test('renders article title, summary, reading time, view count, and author card', () => {
      const { getByText, getByTestId } = render(<ArticleDetailScreen />);

      expect(getByText('Feline Urinary Health & Hydration Guide')).toBeTruthy();
      expect(
        getByText('Clinical preventative strategies for preventing FLUTD in indoor cats.'),
      ).toBeTruthy();
      expect(getByText('4 min read')).toBeTruthy();
      expect(getByText('142 views')).toBeTruthy();
      expect(getByText('Dr. Sarah Wilson')).toBeTruthy();
      expect(getByTestId('btn-article-back')).toBeTruthy();
    });

    test('shows edit and delete buttons for article author', () => {
      mockCurrentUser = {
        id: 'user-vet-1', // matching author_id
        fullName: 'Dr. Sarah Wilson',
        isVet: true,
        isVetVerified: true,
        roles: ['vet'],
      };

      const { getByTestId } = render(<ArticleDetailScreen />);
      expect(getByTestId('btn-edit-article')).toBeTruthy();
      expect(getByTestId('btn-delete-article')).toBeTruthy();

      fireEvent.press(getByTestId('btn-edit-article'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/articles/create',
        params: { articleId: 'art-1' },
      });
    });

    test('hides edit and delete controls for other users', () => {
      mockCurrentUser = {
        id: 'user-other-vet', // different user
        fullName: 'Dr. Other Vet',
        isVet: true,
        isVetVerified: true,
        roles: ['vet'],
      };
      mockCurrentRole = 'vet';

      const { queryByTestId } = render(<ArticleDetailScreen />);
      expect(queryByTestId('btn-edit-article')).toBeNull();
      expect(queryByTestId('btn-delete-article')).toBeNull();
    });

    test('pressing back button invokes router.back()', () => {
      const { getByTestId } = render(<ArticleDetailScreen />);
      fireEvent.press(getByTestId('btn-article-back'));
      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('3. CreateEditArticleScreen (app/articles/create.tsx)', () => {
    test('shows restriction card if unauthorized user visits screen', () => {
      mockCurrentUser = {
        id: 'user-parent-1',
        fullName: 'Jane PetParent',
        isVet: false,
        isVetVerified: false,
        roles: ['pet_parent'],
      };
      mockCurrentRole = 'pet_parent';

      const { getByTestId, getByText } = render(<CreateEditArticleScreen />);
      expect(getByTestId('unauthorized-article-screen')).toBeTruthy();
      expect(getByText('Veterinary Authorization Required')).toBeTruthy();
    });

    test('renders form fields for verified veterinarian', () => {
      const { getByTestId, getByText } = render(<CreateEditArticleScreen />);

      expect(getByTestId('create-article-screen')).toBeTruthy();
      expect(getByTestId('input-article-title')).toBeTruthy();
      expect(getByTestId('input-article-summary')).toBeTruthy();
      expect(getByTestId('input-article-content')).toBeTruthy();
      expect(getByTestId('btn-submit-article')).toBeTruthy();
      expect(getByText('Write Clinical Article')).toBeTruthy();
    });

    test('validates minimum field lengths on submission attempt', async () => {
      const { getByTestId, findByTestId } = render(<CreateEditArticleScreen />);

      // Submit without entering data
      fireEvent.press(getByTestId('btn-submit-article'));

      const errorBanner = await findByTestId('article-error-banner');
      expect(errorBanner).toBeTruthy();
      expect(mockCreateArticleMutateAsync).not.toHaveBeenCalled();
    });

    test('submits article when fields meet validation rules', async () => {
      mockCreateArticleMutateAsync.mockResolvedValue({ id: 'new-art-100' });

      const { getByTestId } = render(<CreateEditArticleScreen />);

      fireEvent.changeText(
        getByTestId('input-article-title'),
        'Comprehensive Pediatric Canine Parasite Protocols',
      );
      fireEvent.changeText(
        getByTestId('input-article-summary'),
        'Clinical guidelines for deworming schedules and fecal centrifugation testing in puppies.',
      );
      fireEvent.changeText(
        getByTestId('input-article-content'),
        'Standard protocols dictate administering pyrantel pamoate starting at two weeks of age, followed by repeats at four, six, and eight weeks.',
      );

      fireEvent.press(getByTestId('btn-submit-article'));

      await waitFor(() => {
        expect(mockCreateArticleMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Comprehensive Pediatric Canine Parasite Protocols',
            summary:
              'Clinical guidelines for deworming schedules and fecal centrifugation testing in puppies.',
            status: 'published',
          }),
        );
      });
    }, 15000);
  });
});
