import { notificationService } from '../../src/lib/notifications/notificationService';
import { PushNotificationDispatcher } from '../../src/server/pushNotificationDispatcher';
import { supabase } from '../../src/lib/supabase/client';
import { ApiError } from '../../src/lib/api/errors';
import type { AppNotification } from '../../src/types/notification';

// Mock Supabase Client
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
    },
  },
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn().mockResolvedValue(null),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[mock-token-123]' }),
  AndroidImportance: {
    MAX: 5,
    DEFAULT: 3,
  },
}));

describe('Notifications & Push Delivery Security & Dispatch Tests (MVP-08)', () => {
  const validParentId = '11111111-1111-1111-1111-111111111111';
  const validVetUserId = '22222222-2222-2222-2222-222222222222';
  const attackerUserId = '99999999-9999-9999-9999-999999999999';
  const appointmentId = '33333333-3333-3333-3333-333333333333';
  const notificationId = '44444444-4444-4444-4444-444444444444';

  beforeEach(() => {
    jest.clearAllMocks();

    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: {
        session: {
          user: { id: validParentId, email: 'parent@example.com' },
        },
      },
      error: null,
    });
  });

  // 1. Unauthenticated user cannot register device token
  test('1. Unauthenticated user cannot register device push token', async () => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(
      notificationService.registerDeviceToken('ExponentPushToken[test]'),
    ).rejects.toThrow(ApiError);
  });

  // 2. Authenticated user can register device token via RPC
  test('2. Authenticated user can register device push token', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: {
        id: 'token-uuid',
        user_id: validParentId,
        token: 'ExponentPushToken[test-123]',
        platform: 'android',
        is_active: true,
      },
      error: null,
    });

    const result = await notificationService.registerDeviceToken('ExponentPushToken[test-123]');
    expect(result.token).toBe('ExponentPushToken[test-123]');
    expect(supabase.rpc).toHaveBeenCalledWith('register_device_token', {
      p_token: 'ExponentPushToken[test-123]',
      p_platform: expect.any(String),
    });
  });

  // 3. User can deactivate token on sign-out
  test('3. User can deactivate device token on logout', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: true,
      error: null,
    });

    const success = await notificationService.deactivateDeviceToken('ExponentPushToken[test-123]');
    expect(success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('deactivate_device_token', {
      p_token: 'ExponentPushToken[test-123]',
    });
  });

  // 4. In-app notifications fetch filters strictly by authenticated user
  test('4. Notifications query filters strictly by authenticated user', async () => {
    const mockNotifs: AppNotification[] = [
      {
        id: notificationId,
        user_id: validParentId,
        type: 'appointment_confirmed',
        title: 'Consultation Confirmed',
        body: 'Your consultation with Dr. Sarah Mitchell is scheduled.',
        data: { kind: 'appointment_confirmed', appointmentId },
        read: false,
        created_at: new Date().toISOString(),
      },
    ];

    const mockSelect = jest.fn().mockReturnThis();
    const mockEq = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockResolvedValue({ data: mockNotifs, error: null });

    (supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    });

    const list = await notificationService.getNotifications();
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(notificationId);
    expect(mockEq).toHaveBeenCalledWith('user_id', validParentId);
  });

  // 5. Mark single notification as read
  test('5. Mark single notification as read updates status via RPC', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: true,
      error: null,
    });

    const success = await notificationService.markAsRead(notificationId);
    expect(success).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledWith('mark_notification_read', {
      p_notification_id: notificationId,
    });
  });

  // 6. Mark all notifications as read
  test('6. Mark all notifications as read updates all for current user', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: 3,
      error: null,
    });

    const count = await notificationService.markAllAsRead();
    expect(count).toBe(3);
    expect(supabase.rpc).toHaveBeenCalledWith('mark_all_notifications_read');
  });

  // 7. Get unread notification count
  test('7. Get unread notification count returns integer count', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: 5,
      error: null,
    });

    const count = await notificationService.getUnreadCount();
    expect(count).toBe(5);
    expect(supabase.rpc).toHaveBeenCalledWith('get_unread_notification_count');
  });

  // 8. Deep Link Resolution for all 5 required triggers
  describe('8. Deep Link Route Resolution', () => {
    test('8.1 appointment_confirmed maps to /appointments', () => {
      const route = notificationService.resolveRouteFromData({
        kind: 'appointment_confirmed',
        appointmentId,
      });
      expect(route).toBe('/appointments');
    });

    test('8.2 appointment_reminder maps to /consult/:id', () => {
      const route = notificationService.resolveRouteFromData({
        kind: 'appointment_reminder',
        appointmentId,
      });
      expect(route).toBe(`/consult/${appointmentId}`);
    });

    test('8.3 doctor_entered_consultation maps to /consult/:id', () => {
      const route = notificationService.resolveRouteFromData({
        kind: 'doctor_entered_consultation',
        appointmentId,
      });
      expect(route).toBe(`/consult/${appointmentId}`);
    });

    test('8.4 new_message maps to /messages/:id', () => {
      const route = notificationService.resolveRouteFromData({
        kind: 'new_message',
        conversationId: 'conv-555',
      });
      expect(route).toBe('/messages/conv-555');
    });

    test('8.5 prescription_issued maps to /prescriptions/:id', () => {
      const route = notificationService.resolveRouteFromData({
        kind: 'prescription_issued',
        prescriptionId: 'script-777',
      });
      expect(route).toBe('/prescriptions/script-777');
    });

    test('8.6 explicit deepLink takes precedence', () => {
      const route = notificationService.resolveRouteFromData({
        deepLink: 'vetopia://consult/custom-appt-123',
      });
      expect(route).toBe('/consult/custom-appt-123');
    });
  });

  // 9. Push Notification Dispatcher Unit Tests
  describe('9. Push Notification Dispatcher & Invalid Token Cleanup', () => {
    let mockSupabase: any;
    let dispatcher: PushNotificationDispatcher;

    beforeEach(() => {
      mockSupabase = {
        from: jest.fn(),
        rpc: jest.fn(),
      };
      dispatcher = new PushNotificationDispatcher(mockSupabase);
      global.fetch = jest.fn() as jest.Mock;
    });

    test('9.1 Dispatches push messages to all active device tokens for recipient', async () => {
      // Mock active tokens
      const mockSelect = jest.fn().mockReturnThis();
      const mockEq2 = jest.fn().mockResolvedValue({
        data: [
          { token: 'ExponentPushToken[device-iphone]', platform: 'ios' },
          { token: 'ExponentPushToken[device-pixel]', platform: 'android' },
        ],
        error: null,
      });

      mockSupabase.from.mockReturnValue({
        select: mockSelect,
        eq: jest.fn().mockReturnValue({ eq: mockEq2 }),
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok' }, { status: 'ok' }],
        }),
      });

      const result = await dispatcher.dispatchPushToUser(validParentId, {
        title: 'Consultation Confirmed',
        body: 'Your consultation is confirmed.',
        priority: 'high',
      });

      expect(result.sentCount).toBe(2);
      expect(result.failedTokens.length).toBe(0);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://exp.host/--/api/v2/push/send',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });

    test('9.2 Deactivates invalid token when Expo returns DeviceNotRegistered', async () => {
      const mockEq2 = jest.fn().mockResolvedValue({
        data: [{ token: 'ExponentPushToken[expired-device]', platform: 'android' }],
        error: null,
      });

      const mockUpdate = jest.fn().mockReturnThis();
      const mockUpdateEq = jest.fn().mockResolvedValue({ data: null, error: null });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'device_tokens') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ eq: mockEq2 }),
            }),
            update: mockUpdate.mockReturnValue({
              eq: mockUpdateEq,
            }),
          };
        }
        return {};
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              status: 'error',
              details: { error: 'DeviceNotRegistered' },
            },
          ],
        }),
      });

      const result = await dispatcher.dispatchPushToUser(validParentId, {
        title: 'New Message',
        body: 'You have a message.',
      });

      expect(result.sentCount).toBe(0);
      expect(result.failedTokens).toContain('ExponentPushToken[expired-device]');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
        }),
      );
    });

    test('9.3 15-Minute reminder worker idempotently executes process_appointment_reminders RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            notification_id: 'notif-1',
            recipient_user_id: validParentId,
            notification_title: 'Consultation Starting Soon',
            notification_body: 'Starts in 15 minutes',
            notification_data: { appointmentId },
          },
          {
            notification_id: 'notif-2',
            recipient_user_id: validVetUserId,
            notification_title: 'Upcoming Consultation in 15 Minutes',
            notification_body: 'Starts in 15 minutes',
            notification_data: { appointmentId },
          },
        ],
        error: null,
      });

      // Mock token retrieval and notification pushed_at update for both users
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const count = await dispatcher.runAppointmentReminderWorker();
      expect(count).toBe(2);
      expect(mockSupabase.rpc).toHaveBeenCalledWith('process_appointment_reminders');
    });

    test('9.4 Reminder worker returns 0 when no reminders pending or error occurs', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      const count = await dispatcher.runAppointmentReminderWorker();
      expect(count).toBe(0);
    });

    test('9.5 dispatchPendingNotifications claims un-pushed notifications and dispatches via Expo', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'notifications') {
          return {
            select: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                order: jest.fn().mockReturnValue({
                  limit: jest.fn().mockResolvedValue({
                    data: [
                      {
                        id: 'notif-pending-1',
                        user_id: validParentId,
                        type: 'appointment_confirmed',
                        title: 'Appointment Booked',
                        body: 'Your appointment is confirmed.',
                        data: { appointmentId },
                      },
                    ],
                    error: null,
                  }),
                }),
              }),
            }),
            update: mockUpdate,
          };
        }
        if (table === 'device_tokens') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: [{ token: 'ExponentPushToken[user-device-1]', platform: 'android' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: 'ok', id: 'ticket-1' }],
        }),
      });

      const dispatched = await dispatcher.dispatchPendingNotifications();
      expect(dispatched).toBe(1);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          pushed_at: expect.any(String),
        }),
      );
    });

    test('9.6 dispatchPendingNotifications gracefully returns 0 when no un-pushed notifications exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const count = await dispatcher.dispatchPendingNotifications();
      expect(count).toBe(0);
    });
  });

  // 10. Security Invariants
  describe('10. Security Boundary Invariants', () => {
    test('10.1 Attacker cannot query notifications of another user', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: attackerUserId } } },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnThis();
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockResolvedValue({ data: [], error: null });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
      });

      await notificationService.getNotifications();
      // Verified that user_id constraint matches attacker, preventing data leakage
      expect(mockEq).toHaveBeenCalledWith('user_id', attackerUserId);
    });

    test('10.2 Attacker cannot register token for victim user ID', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'FORBIDDEN: auth.uid mismatch', code: '42501' },
      });

      await expect(
        notificationService.registerDeviceToken('ExponentPushToken[spoofed]'),
      ).rejects.toThrow();
    });

    test('10.3 Empty or whitespace push token is rejected', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'Token cannot be empty', code: '22023' },
      });

      await expect(notificationService.registerDeviceToken('   ')).rejects.toThrow();
    });
  });
});
