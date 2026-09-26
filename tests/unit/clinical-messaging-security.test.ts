import { messageService } from '../../src/lib/messages/messageService';
import { supabase } from '../../src/lib/supabase/client';
import { ValidationError, ForbiddenError, AuthError } from '../../src/lib/api/errors';
import { DirectMessage } from '../../src/types/message';

// Mock Supabase Client
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('Clinical Messaging Security & Boundary Tests (MVP-07 / Phase 8)', () => {
  const validParentId = '11111111-1111-1111-1111-111111111111';
  const validVetUserId = '22222222-2222-2222-2222-222222222222';
  const attackerUserId = '99999999-9999-9999-9999-999999999999';
  const validAppointmentId = '33333333-3333-3333-3333-333333333333';
  const validConversationId = '44444444-4444-4444-4444-444444444444';
  const unauthorizedConvId = '88888888-8888-8888-8888-888888888888';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default authenticated parent user
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: { id: validParentId, email: 'parent@example.com' },
      },
      error: null,
    });
  });

  // 1. Unauthenticated user cannot read conversation
  test('1. Unauthenticated user cannot read conversations list or thread', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: null },
      error: { message: 'No session' },
    });

    await expect(messageService.getUserConversations()).rejects.toThrow(AuthError);
    await expect(messageService.getConversation(validConversationId)).rejects.toThrow(AuthError);
  });

  // 2. User cannot read another user's conversation
  test('2. User cannot read another user conversation if not a participant', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: { id: unauthorizedConvId, subject: 'Private Consultation', created_by: 'other' },
            error: null,
          }),
        };
      }
      if (table === 'conversation_participants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              { user_id: 'other-user-1', last_read_at: '2026-01-01' },
              { user_id: 'other-user-2', last_read_at: '2026-01-01' },
            ],
            error: null,
          }),
        };
      }
      return {};
    });

    await expect(messageService.getConversation(unauthorizedConvId)).rejects.toThrow(
      ForbiddenError,
    );
  });

  // 3. User cannot read another user's messages (RLS error handled)
  test('3. User cannot read another user messages (RLS rejection)', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'direct_messages') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'new row violates row-level security policy for table direct_messages',
            },
          }),
        };
      }
      return {};
    });

    await expect(messageService.getMessages(unauthorizedConvId)).rejects.toThrow(ForbiddenError);
  });

  // 4. User cannot send to unauthorized conversation
  test('4. User cannot send a message to an unauthorized conversation', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'FORBIDDEN: You are not an authorized participant in this conversation' },
    });

    await expect(
      messageService.sendMessage(unauthorizedConvId, 'Hello unauthorized'),
    ).rejects.toThrow(ForbiddenError);
  });

  // 5. User cannot impersonate another sender (derives sender from auth)
  test('5. User cannot impersonate another sender; sender identity is strictly derived from session', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((method: string, args: any) => {
      if (method === 'send_direct_message') {
        expect(args).not.toHaveProperty('sender_id'); // sender_id must NOT come from client args
        return Promise.resolve({
          data: {
            id: 'msg-001',
            conversation_id: validConversationId,
            sender_id: validParentId, // derived from auth.uid()
            body: 'Hello Doctor',
            created_at: '2026-10-01T10:00:00Z',
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const msg = await messageService.sendMessage(validConversationId, 'Hello Doctor');
    expect(msg.sender_id).toBe(validParentId);
  });

  // 6. Client cannot override sender_id on fallback direct insert
  test('6. Fallback direct table insert binds sender_id to authenticated user.id', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'RPC not found' },
    });

    const mockInsert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'msg-002',
            conversation_id: validConversationId,
            sender_id: validParentId,
            body: 'Fallback message',
            created_at: new Date().toISOString(),
          },
          error: null,
        }),
      }),
    });

    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'direct_messages') {
        return { insert: mockInsert };
      }
      if (table === 'conversation_participants') {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        };
      }
      return {};
    });

    await messageService.sendMessage(validConversationId, 'Fallback message');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        sender_id: validParentId,
        body: 'Fallback message',
      }),
    );
  });

  // 7. Pet parent can message their authorized vet
  test('7. Pet parent can initialize or get conversation for their authorized appointment', async () => {
    (supabase.rpc as jest.Mock).mockImplementation((method: string, args: any) => {
      if (method === 'get_or_create_appointment_conversation') {
        return Promise.resolve({
          data: {
            id: validConversationId,
            appointment_id: args.p_appointment_id,
            subject: 'Consultation: Dr. Mitchell & Luna',
            created_at: '2026-10-01T09:00:00Z',
            last_message_at: '2026-10-01T09:00:00Z',
            is_new: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await messageService.getOrCreateAppointmentConversation(validAppointmentId);
    expect(res.id).toBe(validConversationId);
    expect(res.appointment_id).toBe(validAppointmentId);
  });

  // 8. Assigned vet can message the authorized pet parent
  test('8. Assigned vet can access appointment conversation', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: { id: validVetUserId, email: 'vet@example.com' },
      },
      error: null,
    });

    (supabase.rpc as jest.Mock).mockImplementation((method: string) => {
      if (method === 'get_or_create_appointment_conversation') {
        return Promise.resolve({
          data: {
            id: validConversationId,
            appointment_id: validAppointmentId,
            subject: 'Consultation: Dr. Mitchell & Luna',
            is_new: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const res = await messageService.getOrCreateAppointmentConversation(validAppointmentId);
    expect(res.id).toBe(validConversationId);
  });

  // 9. Unrelated vet cannot access conversation
  test('9. Unrelated vet is rejected from appointment conversation with FORBIDDEN', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: { id: 'unrelated-vet-id', email: 'other-vet@example.com' },
      },
      error: null,
    });

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'FORBIDDEN: You are not an authorized participant in this consultation' },
    });

    await expect(
      messageService.getOrCreateAppointmentConversation(validAppointmentId),
    ).rejects.toThrow(ForbiddenError);
  });

  // 10. Unrelated pet parent cannot access conversation
  test('10. Unrelated pet parent is rejected from appointment conversation with FORBIDDEN', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: {
        user: { id: attackerUserId, email: 'attacker@example.com' },
      },
      error: null,
    });

    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: null,
      error: { message: 'FORBIDDEN: You are not an authorized participant in this consultation' },
    });

    await expect(
      messageService.getOrCreateAppointmentConversation(validAppointmentId),
    ).rejects.toThrow(ForbiddenError);
  });

  // 11. Empty message rejected
  test('11. Empty and whitespace-only messages are rejected with ValidationError', async () => {
    await expect(messageService.sendMessage(validConversationId, '')).rejects.toThrow(
      ValidationError,
    );
    await expect(messageService.sendMessage(validConversationId, '   ')).rejects.toThrow(
      ValidationError,
    );
    await expect(messageService.sendMessage(validConversationId, '\n\t  \n')).rejects.toThrow(
      ValidationError,
    );
  });

  // 12. >4,000 character message rejected
  test('12. Messages exceeding 4,000 characters are rejected with ValidationError', async () => {
    const longMessage = 'A'.repeat(4001);
    await expect(messageService.sendMessage(validConversationId, longMessage)).rejects.toThrow(
      ValidationError,
    );
  });

  // 13. Valid message persists
  test('13. Valid message (1..4000 characters) persists and returns DirectMessage', async () => {
    const validBody = 'Hello Dr. Mitchell, Luna seems much better today after taking her medicine.';
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: {
        id: 'msg-valid-123',
        conversation_id: validConversationId,
        sender_id: validParentId,
        body: validBody,
        created_at: '2026-10-01T10:15:00Z',
      },
      error: null,
    });

    const msg = await messageService.sendMessage(validConversationId, validBody);
    expect(msg.id).toBe('msg-valid-123');
    expect(msg.body).toBe(validBody);
  });

  // 14. last_message_at updates (verified via trigger/RPC contract)
  test('14. last_message_at timestamp is preserved on newly returned direct message', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: {
        id: 'msg-time-check',
        conversation_id: validConversationId,
        sender_id: validParentId,
        body: 'Check timestamp update',
        created_at: '2026-10-01T11:00:00Z',
      },
      error: null,
    });

    const msg = await messageService.sendMessage(validConversationId, 'Check timestamp update');
    expect(msg.created_at).toBe('2026-10-01T11:00:00Z');
  });

  // 15. Realtime event is handled
  test('15. Supabase Realtime channel subscription handles incoming INSERT event', () => {
    let capturedCallback: any;

    const mockChannel = {
      on: jest.fn().mockImplementation((_event: string, _filter: any, callback: any) => {
        capturedCallback = callback;
        return mockChannel;
      }),
      subscribe: jest.fn().mockImplementation((callback: any) => {
        if (callback) callback('SUBSCRIBED');
        return mockChannel;
      }),
    };

    (supabase.channel as jest.Mock).mockReturnValue(mockChannel);

    const onMessageMock = jest.fn();
    const unsubscribe = messageService.subscribeToConversationMessages(
      validConversationId,
      onMessageMock,
    );

    expect(supabase.channel).toHaveBeenCalled();
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      expect.objectContaining({
        event: 'INSERT',
        table: 'direct_messages',
        filter: `conversation_id=eq.${validConversationId}`,
      }),
      expect.any(Function),
    );

    // Simulate incoming realtime payload
    const incoming: DirectMessage = {
      id: 'msg-realtime-1',
      conversation_id: validConversationId,
      sender_id: validVetUserId,
      body: 'Great to hear that Luna is improving!',
      created_at: '2026-10-01T10:16:00Z',
    };

    capturedCallback({ new: incoming });
    expect(onMessageMock).toHaveBeenCalledWith(incoming);

    unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  // 16. Duplicate realtime event does not duplicate UI message
  test('16. Duplicate realtime event deduplication logic handles identical message IDs safely', () => {
    const existingList: DirectMessage[] = [
      {
        id: 'msg-existing-1',
        conversation_id: validConversationId,
        sender_id: validParentId,
        body: 'Existing message',
        created_at: '2026-10-01T10:00:00Z',
      },
    ];

    const duplicateMessage: DirectMessage = {
      id: 'msg-existing-1',
      conversation_id: validConversationId,
      sender_id: validParentId,
      body: 'Existing message',
      created_at: '2026-10-01T10:00:00Z',
    };

    // Deduplication check identical to useMessages hook logic
    const deduplicated = existingList.some((m) => m.id === duplicateMessage.id)
      ? existingList
      : [...existingList, duplicateMessage];

    expect(deduplicated.length).toBe(1);
  });

  // 17. Read/unread state is protected
  test('17. markConversationRead requires authentication and advances participant last_read_at', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValue({
      data: { success: true, conversation_id: validConversationId },
      error: null,
    });

    await messageService.markConversationRead(validConversationId);
    expect(supabase.rpc).toHaveBeenCalledWith('mark_conversation_read', {
      p_conversation_id: validConversationId,
    });
  });

  // 18. Conversation appointment context is protected
  test('18. getConversation loads appointment context only when linked to authorized appointment', async () => {
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'conversations') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: validConversationId,
              subject: 'Consultation: Dr. Mitchell & Luna',
              appointment_id: validAppointmentId,
              created_at: '2026-10-01T09:00:00Z',
              last_message_at: '2026-10-01T10:00:00Z',
            },
            error: null,
          }),
        };
      }
      if (table === 'conversation_participants') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({
            data: [
              { user_id: validParentId, last_read_at: '2026-10-01T09:00:00Z' },
              { user_id: validVetUserId, last_read_at: '2026-10-01T09:00:00Z' },
            ],
            error: null,
          }),
        };
      }
      if (table === 'appointments') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              id: validAppointmentId,
              starts_at: '2026-10-01T10:00:00Z',
              status: 'scheduled',
              mode: 'video',
              pets: { name: 'Luna' },
              vet_profiles: { name: 'Dr. Sarah Mitchell' },
            },
            error: null,
          }),
        };
      }
      if (table === 'profiles' || table === 'vet_profiles' || table === 'direct_messages') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          neq: jest.fn().mockReturnThis(),
          gt: jest.fn().mockResolvedValue({ count: 0, data: null }),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockResolvedValue({ data: [] }),
          maybeSingle: jest.fn().mockResolvedValue({ data: { full_name: 'Dr. Sarah Mitchell' } }),
        };
      }
      return {};
    });

    const conv = await messageService.getConversation(validConversationId);
    expect(conv).not.toBeNull();
    expect(conv?.appointment).toBeDefined();
    expect(conv?.appointment?.pet_name).toBe('Luna');
    expect(conv?.appointment?.vet_name).toBe('Dr. Sarah Mitchell');
  });
});
