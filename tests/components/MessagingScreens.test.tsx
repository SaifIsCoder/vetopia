import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import MessagesScreen from '../../app/(tabs)/messages';
import MessageThreadScreen from '../../app/messages/[id]';
import { ConversationSummary, DirectMessage } from '../../src/types/message';

// Mock Router
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({
    id: 'conv-123',
  }),
}));

// Mock Auth Store
const mockUser = {
  id: 'user-parent-1',
  email: 'parent@example.com',
  fullName: 'Sarah Jenkins',
  roles: ['pet_parent'] as any,
  onboarded: true,
  isVet: false,
};

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: (selector: any) => selector({ user: mockUser }),
}));

// Sample Data
const sampleConversations: ConversationSummary[] = [
  {
    id: 'conv-123',
    subject: 'Consultation: Dr. Mitchell & Luna',
    appointment_id: 'apt-001',
    created_at: '2026-10-01T10:00:00Z',
    last_message_at: '2026-10-01T10:30:00Z',
    unread_count: 2,
    last_message: {
      id: 'msg-002',
      body: 'Please ensure Luna stays hydrated.',
      sender_id: 'vet-user-1',
      created_at: '2026-10-01T10:30:00Z',
    },
    counterpart: {
      user_id: 'vet-user-1',
      name: 'Dr. Sarah Mitchell',
      role: 'vet',
      specialty: 'Dermatology & General Care',
    },
    appointment: {
      id: 'apt-001',
      starts_at: '2026-10-01T10:00:00Z',
      status: 'scheduled',
      mode: 'video',
      pet_name: 'Luna',
      vet_name: 'Dr. Sarah Mitchell',
    },
  },
];

const sampleMessages: DirectMessage[] = [
  {
    id: 'msg-001',
    conversation_id: 'conv-123',
    sender_id: 'user-parent-1', // current user
    body: 'Hello Dr. Mitchell, Luna seems much better today.',
    created_at: '2026-10-01T10:15:00Z',
  },
  {
    id: 'msg-002',
    conversation_id: 'conv-123',
    sender_id: 'vet-user-1', // counterpart
    body: 'Please ensure Luna stays hydrated.',
    created_at: '2026-10-01T10:30:00Z',
  },
];

// Hook Mocks
let mockConversationsReturn: any = {
  data: sampleConversations,
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  isRefetching: false,
};

let mockConversationReturn: any = {
  data: sampleConversations[0],
  isLoading: false,
  isError: false,
  error: null,
};

let mockMessagesReturn: any = {
  data: sampleMessages,
  isLoading: false,
  isError: false,
};

const mockSendMessageMutate = jest.fn();
const mockMarkReadMutate = jest.fn();

jest.mock('../../src/hooks/useMessages', () => ({
  useConversations: () => mockConversationsReturn,
  useConversation: () => mockConversationReturn,
  useMessages: () => mockMessagesReturn,
  useSendMessage: () => ({
    mutateAsync: mockSendMessageMutate,
    isPending: false,
  }),
  useMarkConversationRead: () => ({
    mutate: mockMarkReadMutate,
  }),
  useUnreadMessageCount: () => ({
    data: 2,
    isLoading: false,
  }),
}));

