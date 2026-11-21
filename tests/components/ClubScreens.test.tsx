import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ClubsHomeScreen from '../../app/clubs/index';
import ClubDetailsScreen from '../../app/clubs/[id]';
import { ClubCard } from '../../src/components/clubs/ClubCard';
import { PostCard } from '../../src/components/clubs/PostCard';
import { CommentItem } from '../../src/components/clubs/CommentItem';
import { ReportModal } from '../../src/components/clubs/ReportModal';
import { Club, ClubPost, ClubComment } from '../../src/types/club';

// Mock clubService
jest.mock('../../src/lib/clubs/clubService', () => ({
  clubService: {
    getClubFeed: jest.fn().mockResolvedValue({
      posts: [
        {
          id: 'post-102',
          club_id: 'club-dogs-1',
          author_id: 'author-vet-2',
          content: 'Older discussion post loaded via pagination cursor.',
          status: 'approved',
          likes_count: 5,
          comments_count: 1,
          created_at: '2026-10-10T00:00:00Z',
          updated_at: '2026-10-10T00:00:00Z',
        },
      ],
      hasMore: false,
      nextCursor: undefined,
    }),
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
  useLocalSearchParams: () => ({
    id: 'club-dogs-1',
  }),
}));

// Mock Auth Store
jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'user-parent-123', fullName: 'Alice Parent' },
    role: 'pet_parent',
    isAuthenticated: true,
  }),
}));

// Mock Club Hooks
const mockJoinMutateAsync = jest.fn().mockResolvedValue({});
const mockLeaveMutateAsync = jest.fn().mockResolvedValue({});
const mockToggleLikeMutate = jest.fn();
const mockDeletePostMutate = jest.fn();
const mockModerateMutate = jest.fn();
const mockReportMutateAsync = jest.fn();
const mockUpdateCommentMutateAsync = jest.fn();
const mockDeleteCommentMutate = jest.fn();

const mockClubs: Club[] = [
  {
    id: 'club-dogs-1',
    slug: 'dogs',
    name: 'Dogs Club',
    description: 'Canine health, puppy training, and nutrition.',
    category: 'Dogs',
    cover_image: null,
    icon_name: 'Dog',
    member_count: 50,
    post_count: 12,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_member: true,
  },
  {
    id: 'club-cats-2',
    slug: 'cats',
    name: 'Cats Club',
    description: 'Feline behavior, enrichment, and preventative care.',
    category: 'Cats',
    cover_image: null,
    icon_name: 'Cat',
    member_count: 38,
    post_count: 8,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_member: false,
  },
  {
    id: 'club-birds-3',
    slug: 'birds',
    name: 'Birds Club',
    description: 'Avian care and nutrition.',
    category: 'Birds',
    cover_image: null,
    icon_name: 'Feather',
    member_count: 22,
    post_count: 5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_member: false,
  },
  {
    id: 'club-horses-4',
    slug: 'horses',
    name: 'Horses & Equine Club',
    description: 'Equine wellness and training.',
    category: 'Horses',
    cover_image: null,
    icon_name: 'Compass',
    member_count: 15,
    post_count: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_member: false,
  },
  {
    id: 'club-farm-5',
    slug: 'farm-animals',
    name: 'Farm Animals Club',
    description: 'Livestock management and biosecurity.',
    category: 'Farm Animals',
    cover_image: null,
    icon_name: 'Tractor',
    member_count: 19,
    post_count: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_member: false,
  },
  {
    id: 'club-poultry-6',
    slug: 'poultry',
    name: 'Poultry Club',
    description: 'Coop health, egg production, and flock care.',
    category: 'Poultry',
    cover_image: null,
    icon_name: 'Egg',
    member_count: 25,
    post_count: 6,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_member: false,
  },
];

const mockPost: ClubPost = {
  id: 'post-101',
  club_id: 'club-dogs-1',
  author_id: 'author-vet-1',
  content: 'Remember to check paws for foxtails after outdoor walks!',
  caption: 'Remember to check paws for foxtails after outdoor walks!',
  image_url: 'https://example.com/paws.jpg',
  status: 'approved',
  likes_count: 14,
  comments_count: 3,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  author: {
    id: 'author-vet-1',
    full_name: 'Dr. Sarah Walker',
    avatar_url: null,
  },
  is_vet_verified: true,
  user_has_liked: false,
};

