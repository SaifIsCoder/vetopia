import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import NotificationsScreen from '../../app/notifications';
import { NotificationBell } from '../../src/components/notifications/NotificationBell';
import { NotificationItem } from '../../src/components/notifications/NotificationItem';
import type { AppNotification } from '../../src/types/notification';

// Mock Router
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

// Mock Hooks
const mockNotifications: AppNotification[] = [
  {
    id: 'notif-1',
    user_id: 'user-1',
    type: 'appointment_confirmed',
    title: 'Consultation Confirmed',
    body: 'Your consultation with Dr. Mitchell is scheduled.',
    data: { kind: 'appointment_confirmed', appointmentId: 'appt-1' },
    read: false,
    created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago
  },
  {
    id: 'notif-2',
    user_id: 'user-1',
    type: 'appointment_reminder',
    title: 'Consultation Starting Soon',
    body: 'Starts in 15 minutes.',
    data: { kind: 'appointment_reminder', appointmentId: 'appt-1' },
    read: true,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
  },
];

const mockMarkRead = jest.fn();
const mockMarkAllRead = jest.fn();
const mockRefetch = jest.fn();

let mockIsLoading = false;
let mockIsError = false;
let mockNotifsList: AppNotification[] = mockNotifications;
let mockUnreadCount = 1;

jest.mock('../../src/hooks/useNotifications', () => ({
  useNotifications: () => ({
    data: mockNotifsList,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refetch: mockRefetch,
    isRefetching: false,
  }),
  useUnreadNotificationCount: () => ({
    data: mockUnreadCount,
  }),
  useMarkNotificationRead: () => ({
    mutate: mockMarkRead,
    isPending: false,
  }),
  useMarkAllNotificationsRead: () => ({
    mutate: mockMarkAllRead,
    isPending: false,
  }),
}));

describe('Notifications UI Components & Screens Tests (MVP-08)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsLoading = false;
    mockIsError = false;
    mockNotifsList = mockNotifications;
    mockUnreadCount = 1;
  });

  // 1. Screen renders title and items
  test('1. NotificationsScreen renders header and notification items', () => {
    const { getByText } = render(<NotificationsScreen />);

    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('Consultation Confirmed')).toBeTruthy();
    expect(getByText('Consultation Starting Soon')).toBeTruthy();
    expect(getByText('1 new')).toBeTruthy();
  });

  // 2. Empty state renders when list is empty
  test('2. Empty state renders when notifications array is empty', () => {
    mockNotifsList = [];
    const { getByText } = render(<NotificationsScreen />);

    expect(getByText('No Notifications Yet')).toBeTruthy();
    expect(getByText(/You will be alerted here for consultation confirmations/i)).toBeTruthy();
  });

  // 3. Loading state displays indicator
  test('3. Loading state displays loading indicator', () => {
    mockIsLoading = true;
    const { UNSAFE_getByType } = render(<NotificationsScreen />);

    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  // 4. Error state renders error card with retry button
  test('4. Error state renders error card with retry button', () => {
    mockIsError = true;
    const { getByText } = render(<NotificationsScreen />);

    expect(getByText('Failed to load notifications')).toBeTruthy();
    const retryBtn = getByText('Retry');
    fireEvent.press(retryBtn);
    expect(mockRefetch).toHaveBeenCalled();
  });

  // 5. Mark all as read button triggers mutation
  test('5. Tapping "Read all" triggers markAllNotificationsRead', () => {
    const { getByText } = render(<NotificationsScreen />);

    const markAllBtn = getByText('Read all');
    fireEvent.press(markAllBtn);
    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  // 6. Tapping an unread notification marks as read and navigates
  test('6. Tapping an unread notification marks it as read and navigates', async () => {
    const { getByText } = render(<NotificationsScreen />);

    const item = getByText('Consultation Confirmed');
    fireEvent.press(item);

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith('notif-1');
      expect(mockPush).toHaveBeenCalledWith('/appointments');
    });
  });

  // 7. Back button triggers router.back
  test('7. Back button navigates back', () => {
    const { getByLabelText } = render(<NotificationsScreen />);

    const backButton = getByLabelText('Back');
    fireEvent.press(backButton);
    expect(mockBack).toHaveBeenCalled();
  });

  // 8. NotificationItem renders distinct icons and relative time
  test('8. NotificationItem formats relative timestamp', () => {
    const handlePress = jest.fn();
    const { getByText } = render(
      <NotificationItem notification={mockNotifications[0]} onPress={handlePress} />,
    );

    expect(getByText('5m ago')).toBeTruthy();
    expect(getByText('Consultation Confirmed')).toBeTruthy();
  });

  // 9. NotificationBell renders bell icon and badge
  test('9. NotificationBell renders unread count badge when > 0', () => {
    mockUnreadCount = 4;
    const { getByText, getByRole } = render(<NotificationBell />);

    expect(getByText('4')).toBeTruthy();
    const bellBtn = getByRole('button');
    fireEvent.press(bellBtn);
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  // 10. NotificationBell hides badge when unreadCount is 0
  test('10. NotificationBell hides badge when unreadCount is 0', () => {
    mockUnreadCount = 0;
    const { queryByText } = render(<NotificationBell />);

    expect(queryByText('0')).toBeNull();
  });
});
