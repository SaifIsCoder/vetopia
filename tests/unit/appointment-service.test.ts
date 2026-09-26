import { appointmentService } from '../../src/lib/appointments/appointmentService';
import { supabase } from '../../src/lib/supabase/client';
import {
  ValidationError,
  ConflictError,
  ForbiddenError,
  AuthError,
  NotFoundError,
  ApiError,
} from '../../src/lib/api/errors';
import { BookAppointmentDTO } from '../../src/types/appointment';

// Mock Supabase
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('AppointmentService (MVP-04)', () => {
  const validDTO: BookAppointmentDTO = {
    vet_id: 'vet-uuid-1',
    pet_id: 'pet-uuid-1',
    starts_at: '2026-10-01T10:00:00Z',
    mode: 'video',
    symptoms: 'Persistent dry cough and lethargy for two days.',
    urgency: 'Medium',
    contact_phone: '+1 555-0199',
    medications: 'None',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Client-Side Input Validation', () => {
    test('Throws ValidationError if doctor ID (vet_id) is missing', async () => {
      await expect(appointmentService.bookAppointment({ ...validDTO, vet_id: '' })).rejects.toThrow(
        ValidationError,
      );
      await expect(appointmentService.bookAppointment({ ...validDTO, vet_id: '' })).rejects.toThrow(
        'Doctor ID is required.',
      );
    });

    test('Throws ValidationError if pet ID (pet_id) is missing', async () => {
      await expect(appointmentService.bookAppointment({ ...validDTO, pet_id: '' })).rejects.toThrow(
        ValidationError,
      );
      await expect(appointmentService.bookAppointment({ ...validDTO, pet_id: '' })).rejects.toThrow(
        'Please select a pet for the consultation.',
      );
    });

    test('Throws ValidationError if slot start time (starts_at) is missing', async () => {
      await expect(
        appointmentService.bookAppointment({ ...validDTO, starts_at: '' }),
      ).rejects.toThrow(ValidationError);
      await expect(
        appointmentService.bookAppointment({ ...validDTO, starts_at: '' }),
      ).rejects.toThrow('Please select an available consultation slot.');
    });

    test('Throws ValidationError if slot start time is an invalid date string', async () => {
      await expect(
        appointmentService.bookAppointment({ ...validDTO, starts_at: 'invalid-date' }),
      ).rejects.toThrow(ValidationError);
      await expect(
        appointmentService.bookAppointment({ ...validDTO, starts_at: 'invalid-date' }),
      ).rejects.toThrow('Invalid slot start timestamp.');
    });

    test('Throws ValidationError if consultation mode is invalid', async () => {
      await expect(
        appointmentService.bookAppointment({ ...validDTO, mode: 'telepathy' as any }),
      ).rejects.toThrow(ValidationError);
      await expect(
        appointmentService.bookAppointment({ ...validDTO, mode: 'telepathy' as any }),
      ).rejects.toThrow('Valid consultation format (Video, Audio, or Chat) is required.');
    });

    test('Throws ValidationError if symptoms are empty or whitespace only', async () => {
      await expect(
        appointmentService.bookAppointment({ ...validDTO, symptoms: '   ' }),
      ).rejects.toThrow(ValidationError);
      await expect(
        appointmentService.bookAppointment({ ...validDTO, symptoms: '   ' }),
      ).rejects.toThrow("Please describe your pet's symptoms.");
    });
  });

  describe('2. Atomic Server-Side RPC Invocation & Success Flow', () => {
    test('Invokes book_appointment RPC with trimmed payload and returns BookingConfirmation', async () => {
      const mockConfirmation = {
        success: true,
        appointment_id: 'apt-uuid-12345',
        status: 'scheduled',
        starts_at: '2026-10-01T10:00:00Z',
        ends_at: '2026-10-01T10:30:00Z',
        duration_minutes: 30,
        vet_id: 'vet-uuid-1',
        vet_name: 'Dr. Sarah Mitchell',
        pet_id: 'pet-uuid-1',
        pet_name: 'Luna',
        species: 'Dog',
        mode: 'video',
        price_usd: 29,
        urgency: 'Medium',
        contact_phone: '+1 555-0199',
      };

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockConfirmation,
        error: null,
      });

      const result = await appointmentService.bookAppointment(validDTO);

      expect(supabase.rpc).toHaveBeenCalledWith('book_appointment', {
        p_vet_id: 'vet-uuid-1',
        p_pet_id: 'pet-uuid-1',
        p_starts_at: '2026-10-01T10:00:00Z',
        p_mode: 'video',
        p_symptoms: 'Persistent dry cough and lethargy for two days.',
        p_urgency: 'Medium',
        p_contact_phone: '+1 555-0199',
        p_medications: 'None',
      });

      expect(result).toEqual(mockConfirmation);
      expect(result.status).toBe('scheduled');
    });
  });

  describe('3. Error & Conflict Mapping', () => {
    test('Maps code 23505 unique constraint violation to ConflictError (HTTP 409)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '23505',
          message: 'Slot just taken. Please select another time.',
        },
      });

      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(ConflictError);
      await expect(appointmentService.bookAppointment(validDTO)).rejects.toMatchObject({
        status: 409,
        message: 'Slot just taken. Please select another time.',
      });
    });

    test('Maps pet ownership violation (code 42501) to ForbiddenError', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'Forbidden: You can only book appointments for your own pets.',
        },
      });

      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(ForbiddenError);
    });

    test('Maps unauthenticated error (code 28000) to AuthError', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '28000',
          message: 'Authentication required to book an appointment.',
        },
      });

      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(AuthError);
    });

    test('Maps non-accepting vet error (code 55000) to ValidationError', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '55000',
          message: 'This veterinarian is not accepting appointments.',
        },
      });

      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(ValidationError);
      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(
        'This veterinarian is currently not accepting new bookings.',
      );
    });

    test('Maps past slot error (code 22008) to ValidationError', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '22008',
          message: 'Cannot book a slot in the past or within 15 minutes of start.',
        },
      });

      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(ValidationError);
      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(
        'The selected slot is no longer available. Please select a future time slot.',
      );
    });

    test('Maps unexpected server errors to ApiError with status 500', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: {
          code: 'P0001',
          message: 'Internal database constraint failure.',
        },
      });

      await expect(appointmentService.bookAppointment(validDTO)).rejects.toThrow(ApiError);
    });
  });

  describe('4. getMyAppointments Query Operations', () => {
    test('Fetches upcoming appointments ordered chronologically ascending', async () => {
      const mockAppointments = [
        {
          id: 'apt-1',
          vet_id: 'vet-1',
          starts_at: '2026-10-01T10:00:00Z',
          status: 'scheduled',
          vet: { name: 'Dr. Sarah Mitchell' },
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockAppointments, error: null });
      const mockGte = jest.fn().mockReturnValue({ order: mockOrder });
      const mockEq = jest.fn().mockReturnValue({ gte: mockGte });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const res = await appointmentService.getMyAppointments('upcoming');

      expect(supabase.from).toHaveBeenCalledWith('appointments');
      expect(mockEq).toHaveBeenCalledWith('status', 'scheduled');
      expect(res).toEqual(mockAppointments);
    });

    test('Fetches past / completed / cancelled appointments', async () => {
      const mockAppointments = [
        {
          id: 'apt-2',
          vet_id: 'vet-1',
          starts_at: '2026-09-01T10:00:00Z',
          status: 'completed',
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({ data: mockAppointments, error: null });
      const mockOr = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ or: mockOr });

      (supabase.from as jest.Mock).mockReturnValue({
        select: mockSelect,
      });

      const res = await appointmentService.getMyAppointments('past');

      expect(supabase.from).toHaveBeenCalledWith('appointments');
      expect(mockOr).toHaveBeenCalledWith(
        expect.stringContaining('status.in.(completed,cancelled)'),
      );
      expect(res).toEqual(mockAppointments);
    });
  });

  describe('5. getAppointmentById Operation', () => {
    test('Throws ValidationError if appointmentId is empty', async () => {
      await expect(appointmentService.getAppointmentById('')).rejects.toThrow(ValidationError);
    });

    test('Returns single appointment when found', async () => {
      const mockApt = { id: 'apt-123', status: 'scheduled' };
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: mockApt, error: null });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const res = await appointmentService.getAppointmentById('apt-123');
      expect(res).toEqual(mockApt);
    });

    test('Throws NotFoundError when appointment does not exist', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      await expect(appointmentService.getAppointmentById('non-existent')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('6. cancelAppointment Operation (FR-BOOK-002)', () => {
    test('Throws ValidationError if appointment ID is empty', async () => {
      await expect(appointmentService.cancelAppointment('')).rejects.toThrow(ValidationError);
    });

    test('Successfully cancels scheduled appointment and returns lateCancellation flag', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: { success: true, late_cancellation: false },
        error: null,
      });

      const result = await appointmentService.cancelAppointment('apt-123');

      expect(supabase.rpc).toHaveBeenCalledWith('cancel_appointment', {
        p_appointment_id: 'apt-123',
      });
      expect(result).toEqual({ success: true, lateCancellation: false });
    });

    test('Throws ForbiddenError if user is not authorized to cancel appointment', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '42501', message: 'Forbidden: caller is not a participant' },
      });

      await expect(appointmentService.cancelAppointment('apt-other')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });
});
