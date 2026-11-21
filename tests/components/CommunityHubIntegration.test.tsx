import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CommunityHubScreen from '../../app/community/index';
import CareScreen from '../../app/(tabs)/care';
import HomeScreen from '../../app/(tabs)/index';
import { Club, ClubPost } from '../../src/types/club';
import { Article } from '../../src/types/article';
import { CommunityEvent } from '../../src/types/event';

// ---------------------------------------------------------------------------
// 1. Mock expo-router
// ---------------------------------------------------------------------------
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
}));

// ---------------------------------------------------------------------------
// 2. Mock Auth Store
// ---------------------------------------------------------------------------
let mockUser: any = {
  id: 'user-parent-1',
  fullName: 'Alice Parent',
  email: 'parent@example.com',
  roles: ['pet_parent'],
  isVet: false,
  isVetVerified: false,
};
let mockIsAuthenticated = true;

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({
    user: mockUser,
    role: mockUser?.roles?.[0] || 'pet_parent',
    isAuthenticated: mockIsAuthenticated,
  }),
}));

// ---------------------------------------------------------------------------
// 3. Mock Data
// ---------------------------------------------------------------------------
const mockClubs: Club[] = [
  {
    id: 'club-canine-1',
    slug: 'dog-lovers-club',
    name: 'Canine Companions Club',
    description: 'A vibrant club for dog enthusiasts.',
    category: 'Canine',
    cover_image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1',
    icon_name: 'dog',
    member_count: 1420,
    post_count: 320,
    is_active: true,
    is_member: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
  {
    id: 'club-feline-2',
    slug: 'cat-enthusiasts',
    name: 'Feline Friends Society',
    description: 'Everything cat health, behavior, and play.',
    category: 'Feline',
    cover_image: null,
    icon_name: 'cat',
    member_count: 980,
    post_count: 215,
    is_active: true,
    is_member: false,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
  },
];

const mockFeedPosts: ClubPost[] = [
  {
    id: 'post-1',
    club_id: 'club-canine-1',
    author_id: 'user-parent-1',
    content: 'My golden retriever just learned to swim!',
    caption: 'My golden retriever just learned to swim!',
    image_url: null,
    status: 'approved',
    likes_count: 12,
    comments_count: 4,
    created_at: '2026-10-24T12:00:00Z',
    updated_at: '2026-10-24T12:00:00Z',
    author: { id: 'user-parent-1', full_name: 'Alice Parent', avatar_url: null },
    club: { id: 'club-canine-1', name: 'Canine Companions Club', slug: 'dog-lovers-club' },
    is_vet_verified: false,
    user_has_liked: false,
  },
];

const mockArticles: Article[] = [
  {
    id: 'art-1',
    slug: 'canine-parvovirus-protocol',
    title: 'Canine Parvovirus Protocol: Early Symptoms and Emergency Triage',
    summary: 'A clinical guide for recognizing parvo in puppies.',
    content: 'Parvovirus is a highly contagious virus requiring prompt veterinary medical intervention.',
    cover_image: null,
    category: 'Canine Health',
    tags: ['Vaccines', 'Puppies'],
    author_id: 'vet-1',
    status: 'published',
    published_at: '2026-10-20T10:00:00Z',
    reading_time_minutes: 4,
    view_count: 42,
    created_at: '2026-10-20T10:00:00Z',
    updated_at: '2026-10-20T10:00:00Z',
    author: { id: 'vet-1', full_name: 'Dr. Sarah Wilson, DVM', avatar_url: null },
    is_vet_verified: true,
  },
];

const mockEvents: CommunityEvent[] = [
  {
    id: 'evt-1',
    slug: 'puppy-socialization-webinar',
    title: 'Puppy Socialization & Fear-Free Training Webinar',
    description: 'Learn evidence-based techniques to socialize young puppies.',
    cover_image: null,
    category: 'Webinar',
    event_type: 'virtual',
    location_or_url: 'https://meet.vetopia.com/puppy-class',
    start_time: '2026-11-01T15:00:00Z',
    end_time: '2026-11-01T16:30:00Z',
    organizer_id: 'vet-1',
    organizer_name: 'Dr. Sarah Wilson, DVM',
    status: 'published',
    created_at: '2026-10-24T00:00:00Z',
    updated_at: '2026-10-24T00:00:00Z',
    organizer: { id: 'vet-1', full_name: 'Dr. Sarah Wilson, DVM', avatar_url: null },
    is_vet_verified: true,
  },
];

// ---------------------------------------------------------------------------
// 4. Mock React Query Hooks
// ---------------------------------------------------------------------------
const mockRefetchClubs = jest.fn();
const mockRefetchFeed = jest.fn();
const mockRefetchArticles = jest.fn();
const mockRefetchEvents = jest.fn();
const mockJoinClubMutate = jest.fn();
const mockLeaveClubMutate = jest.fn();

jest.mock('../../src/hooks/useClubs', () => ({
  useClubs: () => ({
    data: mockClubs,
    isLoading: false,
    isError: false,
    refetch: mockRefetchClubs,
  }),
  useCommunityFeed: () => ({
    data: { posts: mockFeedPosts, hasMore: false },
    isLoading: false,
    isError: false,
    refetch: mockRefetchFeed,
  }),
  useJoinClub: () => ({
    mutate: mockJoinClubMutate,
    isPending: false,
  }),
  useLeaveClub: () => ({
    mutate: mockLeaveClubMutate,
    isPending: false,
  }),
  useToggleLike: () => ({
    mutate: jest.fn(),
  }),
  useDeletePost: () => ({
    mutate: jest.fn(),
  }),
  useModerateContent: () => ({
    mutate: jest.fn(),
  }),
  useReportContent: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  }),
}));