describe('Clinical Messaging UI Components (SCR-TAB-004 & SCR-MSG-001)', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockConversationsReturn = {
      data: sampleConversations,
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    };

    mockConversationReturn = {
      data: sampleConversations[0],
      isLoading: false,
      isError: false,
      error: null,
    };

    mockMessagesReturn = {
      data: sampleMessages,
      isLoading: false,
      isError: false,
    };
  });

  describe('1. Clinical Messages Inbox Screen (SCR-TAB-004)', () => {
    test('Renders header, unread badge, and conversation card with counterpart details', () => {
      const { getByText } = render(<MessagesScreen />);

      expect(getByText('Messages')).toBeTruthy();
      expect(getByText('2 new')).toBeTruthy();
      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText('Doctor')).toBeTruthy();
      expect(getByText('Please ensure Luna stays hydrated.')).toBeTruthy();
      expect(getByText('Luna · Oct 1')).toBeTruthy();
    });

    test('Tapping a conversation card navigates to /messages/[id]', () => {
      const { getByText } = render(<MessagesScreen />);

      fireEvent.press(getByText('Dr. Sarah Mitchell'));
      expect(mockPush).toHaveBeenCalledWith('/messages/conv-123');
    });

    test('Renders EmptyState when no conversations exist and CTA navigates to /vets', () => {
      mockConversationsReturn = {
        data: [],
        isLoading: false,
        isError: false,
      };

      const { getByText } = render(<MessagesScreen />);

      expect(getByText('No conversations yet')).toBeTruthy();
      const browseBtn = getByText('Browse Veterinarians');
      expect(browseBtn).toBeTruthy();

      fireEvent.press(browseBtn);
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/vets');
    });

    test('Renders loading indicator while conversations are loading', () => {
      mockConversationsReturn = {
        data: undefined,
        isLoading: true,
        isError: false,
      };

      const { getByText } = render(<MessagesScreen />);
      expect(getByText('Loading conversations...')).toBeTruthy();
    });

    test('Renders error state with retry action when query fails', () => {
      const mockRefetch = jest.fn();
      mockConversationsReturn = {
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Network failure'),
        refetch: mockRefetch,
      };

      const { getByText } = render(<MessagesScreen />);
      expect(getByText('Failed to load messages')).toBeTruthy();

      const retryBtn = getByText('Try Again');
      fireEvent.press(retryBtn);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('2. MessageThreadScreen (SCR-MSG-001)', () => {
    test('Renders header, appointment context banner, and message bubbles', () => {
      const { getByText, getAllByText } = render(<MessageThreadScreen />);

      expect(getAllByText('Dr. Sarah Mitchell').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Dermatology & General Care')).toBeTruthy();
      expect(getByText('Luna · Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText('Hello Dr. Mitchell, Luna seems much better today.')).toBeTruthy();
      expect(getByText('Please ensure Luna stays hydrated.')).toBeTruthy();
    });

    test('Automatically invokes markRead mutation on mount', () => {
      render(<MessageThreadScreen />);
      expect(mockMarkReadMutate).toHaveBeenCalledWith('conv-123');
    });

    test('Composer disables send action when input is empty or whitespace only', () => {
      const { getByLabelText } = render(<MessageThreadScreen />);

      const sendBtn = getByLabelText('Send message');
      expect(sendBtn.props.accessibilityState.disabled).toBe(true);

      const input = getByLabelText('Message input');
      fireEvent.changeText(input, '    ');
      expect(sendBtn.props.accessibilityState.disabled).toBe(true);
    });

    test('Entering text and pressing send invokes sendMessage mutation and clears input', async () => {
      mockSendMessageMutate.mockResolvedValueOnce({
        id: 'msg-003',
        conversation_id: 'conv-123',
        sender_id: 'user-parent-1',
        body: 'Thank you doctor!',
        created_at: new Date().toISOString(),
      });

      const { getByLabelText } = render(<MessageThreadScreen />);

      const input = getByLabelText('Message input');
      const sendBtn = getByLabelText('Send message');

      fireEvent.changeText(input, 'Thank you doctor!');
      expect(sendBtn.props.accessibilityState.disabled).toBe(false);

      fireEvent.press(sendBtn);

      await waitFor(() => {
        expect(mockSendMessageMutate).toHaveBeenCalledWith({
          conversationId: 'conv-123',
          body: 'Thank you doctor!',
        });
      });
    });

    test('Renders EmptyState when thread has no messages', () => {
      mockMessagesReturn = {
        data: [],
        isLoading: false,
        isError: false,
      };

      const { getByText } = render(<MessageThreadScreen />);
      expect(getByText('Start the conversation')).toBeTruthy();
    });

    test('Renders error banner when conversation is unauthorized or not found', () => {
      mockConversationReturn = {
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('You are not authorized to access this conversation.'),
      };

      const { getByText } = render(<MessageThreadScreen />);
      expect(getByText('Conversation Unavailable')).toBeTruthy();
      expect(getByText('You are not authorized to access this conversation.')).toBeTruthy();

      const backBtn = getByText('Return to Inbox');
      fireEvent.press(backBtn);
      expect(mockBack).toHaveBeenCalled();
    });

    test('Back button in header navigates back to previous screen', () => {
      const { getByLabelText } = render(<MessageThreadScreen />);

      const backBtn = getByLabelText('Back to messages');
      fireEvent.press(backBtn);
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
