import { appointmentService } from '../../src/lib/appointments/appointmentService';
import { telemedicineService } from '../../src/lib/telemedicine/telemedicineService';
import { supabase } from '../../src/lib/supabase/client';
import {
  ValidationError,
  ForbiddenError,
  NotFoundError,
  AuthError,
  ApiError,
} from '../../src/lib/api/errors';

// Mock Supabase client
jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
    from: jest.fn(),
  },
}));

describe('Telemedicine Completion Security & RPC Tests (FR-TELE-003)', () => {
  const validAppointmentId = '11111111-2222-3333-4444-555555555555';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Input Validation for Consultation Completion', () => {
    test('Throws ValidationError if appointmentId is missing or empty', async () => {
      await expect(appointmentService.completeAppointment('')).rejects.toThrow(ValidationError);
      await expect(appointmentService.completeAppointment('')).rejects.toThrow(
        'Appointment ID is required.',
      );
    });

    test('TelemedicineService also rejects empty appointment ID', async () => {
      await expect(telemedicineService.completeConsultation('')).rejects.toThrow(ValidationError);
    });
  });

  describe('2. Unauthenticated Access Protection', () => {
    test('Throws AuthError when unauthenticated caller (Postgres code 28000) calls complete_appointment', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '28000',
          message: 'Authentication required: auth.uid() is null',
        },
      });

      await expect(appointmentService.completeAppointment(validAppointmentId)).rejects.toThrow(
        AuthError,
      );
      await expect(appointmentService.completeAppointment(validAppointmentId)).rejects.toThrow(
        'Authentication required to complete consultation.',
      );
      expect(supabase.rpc).toHaveBeenCalledWith('complete_appointment', {
        p_appointment_id: validAppointmentId,
      });
    });
  });

  describe('3. Role & Ownership Authorization (Veterinarian Only)', () => {
    test('Throws ForbiddenError when Pet Parent attempts to complete consultation (Postgres code 42501)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message:
            'Forbidden: Only the consulting veterinarian can mark an appointment as completed',
        },
      });

      await expect(appointmentService.completeAppointment(validAppointmentId)).rejects.toThrow(
        ForbiddenError,
      );
      await expect(appointmentService.completeAppointment(validAppointmentId)).rejects.toThrow(
        'Forbidden: Only the consulting veterinarian can mark an appointment as completed.',
      );
    });

    test('Throws ForbiddenError when an unrelated user/attacker attempts to complete the appointment', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'Forbidden: Caller is not the assigned veterinarian for this appointment',
        },
      });

      await expect(appointmentService.completeAppointment(validAppointmentId)).rejects.toThrow(
        ForbiddenError,
      );
    });
  });

  describe('4. Appointment Existence and State Verification', () => {
    test('Throws NotFoundError when appointment does not exist (Postgres code P0002)', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: 'P0002',
          message: 'Appointment not found',
        },
      });

      await expect(
        appointmentService.completeAppointment('non-existent-appointment-uuid'),
      ).rejects.toThrow(NotFoundError);
      await expect(
        appointmentService.completeAppointment('non-existent-appointment-uuid'),
      ).rejects.toThrow('Appointment not found.');
    });

    test('Throws ApiError when appointment cannot be completed because it is already cancelled or finished', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          code: 'P0001',
          message: 'Cannot complete appointment: Current status is already cancelled',
        },
      });

      await expect(appointmentService.completeAppointment(validAppointmentId)).rejects.toThrow(
        ApiError,
      );
    });
  });

  describe('5. Successful Consultation Completion', () => {
    test('Successfully marks appointment as completed when invoked by authorized veterinarian', async () => {
      const mockResult = {
        success: true,
        appointment_id: validAppointmentId,
        status: 'completed',
      };

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockResult,
        error: null,
      });

      const result = await appointmentService.completeAppointment(validAppointmentId);
      expect(result).toEqual(mockResult);
      expect(supabase.rpc).toHaveBeenCalledWith('complete_appointment', {
        p_appointment_id: validAppointmentId,
      });
    });

    test('TelemedicineService.completeConsultation delegates properly to appointmentService', async () => {
      const mockResult = {
        success: true,
        appointment_id: validAppointmentId,
        status: 'completed',
      };

      (supabase.rpc as jest.Mock).mockResolvedValueOnce({
        data: mockResult,
        error: null,
      });

      const result = await telemedicineService.completeConsultation(validAppointmentId);
      expect(result).toBe(true);
    });
  });
});
