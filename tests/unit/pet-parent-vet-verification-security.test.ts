import { vetService } from '../../src/lib/vets/vetService';
import { appointmentService } from '../../src/lib/appointments/appointmentService';
import { supabase } from '../../src/lib/supabase/client';
import { ValidationError } from '../../src/lib/api/errors';
import { BookAppointmentDTO } from '../../src/types/appointment';

// Mock Supabase
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
    },
  },
}));

describe('Pet Parent Portal: Veterinarian Discovery, Search & Booking Security Audits', () => {
  const mockSampleVets = [
    {
      id: 'vet-verified-1',
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
      timezone: 'Europe/London',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Vet Discovery & Search Security (Server-Side / Query Enforcement)', () => {
    test('getVets unconditionally queries verified=true and accepting=true from the database', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: mockSampleVets, error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const result = await vetService.getVets({});

      expect(supabase.from).toHaveBeenCalledWith('vet_profiles');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('verified', true);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('accepting', true);
      expect(result).toHaveLength(1);
      expect(result[0].verified).toBe(true);
      expect(result[0].accepting).toBe(true);
    });

    test('getVets with text search enforces verified=true and accepting=true alongside search term', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: mockSampleVets, error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      await vetService.getVets({ q: 'Mitchell' });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('verified', true);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('accepting', true);
      expect(mockQueryBuilder.or).toHaveBeenCalledWith(
        'name.ilike.%Mitchell%,specialty.ilike.%Mitchell%',
      );
    });

    test('getVets with category filter enforces verified=true and accepting=true', async () => {
      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        then: jest
          .fn()
          .mockImplementation((callback) => callback({ data: mockSampleVets, error: null })),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      await vetService.getVets({
        specialty: 'General Veterinary Medicine',
        country: 'United Kingdom',
      });

      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('verified', true);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('accepting', true);
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('specialty', 'General Veterinary Medicine');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('country', 'United Kingdom');
    });
  });

  describe('2. Schedule Retrieval Security for Unverified Doctors', () => {
    test('getVetSchedule returns empty array when doctor is unverified in client fallback', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'function get_vet_schedule does not exist' },
      });

      const mockVetQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'vet-unverified', slot_minutes: 30, accepting: true, verified: false },
          error: null,
        }),
      };

      const mockAvailQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'vet_profiles') return mockVetQuery;
        if (table === 'vet_availability') return mockAvailQuery;
        return { select: jest.fn().mockReturnThis() };
      });

      const schedule = await vetService.getVetSchedule('vet-unverified', 14);
      expect(schedule).toEqual([]);
    });

    test('getVetSchedule returns empty array when doctor is inactive (accepting=false)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'function get_vet_schedule does not exist' },
      });

      const mockVetQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({
          data: { id: 'vet-inactive', slot_minutes: 30, accepting: false, verified: true },
          error: null,
        }),
      };

      const mockAvailQuery: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null }),
      };

      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'vet_profiles') return mockVetQuery;
        if (table === 'vet_availability') return mockAvailQuery;
        return { select: jest.fn().mockReturnThis() };
      });

      const schedule = await vetService.getVetSchedule('vet-inactive', 14);
      expect(schedule).toEqual([]);
    });
  });

  describe('3. Booking Flow Security Enforcement (Database-Side & Service-Side)', () => {
    const validBookingDTO: BookAppointmentDTO = {
      vet_id: 'vet-unverified-id',
      pet_id: 'pet-uuid-1',
      starts_at: '2026-10-10T10:00:00Z',
      mode: 'video',
      symptoms: 'Vomiting and lethargy',
      urgency: 'Medium',
    };

    test('bookAppointment rejects booking when server raises unverified doctor exception (code 55001)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '55001',
          message: 'Veterinarian is not verified or approved for clinical practice.',
        },
      });

      await expect(appointmentService.bookAppointment(validBookingDTO)).rejects.toThrow(
        ValidationError,
      );
      await expect(appointmentService.bookAppointment(validBookingDTO)).rejects.toThrow(
        'This veterinarian is not verified or approved for clinical practice.',
      );
    });

    test('bookAppointment rejects booking when server raises inactive doctor exception (code 55000)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '55000',
          message: 'Veterinarian is currently not accepting bookings.',
        },
      });

      await expect(appointmentService.bookAppointment(validBookingDTO)).rejects.toThrow(
        ValidationError,
      );
      await expect(appointmentService.bookAppointment(validBookingDTO)).rejects.toThrow(
        'This veterinarian is currently not accepting new bookings.',
      );
    });
  });

  describe('4. Doctor Portal Isolation (Preserves Doctor Access to Own Profile)', () => {
    test('getMyVetProfile allows doctor to view their own profile even if pending verification', async () => {
      (supabase.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: { id: 'doctor-user-uuid', email: 'doctor@example.com' } },
        error: null,
      });

      const mockDoctorProfile = {
        id: 'vet-profile-uuid',
        user_id: 'doctor-user-uuid',
        name: 'Dr. Saif Applicant',
        specialty: 'Internal Medicine',
        verified: false, // Pending verification
        accepting: false,
      };

      const mockQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: mockDoctorProfile, error: null }),
      };

      (supabase.from as jest.Mock).mockReturnValue(mockQueryBuilder);

      const profile = await vetService.getMyVetProfile();

      expect(supabase.from).toHaveBeenCalledWith('vet_profiles');
      expect(mockQueryBuilder.eq).toHaveBeenCalledWith('user_id', 'doctor-user-uuid');
      // Notice: Does NOT filter by verified=true, so unverified doctor can still load dashboard and verify license
      expect(profile).not.toBeNull();
      expect(profile?.verified).toBe(false);
      expect(profile?.name).toBe('Dr. Saif Applicant');
    });
  });
});
