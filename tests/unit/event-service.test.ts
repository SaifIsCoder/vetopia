import { eventService } from '../../src/lib/events/eventService';
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

describe('EventService — Comprehensive Unit & Security Tests', () => {
  const mockPetParent = { id: 'user-parent-1', email: 'parent@example.com' };
  const mockVet = { id: 'user-vet-1', email: 'vet@vetopia.com' };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Discovery & Filtering', () => {
    test('getEvents applies upcoming filter and category', async () => {
      const mockEvents = [
        {
          id: 'evt-1',
          slug: 'senior-dog-nutrition',
          title: 'Senior Dog Nutrition',
          description: 'A clinical webinar on nutritional requirements for senior canines.',
          cover_image: null,
          category: 'Webinar',
          event_type: 'virtual',
          location_or_url: 'https://meet.vetopia.com/nutrition',
          start_time: '2026-10-26T14:00:00Z',
          end_time: '2026-10-26T15:30:00Z',
          organizer_id: mockVet.id,
          organizer_name: 'Dr. Sarah Wilson',
          status: 'published',
          created_at: '2026-10-24T00:00:00Z',
          updated_at: '2026-10-24T00:00:00Z',
          organizer: { id: mockVet.id, full_name: 'Dr. Sarah Wilson', avatar_url: null },
        },
      ];

      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        ilike: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: mockEvents, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const events = await eventService.getEvents('upcoming', 'Webinar');
      expect(supabase.from).toHaveBeenCalledWith('events');
      expect(events).toHaveLength(1);
      expect(events[0].id).toBe('evt-1');
      expect(events[0].event_type).toBe('virtual');
    });

    test('falls back to DEFAULT_SEED_EVENTS when table does not exist', async () => {
      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        neq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({
            data: null,
            error: { code: '42P01', message: 'relation "events" does not exist' },
          }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const events = await eventService.getEvents('upcoming');
      expect(events.length).toBeGreaterThan(0);
      expect(events[0].title).toBeDefined();
    });

    test('getEventByIdOrSlug finds event with fallback', async () => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null,
          error: { code: '42P01', message: 'relation does not exist' },
        }),
      };

      (supabase.from as jest.Mock).mockReturnValue(queryBuilder);

      const event = await eventService.getEventByIdOrSlug(
        'clinical-canine-nutrition-webinar',
      );
      expect(event).toBeDefined();
      expect(event.category).toBe('Webinar');
    });
  });

  describe('2. Validation Rules', () => {
    test('createEvent validates title length (3 to 150 chars)', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      await expect(
        eventService.createEvent({
          title: 'No',
          description: 'Valid description that has sufficient length for an event.',
          category: 'Webinar',
          event_type: 'virtual',
          location_or_url: 'https://meet.vetopia.com',
          start_time: '2026-10-26T14:00:00Z',
          end_time: '2026-10-26T15:30:00Z',
          organizer_name: 'Dr. Vet',
        }),
      ).rejects.toThrow(ValidationError);
    });

    test('createEvent validates description length (>= 20 chars)', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      await expect(
        eventService.createEvent({
          title: 'Valid Event Title',
          description: 'Too short',
          category: 'Webinar',
          event_type: 'virtual',
          location_or_url: 'https://meet.vetopia.com',
          start_time: '2026-10-26T14:00:00Z',
          end_time: '2026-10-26T15:30:00Z',
          organizer_name: 'Dr. Vet',
        }),
      ).rejects.toThrow(ValidationError);
    });

    test('createEvent enforces end_time > start_time', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      await expect(
        eventService.createEvent({
          title: 'Valid Event Title',
          description: 'Valid description of sufficient length for an event test.',
          category: 'Webinar',
          event_type: 'virtual',
          location_or_url: 'https://meet.vetopia.com',
          start_time: '2026-10-26T15:00:00Z',
          end_time: '2026-10-26T14:00:00Z', // end is before start!
          organizer_name: 'Dr. Vet',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('3. Authorization & Permissions', () => {
    test('createEvent rejects unauthenticated user with AuthError', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(
        eventService.createEvent({
          title: 'Valid Event Title',
          description: 'Valid description of sufficient length for an event test.',
          category: 'Webinar',
          event_type: 'virtual',
          location_or_url: 'https://meet.vetopia.com',
          start_time: '2026-10-26T14:00:00Z',
          end_time: '2026-10-26T15:30:00Z',
          organizer_name: 'Dr. Vet',
        }),
      ).rejects.toThrow(AuthError);
    });

    test('createEvent rejects unverified non-vet user with ForbiddenError', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockPetParent } },
      });

      const rolesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ role: 'pet_parent' }], error: null }),
      };

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
        eventService.createEvent({
          title: 'Valid Event Title',
          description: 'Valid description of sufficient length for an event test.',
          category: 'Webinar',
          event_type: 'virtual',
          location_or_url: 'https://meet.vetopia.com',
          start_time: '2026-10-26T14:00:00Z',
          end_time: '2026-10-26T15:30:00Z',
          organizer_name: 'Dr. Vet',
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    test('verified veterinarian can create event successfully', async () => {
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

      const createdRow = {
        id: 'new-evt-1',
        slug: 'valid-event-title',
        title: 'Valid Event Title',
        description: 'Valid description of sufficient length for an event test.',
        category: 'Webinar',
        event_type: 'virtual',
        location_or_url: 'https://meet.vetopia.com',
        start_time: '2026-10-26T14:00:00Z',
        end_time: '2026-10-26T15:30:00Z',
        organizer_id: mockVet.id,
        organizer_name: 'Dr. Vet',
        status: 'published',
        cover_image: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        organizer: { id: mockVet.id, full_name: 'Dr. Vet', avatar_url: null },
      };

      const eventsBuilder = {
        insert: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: createdRow, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_roles') return rolesBuilder;
        if (table === 'vet_profiles') return vetBuilder;
        if (table === 'events') return eventsBuilder;
        return {};
      });

      const event = await eventService.createEvent({
        title: 'Valid Event Title',
        description: 'Valid description of sufficient length for an event test.',
        category: 'Webinar',
        event_type: 'virtual',
        location_or_url: 'https://meet.vetopia.com',
        start_time: '2026-10-26T14:00:00Z',
        end_time: '2026-10-26T15:30:00Z',
        organizer_name: 'Dr. Vet',
      });

      expect(event.id).toBe('new-evt-1');
      expect(event.organizer_id).toBe(mockVet.id);
      expect(event.is_vet_verified).toBe(true);
    });
  });

  describe('4. Lifecycle: Cancellation & Deletion', () => {
    test('organizer can cancel event', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockVet } },
      });

      jest.spyOn(eventService, 'getEventByIdOrSlug').mockResolvedValue({
        id: 'evt-cancel-1',
        slug: 'evt-cancel-1',
        title: 'Event to Cancel',
        description: 'Description of event.',
        cover_image: null,
        category: 'Webinar',
        event_type: 'virtual',
        location_or_url: 'https://meet.vetopia.com',
        start_time: '2026-10-26T14:00:00Z',
        end_time: '2026-10-26T15:30:00Z',
        organizer_id: mockVet.id,
        organizer_name: 'Dr. Vet',
        status: 'published',
        created_at: '',
        updated_at: '',
      });

      const rolesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ role: 'vet' }], error: null }),
      };

      const updateBuilder = {
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'user_roles') return rolesBuilder;
        if (table === 'events') return updateBuilder;
        return {};
      });

      await expect(eventService.cancelEvent('evt-cancel-1')).resolves.not.toThrow();
      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled' }),
      );
    });

    test('non-organizer cannot cancel event', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: mockPetParent } },
      });

      jest.spyOn(eventService, 'getEventByIdOrSlug').mockResolvedValue({
        id: 'evt-cancel-1',
        slug: 'evt-cancel-1',
        title: 'Event to Cancel',
        description: 'Description of event.',
        cover_image: null,
        category: 'Webinar',
        event_type: 'virtual',
        location_or_url: 'https://meet.vetopia.com',
        start_time: '2026-10-26T14:00:00Z',
        end_time: '2026-10-26T15:30:00Z',
        organizer_id: mockVet.id, // vet is organizer, not pet parent
        organizer_name: 'Dr. Vet',
        status: 'published',
        created_at: '',
        updated_at: '',
      });

      const rolesBuilder = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(rolesBuilder);

      await expect(eventService.cancelEvent('evt-cancel-1')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });
});
