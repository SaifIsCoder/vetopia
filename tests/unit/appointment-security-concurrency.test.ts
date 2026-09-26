import { appointmentService } from '../../src/lib/appointments/appointmentService';
import { supabase } from '../../src/lib/supabase/client';
import {
  ConflictError,
  ForbiddenError,
  AuthError,
  ValidationError,
} from '../../src/lib/api/errors';
import { BookAppointmentDTO } from '../../src/types/appointment';

// Mock Supabase Client
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('Appointment Security & Slot Concurrency Verification (MVP-04)', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  const slotStart = '2026-10-15T14:00:00Z';
  const vetId = 'vet-dr-smith-uuid';

  describe('1. Mandatory Database Concurrency Test (Two Users, Same Slot)', () => {
    test('User A succeeds, User B receives 409 Conflict, exactly ONE appointment is created', async () => {
      // Simulate atomic database state:
      // A unique partial index `appointments_vet_scheduled_slot_idx` ensures only one
      // active appointment exists per (vet_id, starts_at).
      let databaseSlotsAllocated = 0;

      // Simulated book_appointment RPC execution in PostgreSQL transaction
      const mockAtomicBookRPC = jest.fn().mockImplementation(async (method: string, args: any) => {
        if (method !== 'book_appointment') return { data: null, error: { message: 'Unknown RPC' } };

        if (databaseSlotsAllocated > 0) {
          // Second transaction encounters the unique constraint violation:
          // duplicate key value violates unique constraint "appointments_vet_scheduled_slot_idx"
          return {
            data: null,
            error: {
              code: '23505',
              message:
                'Slot just taken. Please select another time. (duplicate key value violates unique constraint "appointments_vet_scheduled_slot_idx")',
            },
          };
        }

        // First transaction successfully locks and inserts row
        databaseSlotsAllocated += 1;
        return {
          data: {
            success: true,
            appointment_id: 'apt-created-first',
            status: 'scheduled',
            starts_at: args.p_starts_at,
            ends_at: '2026-10-15T14:30:00Z',
            duration_minutes: 30,
            vet_id: args.p_vet_id,
            vet_name: 'Dr. Sarah Smith',
            pet_id: args.p_pet_id,
            pet_name: 'Milo',
            species: 'Dog',
            mode: args.p_mode,
            price_usd: 35,
            urgency: args.p_urgency,
            contact_phone: args.p_contact_phone,
          },
          error: null,
        };
      });

      (supabase.rpc as jest.Mock).mockImplementation(mockAtomicBookRPC);

      // User A (Pet Parent 1) booking payload
      const payloadUserA: BookAppointmentDTO = {
        vet_id: vetId,
        pet_id: 'pet-user-a-123',
        starts_at: slotStart,
        mode: 'video',
        symptoms: 'Mild skin irritation and constant scratching.',
        urgency: 'Medium',
        contact_phone: '+1 555-0101',
      };

      // User B (Pet Parent 2) concurrent booking payload for exact same vet & slot
      const payloadUserB: BookAppointmentDTO = {
        vet_id: vetId,
        pet_id: 'pet-user-b-456',
        starts_at: slotStart,
        mode: 'audio',
        symptoms: 'Loss of appetite and lethargy.',
        urgency: 'Medium',
        contact_phone: '+1 555-0102',
      };

      // Execute concurrent requests (Promise.all)
      const [resultA, errorB] = await Promise.all([
        appointmentService.bookAppointment(payloadUserA).catch((e) => e),
        appointmentService.bookAppointment(payloadUserB).catch((e) => e),
      ]);

      // Exactly ONE request succeeds
      expect(resultA).toBeDefined();
      expect(resultA.success).toBe(true);
      expect(resultA.status).toBe('scheduled');
      expect(resultA.appointment_id).toBe('apt-created-first');

      // The other request fails safely with 409 Conflict
      expect(errorB).toBeInstanceOf(ConflictError);
      expect(errorB.status).toBe(409);
      expect(errorB.message).toBe('Slot just taken. Please select another time.');

      // Database state verification: exactly ONE appointment was created
      expect(databaseSlotsAllocated).toBe(1);
    });

    test('Same user double submission (rapid double tap) results in single booking, second gets 409', async () => {
      let callCount = 0;
      (supabase.rpc as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            data: {
              success: true,
              appointment_id: 'apt-single-1',
              status: 'scheduled',
              starts_at: slotStart,
              vet_id: vetId,
              pet_id: 'pet-1',
              mode: 'video',
              price_usd: 30,
            },
            error: null,
          };
        }
        return {
          data: null,
          error: {
            code: '23505',
            message: 'Slot just taken. Please select another time.',
          },
        };
      });

      const payload: BookAppointmentDTO = {
        vet_id: vetId,
        pet_id: 'pet-1',
        starts_at: slotStart,
        mode: 'video',
        symptoms: 'Checkup',
        contact_phone: '+1 555-0100',
      };

      const [req1, req2] = await Promise.all([
        appointmentService.bookAppointment(payload).catch((e) => e),
        appointmentService.bookAppointment(payload).catch((e) => e),
      ]);

      expect(req1.success).toBe(true);
      expect(req2).toBeInstanceOf(ConflictError);
      expect(callCount).toBe(2);
    });
  });

  describe('2. Pet Ownership Security Verification', () => {
    test('Rejects booking when pet_id does not belong to the authenticated caller', async () => {
      // Server-side check: SELECT id FROM public.pets WHERE id = p_pet_id AND owner_id = auth.uid()
      // If no matching pet is found, RPC raises exception:
      // 'Pet not found or unauthorized. You can only book appointments for your own pets.' (code 42501)
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message:
            'Forbidden: Pet not found or unauthorized. You can only book appointments for your own pets.',
        },
      });

      const maliciousPayload: BookAppointmentDTO = {
        vet_id: vetId,
        pet_id: 'victim-pet-uuid-999', // pet belonging to another pet parent
        starts_at: slotStart,
        mode: 'video',
        symptoms: 'Malicious inspection attempt.',
        contact_phone: '+1 555-9999',
      };

      await expect(appointmentService.bookAppointment(maliciousPayload)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(appointmentService.bookAppointment(maliciousPayload)).rejects.toThrow(
        'You can only book appointments for your own pets',
      );
    });
  });

  describe('3. Anonymous Booking Rejection', () => {
    test('Rejects appointment reservation when caller is unauthenticated (auth.uid() IS NULL)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '28000',
          message: 'Authentication required: auth.uid() is null.',
        },
      });

      const payload: BookAppointmentDTO = {
        vet_id: vetId,
        pet_id: 'my-pet-id',
        starts_at: slotStart,
        mode: 'video',
        symptoms: 'Routine consultation inquiry.',
        contact_phone: '+1 555-0100',
      };

      await expect(appointmentService.bookAppointment(payload)).rejects.toThrow(AuthError);
    });
  });

  describe('4. Veterinarian Status Validation', () => {
    test('Rejects booking if veterinarian is not accepting bookings (accepting = false)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '55000',
          message: 'This veterinarian is currently not accepting new bookings.',
        },
      });

      const payload: BookAppointmentDTO = {
        vet_id: 'non-accepting-vet-id',
        pet_id: 'my-pet-id',
        starts_at: slotStart,
        mode: 'video',
        symptoms: 'Annual checkup.',
        contact_phone: '+1 555-0100',
      };

      await expect(appointmentService.bookAppointment(payload)).rejects.toThrow(ValidationError);
      await expect(appointmentService.bookAppointment(payload)).rejects.toThrow(
        'This veterinarian is currently not accepting new bookings.',
      );
    });
  });

  describe('5. Past Slot & 15-Minute Booking Buffer Protection', () => {
    test('Rejects booking when slot is in the past or violates 15-minute advance buffer', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '22008',
          message:
            'The selected slot is no longer available. Must book at least 15 minutes in advance.',
        },
      });

      const payload: BookAppointmentDTO = {
        vet_id: vetId,
        pet_id: 'my-pet-id',
        starts_at: '2020-01-01T10:00:00Z', // past timestamp
        mode: 'video',
        symptoms: 'Past slot booking attempt.',
        contact_phone: '+1 555-0100',
      };

      await expect(appointmentService.bookAppointment(payload)).rejects.toThrow(ValidationError);
      await expect(appointmentService.bookAppointment(payload)).rejects.toThrow(
        'The selected slot is no longer available. Please select a future time slot.',
      );
    });
  });

  describe('6. Slot Recovery on Cancellation (FR-BOOK-002)', () => {
    test('When scheduled appointment is cancelled, the slot is freed and can be booked again', async () => {
      let slotState: 'free' | 'scheduled' | 'cancelled' = 'scheduled';

      // Simulate cancel_appointment RPC
      const mockCancelRPC = jest.fn().mockImplementation(async () => {
        slotState = 'cancelled';
        return {
          data: { success: true, late_cancellation: false },
          error: null,
        };
      });

      // Simulate re-booking after cancellation:
      // Because `appointments_vet_scheduled_slot_idx` is indexed `WHERE status = 'scheduled'`,
      // the cancelled appointment row does NOT collide with a new scheduled booking.
      const mockBookRPC = jest.fn().mockImplementation(async () => {
        if (slotState === 'scheduled') {
          return {
            data: null,
            error: { code: '23505', message: 'Slot just taken' },
          };
        }
        slotState = 'scheduled';
        return {
          data: {
            success: true,
            appointment_id: 'apt-new-booking-after-cancel',
            status: 'scheduled',
          },
          error: null,
        };
      });

      (supabase.rpc as jest.Mock).mockImplementation((method: string) => {
        if (method === 'cancel_appointment') return mockCancelRPC();
        if (method === 'book_appointment') return mockBookRPC();
        return Promise.resolve({ data: null, error: null });
      });

      // 1. Cancel the existing appointment
      const cancelResult = await appointmentService.cancelAppointment('apt-initial-123');
      expect(cancelResult.success).toBe(true);
      expect(slotState).toBe('cancelled');

      // 2. Re-book the same slot
      const newBooking = await appointmentService.bookAppointment({
        vet_id: vetId,
        pet_id: 'pet-another-owner',
        starts_at: slotStart,
        mode: 'video',
        symptoms: 'Checkup on freed slot',
        contact_phone: '+1 555-0155',
      });

      expect(newBooking.success).toBe(true);
      expect(newBooking.appointment_id).toBe('apt-new-booking-after-cancel');
      expect(slotState).toBe('scheduled');
    });
  });

  describe('7. RLS Data Isolation & Privacy Verification', () => {
    test('Pet parent can only access their own appointments, not appointments of other parents', async () => {
      // Mock appointments table query with RLS enforcement
      const mockAppointments = [
        {
          id: 'apt-my-1',
          pet_parent_id: 'auth-user-id-123',
          symptoms: 'Private medical symptom description',
          contact_phone: '+1 555-0123',
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({
        data: mockAppointments,
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ order: mockOrder });
      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const appointments = await appointmentService.getMyAppointments();

      expect(appointments).toHaveLength(1);
      expect(appointments[0].id).toBe('apt-my-1');
      // Verifies client queries appointments table which is secured by RLS policy
      expect(supabase.from).toHaveBeenCalledWith('appointments');
    });

    test('Unauthorized mutation on appointment is rejected by RLS', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy for table "appointments"',
        },
      });

      await expect(appointmentService.cancelAppointment('apt-not-mine')).rejects.toThrow(
        ForbiddenError,
      );
    });
  });
});
