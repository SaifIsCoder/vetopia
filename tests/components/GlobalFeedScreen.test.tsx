import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import CommunityFeedScreen from '../../app/community/feed';
import CreateCommunityPostScreen from '../../app/community/create-post';
import { clubService } from '../../src/lib/clubs/clubService';
import { ClubPost, Club } from '../../src/types/club';

// Mock clubService
jest.mock('../../src/lib/clubs/clubService', () => ({
  clubService: {
    getCommunityFeed: jest.fn(),
    createPost: jest.fn(),
    toggleLike: jest.fn(),
    getJoinedClubs: jest.fn(),
  },
}));

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({}),
}));

// Mock Auth Store
jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-parent-123', fullName: 'Alice Parent' },
    role: 'pet_parent',
    isAuthenticated: true,
  }),
}));

// Mock hooks
const mockToggleLikeMutate = jest.fn();
const mockCreatePostMutateAsync = jest.fn();

const mockCommunityPosts: ClubPost[] = [
  {
    id: 'post-general-1',
    club_id: null,
    author_id: 'user-parent-123',
    content: 'Welcome to the global community feed! Happy to be here.',
    caption: 'Welcome to the global community feed! Happy to be here.',
    image_url: null,
    status: 'approved',
    likes_count: 5,
    comments_count: 2,
    created_at: '2026-10-24T12:00:00Z',
    updated_at: '2026-10-24T12:00:00Z',
    author: { id: 'user-parent-123', full_name: 'Alice Parent', avatar_url: null },
    club: null,
    is_vet_verified: false,
    user_has_liked: false,
  },
  {
    id: 'post-club-2',
    club_id: 'club-dogs-1',
    author_id: 'author-vet-1',
    content: 'Dr. Dog Vet: Regular dental checkups are vital for senior golden retrievers.',
    caption: 'Dr. Dog Vet: Regular dental checkups are vital for senior golden retrievers.',
    image_url: 'https://example.com/golden.jpg',
    status: 'approved',
    likes_count: 18,
    comments_count: 6,
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:00:00Z',
    author: { id: 'author-vet-1', full_name: 'Dr. Canine Vet', avatar_url: null },
    club: { id: 'club-dogs-1', name: 'Dogs Club', slug: 'dogs' },
    is_vet_verified: true,
    user_has_liked: true,
  },
];

const mockJoinedClubs: Club[] = [
  {
    id: 'club-dogs-1',
    slug: 'dogs',
    name: 'Dogs Club',
    description: 'Canine lovers unite',
    category: 'Dogs',
    cover_image: null,
    icon_name: 'Dog',
    member_count: 100,
    post_count: 25,
    is_active: true,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    is_member: true,
  },
];

let mockFeedQueryState: {
  data?: { posts: ClubPost[]; hasMore: boolean; nextCursor?: string };
  isLoading: boolean;
  isError: boolean;
  error?: Error;
} = {
  data: { posts: mockCommunityPosts, hasMore: true, nextCursor: '2026-10-24T10:00:00Z' },
  isLoading: false,
  isError: false,
};