jest.mock('../../src/hooks/useArticles', () => ({
  useArticles: () => ({
    data: mockArticles,
    isLoading: false,
    isError: false,
    refetch: mockRefetchArticles,
  }),
}));

jest.mock('../../src/hooks/useEvents', () => ({
  useEvents: () => ({
    data: mockEvents,
    isLoading: false,
    isError: false,
    refetch: mockRefetchEvents,
  }),
}));

// Mock hooks used by care.tsx and index.tsx
jest.mock('../../src/hooks/usePets', () => ({
  usePets: () => ({
    data: [{ id: 'pet-1', name: 'Buddy', species: 'Dog', breed: 'Golden Retriever' }],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

jest.mock('../../src/hooks/useAppointments', () => ({
  useAppointments: () => ({
    data: [],
    isLoading: false,
  }),
}));

jest.mock('../../src/hooks/useVets', () => ({
  useVets: () => ({
    data: [],
    isLoading: false,
  }),
  useFeaturedVets: () => ({
    data: [],
    isLoading: false,
  }),
}));

jest.mock('../../src/components/notifications/NotificationBell', () => ({
  NotificationBell: () => null,
}));

// ---------------------------------------------------------------------------
// 5. Test Suite
// ---------------------------------------------------------------------------
describe('Community Hub Integration & Cross-Navigation Tests (Phase 5)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = {
      id: 'user-parent-1',
      fullName: 'Alice Parent',
      email: 'parent@example.com',
      roles: ['pet_parent'],
      isVet: false,
      isVetVerified: false,
    };
    mockIsAuthenticated = true;
  });

  describe('1. Community Hub Screen Rendering & Overview (app/community/index.tsx)', () => {
    test('renders community hub header, title, and overview section', () => {
      const { getByTestId, getByText } = render(<CommunityHubScreen />);

      expect(getByTestId('community-hub-header')).toBeTruthy();
      expect(getByText('Community Hub')).toBeTruthy();
      expect(getByText('Clubs, discussions, veterinary blogs & pet events')).toBeTruthy();
      expect(getByTestId('view-community-overview')).toBeTruthy();
    });

    test('hides vet editorial banner for regular pet parent', () => {
      const { queryByTestId } = render(<CommunityHubScreen />);
      expect(queryByTestId('vet-editorial-banner')).toBeNull();
    });

    test('shows vet editorial banner for verified veterinarian', () => {
      mockUser = {
        id: 'vet-dr-wilson',
        fullName: 'Dr. Sarah Wilson',
        roles: ['vet'],
        isVet: true,
        isVetVerified: true,
      };

      const { getByTestId, getByText } = render(<CommunityHubScreen />);
      expect(getByTestId('vet-editorial-banner')).toBeTruthy();
      expect(getByText('Verified Clinical Contributor')).toBeTruthy();
      expect(getByTestId('btn-hub-write-article')).toBeTruthy();
      expect(getByTestId('btn-hub-host-event')).toBeTruthy();
    });

    test('clicking Write Article in banner navigates to /articles/create', () => {
      mockUser = {
        id: 'vet-dr-wilson',
        fullName: 'Dr. Sarah Wilson',
        roles: ['vet'],
        isVet: true,
        isVetVerified: true,
      };

      const { getByTestId } = render(<CommunityHubScreen />);
      fireEvent.press(getByTestId('btn-hub-write-article'));
      expect(mockPush).toHaveBeenCalledWith('/articles/create');
    });

    test('clicking Host Event in banner navigates to /events/create', () => {
      mockUser = {
        id: 'vet-dr-wilson',
        fullName: 'Dr. Sarah Wilson',
        roles: ['vet'],
        isVet: true,
        isVetVerified: true,
      };

      const { getByTestId } = render(<CommunityHubScreen />);
      fireEvent.press(getByTestId('btn-hub-host-event'));
      expect(mockPush).toHaveBeenCalledWith('/events/create');
    });

    test('clicking Post button navigates to /community/create-post when authenticated', () => {
      const { getByTestId } = render(<CommunityHubScreen />);
      fireEvent.press(getByTestId('btn-hub-create-post'));
      expect(mockPush).toHaveBeenCalledWith('/community/create-post');
    });

    test('clicking Post button redirects to /login when unauthenticated', () => {
      mockIsAuthenticated = false;
      mockUser = null;

      const { getByTestId } = render(<CommunityHubScreen />);
      fireEvent.press(getByTestId('btn-hub-create-post'));
      expect(mockPush).toHaveBeenCalledWith('/(auth)/login');
    });
  });

  describe('2. Navigation Between Related Hub Sections & Tab Switching', () => {
    test('overview cards show correct items and counts', () => {
      const { getByText, getAllByText } = render(<CommunityHubScreen />);

      // Animal clubs preview (present on club card and in feed post club badge)
      expect(getAllByText('Canine Companions Club').length).toBeGreaterThanOrEqual(1);
      // Discussions preview
      expect(getByText('My golden retriever just learned to swim!')).toBeTruthy();
      // Articles preview
      expect(getByText('Canine Parvovirus Protocol: Early Symptoms and Emergency Triage')).toBeTruthy();
      // Events preview
      expect(getByText('Puppy Socialization & Fear-Free Training Webinar')).toBeTruthy();
    });

    test('switching to Discussions tab displays the feed tab', () => {
      const { getByTestId } = render(<CommunityHubScreen />);

      fireEvent.press(getByTestId('tab-community-feed'));
      expect(getByTestId('view-community-feed-tab')).toBeTruthy();
      expect(getByTestId('btn-open-full-feed')).toBeTruthy();

      fireEvent.press(getByTestId('btn-open-full-feed'));
      expect(mockPush).toHaveBeenCalledWith('/community/feed');
    });

    test('switching to Clubs tab displays all animal clubs', () => {
      const { getByTestId } = render(<CommunityHubScreen />);

      fireEvent.press(getByTestId('tab-community-clubs'));
      expect(getByTestId('view-community-clubs-tab')).toBeTruthy();
      expect(getByTestId('btn-open-clubs-dir')).toBeTruthy();

      fireEvent.press(getByTestId('btn-open-clubs-dir'));
      expect(mockPush).toHaveBeenCalledWith('/clubs');
    });

    test('switching to Articles tab displays articles directory view', () => {
      const { getByTestId } = render(<CommunityHubScreen />);

      fireEvent.press(getByTestId('tab-community-articles'));
      expect(getByTestId('view-community-articles-tab')).toBeTruthy();
      expect(getByTestId('btn-open-articles-dir')).toBeTruthy();

      fireEvent.press(getByTestId('btn-open-articles-dir'));
      expect(mockPush).toHaveBeenCalledWith('/articles');
    });

    test('switching to Events tab displays events directory view', () => {
      const { getByTestId } = render(<CommunityHubScreen />);

      fireEvent.press(getByTestId('tab-community-events'));
      expect(getByTestId('view-community-events-tab')).toBeTruthy();
      expect(getByTestId('btn-open-events-dir')).toBeTruthy();

      fireEvent.press(getByTestId('btn-open-events-dir'));
      expect(mockPush).toHaveBeenCalledWith('/events');
    });

    test('overview "See All" buttons navigate to respective directories', () => {
      const { getByTestId } = render(<CommunityHubScreen />);

      fireEvent.press(getByTestId('btn-see-all-clubs'));
      expect(mockPush).toHaveBeenCalledWith('/clubs');

      fireEvent.press(getByTestId('btn-see-all-feed'));
      expect(mockPush).toHaveBeenCalledWith('/community/feed');

      fireEvent.press(getByTestId('btn-see-all-articles'));
      expect(mockPush).toHaveBeenCalledWith('/articles');

      fireEvent.press(getByTestId('btn-see-all-events'));
      expect(mockPush).toHaveBeenCalledWith('/events');
    });
  });

  describe('3. Cross-Hub Entry Points (Care Hub & Home Screen)', () => {
    test('Care Hub (app/(tabs)/care.tsx) contains entry card that navigates to /community', () => {
      const { getByTestId } = render(<CareScreen />);

      const communityCard = getByTestId('btn-care-community-hub');
      expect(communityCard).toBeTruthy();

      fireEvent.press(communityCard);
      expect(mockPush).toHaveBeenCalledWith('/community');
    });

    test('Home Screen (app/(tabs)/index.tsx) contains Community Hub banner that navigates to /community', () => {
      const { getByTestId } = render(<HomeScreen />);

      const banner = getByTestId('banner-community-hub');
      expect(banner).toBeTruthy();

      fireEvent.press(banner);
      expect(mockPush).toHaveBeenCalledWith('/community');
    });
  });
});