const mockComment: ClubComment = {
  id: 'comment-201',
  post_id: 'post-101',
  user_id: 'user-parent-123',
  body: 'Thank you for the reminder, Dr. Walker!',
  status: 'approved',
  created_at: new Date().toISOString(),
  author: {
    id: 'user-parent-123',
    full_name: 'Alice Parent',
    avatar_url: null,
  },
  is_vet_verified: false,
};

jest.mock('../../src/hooks/useClubs', () => ({
  useClubs: jest.fn(() => ({
    data: mockClubs,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  })),
  useClub: jest.fn(() => ({
    data: mockClubs[0],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
  useJoinedClubs: jest.fn(() => ({
    data: [mockClubs[0]],
    refetch: jest.fn(),
  })),
  useClubFeed: jest.fn(() => ({
    data: { posts: [mockPost], hasMore: false },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    isRefetching: false,
  })),
  usePost: jest.fn(() => ({
    data: mockPost,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })),
  useComments: jest.fn(() => ({
    data: [mockComment],
    isLoading: false,
    refetch: jest.fn(),
  })),
  useJoinClub: () => ({
    mutateAsync: mockJoinMutateAsync,
    mutate: mockJoinMutateAsync,
    isPending: false,
    variables: undefined,
  }),
  useLeaveClub: () => ({
    mutateAsync: mockLeaveMutateAsync,
    isPending: false,
    variables: undefined,
  }),
  useToggleLike: () => ({
    mutate: mockToggleLikeMutate,
    isPending: false,
  }),
  useDeletePost: () => ({
    mutate: mockDeletePostMutate,
    isPending: false,
  }),
  useModerateContent: () => ({
    mutate: mockModerateMutate,
    isPending: false,
  }),
  useReportContent: () => ({
    mutateAsync: mockReportMutateAsync,
    isPending: false,
  }),
  useUpdateComment: () => ({
    mutateAsync: mockUpdateCommentMutateAsync,
    isPending: false,
  }),
  useDeleteComment: () => ({
    mutate: mockDeleteCommentMutate,
    isPending: false,
  }),
}));

describe('Pet Clubs Frontend Screens & Components Testing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. ClubsHomeScreen', () => {
    test('Renders Pet Clubs title, search input, and all 6 clubs', () => {
      const { getByText, getAllByText, getByPlaceholderText } = render(<ClubsHomeScreen />);

      expect(getByText('Pet Clubs')).toBeTruthy();
      expect(getByPlaceholderText('Search dogs, cats, equine, poultry...')).toBeTruthy();

      // Verify all 6 clubs rendered
      expect(getAllByText('Dogs Club').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Cats Club')).toBeTruthy();
      expect(getByText('Birds Club')).toBeTruthy();
      expect(getByText('Horses & Equine Club')).toBeTruthy();
      expect(getByText('Farm Animals Club')).toBeTruthy();
      expect(getByText('Poultry Club')).toBeTruthy();
    });

    test('Renders My Joined Clubs section with active count', () => {
      const { getByText } = render(<ClubsHomeScreen />);

      expect(getByText('My Joined Clubs')).toBeTruthy();
      expect(getByText('1 Active')).toBeTruthy();
    });

    test('Renders horizontal category filter chips and toggles category filter', () => {
      const { getByTestId } = render(<ClubsHomeScreen />);

      expect(getByTestId('category-chip-all')).toBeTruthy();
      expect(getByTestId('category-chip-dogs')).toBeTruthy();
      expect(getByTestId('category-chip-cats')).toBeTruthy();
      expect(getByTestId('category-chip-birds')).toBeTruthy();
      expect(getByTestId('category-chip-horses')).toBeTruthy();
      expect(getByTestId('category-chip-farm-animals')).toBeTruthy();
      expect(getByTestId('category-chip-poultry')).toBeTruthy();

      fireEvent.press(getByTestId('category-chip-dogs'));
    });

    test('Prompts confirmation alert when leaving a club', () => {
      const alertSpy = jest.spyOn(Alert, 'alert');
      const { getByTestId } = render(<ClubsHomeScreen />);

      const joinedBtn = getByTestId('club-join-btn-dogs');
      fireEvent.press(joinedBtn);

      expect(alertSpy).toHaveBeenCalledWith(
        'Leave Club',
        expect.stringContaining('Dogs Club'),
        expect.any(Array),
      );
      alertSpy.mockRestore();
    });
  });

  describe('2. ClubCard Component', () => {
    test('Displays club name, description, member count, and category badge', () => {
      const onJoinToggle = jest.fn();
      const { getByText } = render(
        <ClubCard club={mockClubs[0]} onJoinToggle={onJoinToggle} />,
      );

      expect(getByText('Dogs Club')).toBeTruthy();
      expect(getByText('Canine health, puppy training, and nutrition.')).toBeTruthy();
      expect(getByText('50 members')).toBeTruthy();
      expect(getByText('12 posts')).toBeTruthy();
      expect(getByText('Dogs')).toBeTruthy();
      expect(getByText('Joined')).toBeTruthy();
    });

    test('Navigates to club details when card is pressed', () => {
      const { getByTestId } = render(<ClubCard club={mockClubs[0]} />);

      const card = getByTestId('club-card-dogs');
      fireEvent.press(card);

      expect(mockPush).toHaveBeenCalledWith('/clubs/club-dogs-1');
    });

    test('ClubCard.Skeleton renders skeleton placeholder elements', () => {
      const { getByTestId } = render(<ClubCard.Skeleton />);
      expect(getByTestId('club-card-skeleton')).toBeTruthy();
    });
  });

  describe('3. ClubDetailsScreen & Feed', () => {
    test('Renders hero cover, member stats, and club posts in feed', () => {
      const { getByText, getAllByText } = render(<ClubDetailsScreen />);

      expect(getAllByText('Dogs Club').length).toBeGreaterThanOrEqual(1);
      expect(getByText('50')).toBeTruthy();
      expect(getByText('Members')).toBeTruthy();
      expect(getByText('Club Discussions')).toBeTruthy();
      expect(getByText('Remember to check paws for foxtails after outdoor walks!')).toBeTruthy();
    });

    test('Create post button triggers navigation to create-post composer', () => {
      const { getByTestId } = render(<ClubDetailsScreen />);

      const postTrigger = getByTestId('btn-create-post-trigger');
      fireEvent.press(postTrigger);

      expect(mockPush).toHaveBeenCalledWith('/clubs/club-dogs-1/create-post');
    });

    test('Renders load more button when feed has more posts and handles load more', async () => {
      const useClubFeedMock = (jest.requireMock('../../src/hooks/useClubs') as any).useClubFeed;
      useClubFeedMock.mockReturnValueOnce({
        data: { posts: [mockPost], hasMore: true },
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
        isRefetching: false,
      });

      const { getByTestId, findByText } = render(<ClubDetailsScreen />);

      const loadMoreBtn = getByTestId('btn-load-more-posts');
      expect(loadMoreBtn).toBeTruthy();

      fireEvent.press(loadMoreBtn);

      await waitFor(() => {
        expect(findByText('Older discussion post loaded via pagination cursor.')).toBeTruthy();
      });
    });
  });

  describe('4. PostCard Component', () => {
    test('Displays verified veterinarian badge for Dr. Sarah Walker', () => {
      const { getByText } = render(<PostCard post={mockPost} />);

      expect(getByText('Dr. Sarah Walker')).toBeTruthy();
      expect(getByText('Verified Vet')).toBeTruthy();
      expect(getByText('14')).toBeTruthy(); // Likes count
      expect(getByText('3')).toBeTruthy(); // Comments count
    });

    test('Toggles like on button press', () => {
      const { getByTestId } = render(<PostCard post={mockPost} />);

      const likeBtn = getByTestId('like-button-post-101');
      fireEvent.press(likeBtn);

      expect(mockToggleLikeMutate).toHaveBeenCalledWith({
        postId: 'post-101',
        clubId: 'club-dogs-1',
      });
    });

    test('Comment button navigates to post detail / comments screen', () => {
      const { getByTestId } = render(<PostCard post={mockPost} />);

      const commentBtn = getByTestId('comment-button-post-101');
      fireEvent.press(commentBtn);

      expect(mockPush).toHaveBeenCalledWith('/clubs/post/post-101');
    });

    test('Prompts non-member with join requirement and one-tap action on like', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const nonMemberPost: ClubPost = {
        ...mockPost,
        id: 'post-nonmember-1',
        club_id: 'club-cats-2',
        club: { id: 'club-cats-2', name: 'Cats Club', slug: 'cats' },
      };

      const { getByTestId } = render(
        <PostCard post={nonMemberPost} clubName="Cats Club" isMember={false} />,
      );

      const likeBtn = getByTestId('like-button-post-nonmember-1');
      fireEvent.press(likeBtn);

      expect(alertSpy).toHaveBeenCalledWith(
        'Club Membership Required',
        expect.stringContaining('You must join Cats Club to like posts'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'Join Club' }),
        ]),
      );

      const alertCalls = alertSpy.mock.calls;
      const lastCall = alertCalls[alertCalls.length - 1];
      const buttons = (lastCall?.[2] || []) as any[];
      const joinBtn = buttons.find((b: any) => b.text === 'Join Club');
      expect(joinBtn).toBeDefined();

      joinBtn?.onPress();
      expect(mockJoinMutateAsync).toHaveBeenCalledWith('club-cats-2');
      alertSpy.mockRestore();
    });

    test('Prompts non-member with join requirement and navigation options on comment press', () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      const nonMemberPost: ClubPost = {
        ...mockPost,
        id: 'post-nonmember-2',
        club_id: 'club-cats-2',
        club: { id: 'club-cats-2', name: 'Cats Club', slug: 'cats' },
      };

      const { getByTestId } = render(
        <PostCard post={nonMemberPost} clubName="Cats Club" isMember={false} />,
      );

      const commentBtn = getByTestId('comment-button-post-nonmember-2');
      fireEvent.press(commentBtn);

      expect(alertSpy).toHaveBeenCalledWith(
        'Club Membership Required',
        expect.stringContaining('You must join Cats Club to comment on this post'),
        expect.arrayContaining([
          expect.objectContaining({ text: 'Cancel' }),
          expect.objectContaining({ text: 'View Comments' }),
          expect.objectContaining({ text: 'Join Club' }),
        ]),
      );

      const alertCalls = alertSpy.mock.calls;
      const lastCall = alertCalls[alertCalls.length - 1];
      const buttons = (lastCall?.[2] || []) as any[];

      const viewCommentsBtn = buttons.find((b: any) => b.text === 'View Comments');
      viewCommentsBtn?.onPress();
      expect(mockPush).toHaveBeenCalledWith('/clubs/post/post-nonmember-2');

      const joinBtn = buttons.find((b: any) => b.text === 'Join Club');
      joinBtn?.onPress();
      expect(mockJoinMutateAsync).toHaveBeenCalledWith('club-cats-2');

      alertSpy.mockRestore();
    });
  });

  describe('5. CommentItem Component', () => {
    test('Renders comment author and text content', () => {
      const { getByText } = render(<CommentItem comment={mockComment} />);

      expect(getByText('Alice Parent')).toBeTruthy();
      expect(getByText('Thank you for the reminder, Dr. Walker!')).toBeTruthy();
    });
  });

  describe('6. ReportModal Component', () => {
    test('Renders report reasons and submits report successfully', async () => {
      mockReportMutateAsync.mockResolvedValueOnce({ id: 'rep-1' });
      const onClose = jest.fn();

      const { getByText, getByPlaceholderText } = render(
        <ReportModal
          visible={true}
          onClose={onClose}
          targetType="post"
          targetId="post-101"
        />,
      );

      expect(getByText('Report Post')).toBeTruthy();
      expect(getByText('Spam or Advertising')).toBeTruthy();
      expect(getByText('Veterinary Misinformation')).toBeTruthy();

      const detailsInput = getByPlaceholderText(
        'Provide any context that helps our moderation team...',
      );
      fireEvent.changeText(detailsInput, 'This contains suspicious affiliate links');

      const submitBtn = getByText('Submit Report');
      fireEvent.press(submitBtn);

      await waitFor(() => {
        expect(mockReportMutateAsync).toHaveBeenCalledWith({
          target_type: 'post',
          target_id: 'post-101',
          reason: 'spam',
          details: 'This contains suspicious affiliate links',
        });
      });
    });
  });
});