jest.mock('../../src/hooks/useClubs', () => ({
  useCommunityFeed: () => ({
    ...mockFeedQueryState,
    refetch: jest.fn().mockResolvedValue({}),
    isRefetching: false,
  }),
  useJoinedClubs: () => ({
    data: mockJoinedClubs,
    isLoading: false,
  }),
  useJoinClub: () => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useToggleLike: () => ({
    mutate: mockToggleLikeMutate,
    isPending: false,
  }),
  useDeletePost: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useModerateContent: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
  useCreatePost: () => ({
    mutateAsync: mockCreatePostMutateAsync,
    isPending: false,
  }),
  useUpdatePost: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
  useReportContent: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

describe('Global Community Feed Screen Component Tests (Phase 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeedQueryState = {
      data: { posts: mockCommunityPosts, hasMore: true, nextCursor: '2026-10-24T10:00:00Z' },
      isLoading: false,
      isError: false,
    };
  });

  test('renders community feed header, discovery banner, and posts list', () => {
    const { getByText, getByTestId } = render(<CommunityFeedScreen />);

    expect(getByText('Community Feed')).toBeTruthy();
    expect(getByText('Explore Animal Clubs')).toBeTruthy();
    expect(getByTestId('btn-create-post')).toBeTruthy();
    expect(getByTestId('btn-explore-clubs')).toBeTruthy();

    // Verify general post content and author
    expect(getByText('Welcome to the global community feed! Happy to be here.')).toBeTruthy();
    expect(getByText('Alice Parent')).toBeTruthy();

    // Verify club-associated post content and author
    expect(
      getByText('Dr. Dog Vet: Regular dental checkups are vital for senior golden retrievers.'),
    ).toBeTruthy();
    expect(getByText('Dr. Canine Vet')).toBeTruthy();
  });

  test('displays clear club label badge on club-associated posts and allows navigation', () => {
    const { getByText, getByTestId } = render(<CommunityFeedScreen />);

    // Dogs Club badge should be visible on the club-associated post
    const clubBadge = getByTestId('club-badge-post-club-2');
    expect(clubBadge).toBeTruthy();
    expect(getByText('Dogs Club')).toBeTruthy();

    // Clicking club badge navigates to that club's screen
    fireEvent.press(clubBadge);
    expect(mockPush).toHaveBeenCalledWith('/clubs/club-dogs-1');
  });

  test('navigates to create post screen when Post button is pressed', () => {
    const { getByTestId } = render(<CommunityFeedScreen />);

    const createBtn = getByTestId('btn-create-post');
    fireEvent.press(createBtn);

    expect(mockPush).toHaveBeenCalledWith('/community/create-post');
  });

  test('navigates to clubs catalog when Clubs explore button is pressed', () => {
    const { getByTestId } = render(<CommunityFeedScreen />);

    const exploreBtn = getByTestId('btn-explore-clubs');
    fireEvent.press(exploreBtn);

    expect(mockPush).toHaveBeenCalledWith('/clubs');
  });

  test('supports cursor pagination via Load More button and appends older posts', async () => {
    (clubService.getCommunityFeed as jest.Mock).mockResolvedValue({
      posts: [
        {
          id: 'post-older-3',
          club_id: null,
          author_id: 'user-older',
          content: 'Older community post loaded via cursor pagination.',
          caption: 'Older community post loaded via cursor pagination.',
          image_url: null,
          status: 'approved',
          likes_count: 2,
          comments_count: 0,
          created_at: '2026-10-23T08:00:00Z',
          updated_at: '2026-10-23T08:00:00Z',
          author: { id: 'user-older', full_name: 'Bob Parent', avatar_url: null },
          club: null,
          is_vet_verified: false,
          user_has_liked: false,
        },
      ],
      hasMore: false,
      nextCursor: undefined,
    });

    const { getByTestId, findByText } = render(<CommunityFeedScreen />);

    const loadMoreBtn = getByTestId('btn-load-more');
    expect(loadMoreBtn).toBeTruthy();

    fireEvent.press(loadMoreBtn);

    await waitFor(() => {
      expect(clubService.getCommunityFeed).toHaveBeenCalledWith(20, '2026-10-24T10:00:00Z');
    });

    const olderPostText = await findByText('Older community post loaded via cursor pagination.');
    expect(olderPostText).toBeTruthy();
  });

  test('renders EmptyState when feed returns no posts', () => {
    mockFeedQueryState = {
      data: { posts: [], hasMore: false },
      isLoading: false,
      isError: false,
    };

    const { getByText } = render(<CommunityFeedScreen />);

    expect(getByText('No Discussions Yet')).toBeTruthy();
    expect(getByText('Create First Post')).toBeTruthy();
  });

  test('renders ErrorState when feed fetch fails', () => {
    mockFeedQueryState = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to connect to feed service'),
    };

    const { getByText } = render(<CommunityFeedScreen />);

    expect(getByText('Could not load community feed')).toBeTruthy();
    expect(getByText('Failed to connect to feed service')).toBeTruthy();
  });

  test('allows toggling likes on posts from global feed', () => {
    const { getByTestId } = render(<CommunityFeedScreen />);

    const likeButton = getByTestId('like-button-post-general-1');
    fireEvent.press(likeButton);

    expect(mockToggleLikeMutate).toHaveBeenCalledWith({
      postId: 'post-general-1',
      clubId: null,
    });
  });
});

describe('Community Post Composer Screen Component Tests (Phase 3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders composer with General Community selected by default', () => {
    const { getByText, getByTestId } = render(<CreateCommunityPostScreen />);

    expect(getByText('New Community Post')).toBeTruthy();
    expect(getByText('Posting to Global Community')).toBeTruthy();
    expect(getByTestId('chip-general-community')).toBeTruthy();
    expect(getByTestId('chip-club-club-dogs-1')).toBeTruthy();
  });

  test('allows selecting a joined club for club-associated post', () => {
    const { getByText, getByTestId } = render(<CreateCommunityPostScreen />);

    const dogClubChip = getByTestId('chip-club-club-dogs-1');
    fireEvent.press(dogClubChip);

    expect(getByText('Posting to Pet Club')).toBeTruthy();
  });

  test('validates empty content and prevents submission', async () => {
    const { getByTestId } = render(<CreateCommunityPostScreen />);

    // Content is empty by default
    const submitBtn = getByTestId('btn-submit-post');
    fireEvent.press(submitBtn);

    // Verify error banner appears or mutation is not called
    expect(mockCreatePostMutateAsync).not.toHaveBeenCalled();
  });

  test('submits general community post with content and null club_id', async () => {
    mockCreatePostMutateAsync.mockResolvedValue({
      id: 'post-new-1',
      club_id: null,
      content: 'Fresh story for all pet parents!',
    });

    const { getByTestId } = render(<CreateCommunityPostScreen />);

    const contentInput = getByTestId('input-post-content');
    fireEvent.changeText(contentInput, 'Fresh story for all pet parents!');

    const submitBtn = getByTestId('btn-submit-post');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockCreatePostMutateAsync).toHaveBeenCalledWith({
        club_id: null,
        content: 'Fresh story for all pet parents!',
        image_url: null,
      });
    });
  }, 15000);

  test('submits club-associated post when club is selected', async () => {
    mockCreatePostMutateAsync.mockResolvedValue({
      id: 'post-new-2',
      club_id: 'club-dogs-1',
      content: 'Great puppy leash training technique!',
    });

    const { getByTestId } = render(<CreateCommunityPostScreen />);

    // Select Dogs Club
    const dogClubChip = getByTestId('chip-club-club-dogs-1');
    fireEvent.press(dogClubChip);

    const contentInput = getByTestId('input-post-content');
    fireEvent.changeText(contentInput, 'Great puppy leash training technique!');

    const submitBtn = getByTestId('btn-submit-post');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(mockCreatePostMutateAsync).toHaveBeenCalledWith({
        club_id: 'club-dogs-1',
        content: 'Great puppy leash training technique!',
        image_url: null,
      });
    });
  });
});
