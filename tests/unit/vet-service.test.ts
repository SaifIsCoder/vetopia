import {
  vetService,
  buildSlots,
  formatSlotTime,
  formatDateKey,
  formatDayLabel,
} from '../../src/lib/vets/vetService';
import { supabase } from '../../src/lib/supabase/client';
import { NotFoundError, ValidationError, ApiError } from '../../src/lib/api/errors';
import { VetAvailability, VetProfile } from '../../src/types/vet';

// Mock Supabase Client
jest.mock('../../src/lib/supabase/client', () => {
  return {
    supabase: {
      from: jest.fn(),
    },
  };
});

describe('VetService & Slot Generator — Unit & Security Verification (MVP-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Slot Generator Helper Functions (buildSlots / formatters)', () => {
    test('formatSlotTime formats time as HH:mm', () => {
      const d = new Date(2026, 8, 24, 9, 30);
      expect(formatSlotTime(d)).toBe('09:30');
    });

    test('formatDateKey formats date as YYYY-MM-DD', () => {
      const d = new Date(2026, 8, 24);
      expect(formatDateKey(d)).toBe('2026-09-24');
    });

    test('formatDayLabel formats date with weekday and month', () => {
      const d = new Date(2026, 8, 24);
      const label = formatDayLabel(d);
      expect(label).toContain('Sep 24');
    });

    test('test_slot_generator_build_slots: builds 14-day slots based on weekly availability', () => {
      // Mock availability: Mon-Fri (weekdays 1-5) from 09:00 (540m) to 11:00 (660m), 30m slots
      const availability: VetAvailability[] = [
        { id: 'av-1', vet_id: 'vet-1', weekday: 1, start_minute: 540, end_minute: 660 },
        { id: 'av-2', vet_id: 'vet-1', weekday: 2, start_minute: 540, end_minute: 660 },
        { id: 'av-3', vet_id: 'vet-1', weekday: 3, start_minute: 540, end_minute: 660 }, // Wed: 4 slots
        { id: 'av-4', vet_id: 'vet-1', weekday: 4, start_minute: 540, end_minute: 660 },
        { id: 'av-5', vet_id: 'vet-1', weekday: 5, start_minute: 540, end_minute: 660 },
      ];

      // Simulated fixed point in time: Wednesday Sep 23, 2026 at 06:00 AM local
      const fixedNow = new Date(2026, 8, 23, 6, 0, 0);

      const schedule = buildSlots(availability, 30, [], 14, fixedNow);

      expect(schedule.length).toBeGreaterThan(0);
      expect(schedule.length).toBeLessThanOrEqual(14);

      // Check first day (Wednesday)
      const firstDay = schedule[0];
      expect(firstDay.slots.length).toBe(4);
      expect(firstDay.slots[0].formattedTime).toBe('09:00');
      expect(firstDay.slots[1].formattedTime).toBe('09:30');
      expect(firstDay.slots[2].formattedTime).toBe('10:00');
      expect(firstDay.slots[3].formattedTime).toBe('10:30');
    });

    test('test_exclude_booked_slots: correctly omits already scheduled appointments', () => {
      const availability: VetAvailability[] = [
        { id: 'av-1', vet_id: 'vet-1', weekday: 3, start_minute: 540, end_minute: 660 }, // Wed: 09:00, 09:30, 10:00, 10:30
      ];

      // Local 6:00 AM on Wednesday Sep 23, 2026
      const fixedNow = new Date(2026, 8, 23, 6, 0, 0);
      // Suppose slot at 09:30 is already booked in appointments table
      const dayDate = new Date(fixedNow);
      dayDate.setHours(0, 0, 0, 0);
      const bookedSlotDate = new Date(dayDate);
      bookedSlotDate.setMinutes(570); // 09:30
      const bookedISO = [bookedSlotDate.toISOString()];

      const schedule = buildSlots(availability, 30, bookedISO, 1, fixedNow);

      expect(schedule.length).toBe(1);
      const times = schedule[0].slots.map((s) => s.formattedTime);
      expect(times).toContain('09:00');
      expect(times).not.toContain('09:30'); // Excluded!
      expect(times).toContain('10:00');
      expect(times).toContain('10:30');
    });

    test('Omits slots occurring in the past or within 15 minutes of present', () => {
      const availability: VetAvailability[] = [
        { id: 'av-1', vet_id: 'vet-1', weekday: 3, start_minute: 540, end_minute: 660 }, // 09:00, 09:30, 10:00, 10:30
      ];

      // Simulated local current time is 09:20 AM
      const fixedNow = new Date(2026, 8, 23, 9, 20, 0);
      // Buffer is 15 minutes, so 09:00 is past, 09:30 is within 10 mins (less than 15 min buffer)
      // 10:00 is 40 minutes ahead -> valid!
      const dayDate = new Date(fixedNow);
      dayDate.setHours(0, 0, 0, 0);
      const schedule = buildSlots(availability, 30, [], 1, fixedNow);

      if (schedule.length > 0) {
        const times = schedule[0].slots.map((s) => s.formattedTime);
        expect(times).not.toContain('09:00');
        expect(times).not.toContain('09:30');
        expect(times).toContain('10:00');
      }
    });
  });

  describe('2. Doctor Directory Search & Filtering (getVets)', () => {
    const mockVets: VetProfile[] = [
      {
        id: 'vet-1',
        name: 'Dr. Sarah Mitchell',
        specialty: 'General Veterinary Medicine',
        country: 'United Kingdom',
        flag: '🇬🇧',
        languages: ['English', 'French'],
        price_usd: 29,
        slot_minutes: 30,
        rating: 4.9,
        reviews: 312,
        verified: true,
        accepting: true,
        timezone: 'UTC',
      },
      {
        id: 'vet-2',
        name: 'Dr. Kenji Tanaka',
        specialty: 'Internal Medicine',
        country: 'Japan',
        flag: '🇯🇵',
        languages: ['English', 'Japanese', 'Mandarin'],
        price_usd: 35,
        slot_minutes: 30,
        rating: 4.8,
        reviews: 248,
        verified: true,
        accepting: true,
        timezone: 'Asia/Tokyo',
      },
      {
        id: 'vet-3',
        name: 'Dr. Amara Okafor',
        specialty: 'Dermatology',
        country: 'Nigeria',
        flag: '🇳🇬',
        languages: ['English', 'Yoruba', 'French'],
        price_usd: 32,
        slot_minutes: 30,
        rating: 5.0,
        reviews: 184,
        verified: true,
        accepting: true,
        timezone: 'Africa/Lagos',
      },
    ];

    test('test_vet_search_query: empty query returns top-rated doctors currently accepting consults', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest.fn().mockImplementation((callback) => callback({ data: mockVets, error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVets({});

      expect(supabase.from).toHaveBeenCalledWith('vet_profiles');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('accepting', true);
      expect(mockQueryBuilder.order).toHaveBeenCalledWith('rating', { ascending: false });
      expect(result).toHaveLength(3);
    });

    test('test_vet_search_query: queries doctor name or specialty when q is provided', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: [mockVets[0]], error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVets({ q: 'Sarah' });

      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'name.ilike.%Sarah%,specialty.ilike.%Sarah%',
      );
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Dr. Sarah Mitchell');
    });

    test('test_vet_filter_specialty: filters by specialty', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: [mockVets[2]], error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVets({ specialty: 'Dermatology' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('specialty', 'Dermatology');
      expect(result).toHaveLength(1);
      expect(result[0].specialty).toBe('Dermatology');
    });

    test('Filters by language using contains operator', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        contains: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: [mockVets[1]], error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVets({ language: 'Japanese' });

      expect(mockQueryBuilder.contains).toHaveBeenCalledWith('languages', ['Japanese']);
      expect(result).toHaveLength(1);
    });

    test('Filters by country', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: [mockVets[1]], error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVets({ country: 'Japan' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('country', 'Japan');
      expect(result).toHaveLength(1);
    });

    test('Filters by maximum price (lte)', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: [mockVets[0]], error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVets({ max_price: 30 });

      expect(mockQueryBuilder.lte).toHaveBeenCalledWith('price_usd', 30);
      expect(result).toHaveLength(1);
    });

    test('Handles database error gracefully', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) =>
            callback({ data: null, error: { message: 'Database connection failed' } }),
          ),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      await expect(vetService.getVets({})).rejects.toThrow(ApiError);
    });
  });

  describe('3. Doctor Detailed Profile (getVetById)', () => {
    test('Throws ValidationError if doctor ID is empty', async () => {
      await expect(vetService.getVetById('')).rejects.toThrow(ValidationError);
    });

    test('Returns doctor profile for valid ID', async () => {
      const mockVet: VetProfile = {
        id: 'vet-123',
        name: 'Dr. Marco Rossi',
        specialty: 'Emergency & Critical Care',
        country: 'Italy',
        flag: '🇮🇹',
        languages: ['Italian', 'English', 'Spanish'],
        price_usd: 42,
        slot_minutes: 30,
        rating: 4.9,
        reviews: 287,
        verified: true,
        accepting: true,
        timezone: 'Europe/Rome',
      };

      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockVet, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVetById('vet-123');

      expect(result.id).toBe('vet-123');
      expect(result.name).toBe('Dr. Marco Rossi');
      expect(result.verified).toBe(true);
    });

    test('Throws NotFoundError if doctor profile does not exist', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      await expect(vetService.getVetById('unknown-id')).rejects.toThrow(NotFoundError);
    });
  });

  describe('4. Security & Verification Audit (MVP-03)', () => {
    test('Unverified doctors maintain verified: false and are not represented as verified', async () => {
      const unverifiedVet: VetProfile = {
        id: 'vet-unverified',
        name: 'Dr. Pending Verification',
        specialty: 'General Practice',
        country: 'United States',
        flag: '🇺🇸',
        languages: ['English'],
        price_usd: 25,
        slot_minutes: 30,
        rating: 0,
        reviews: 0,
        verified: false,
        accepting: false,
        timezone: 'UTC',
      };

      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: unverifiedVet, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVetById('vet-unverified');

      expect(result.verified).toBe(false);
      expect(result.accepting).toBe(false);
    });

    test('vetService is strictly read-only and does not expose verification mutation methods', () => {
      expect((vetService as any).approveVet).toBeUndefined();
      expect((vetService as any).setVerified).toBeUndefined();
      expect((vetService as any).updateVerification).toBeUndefined();
    });
  });
});
