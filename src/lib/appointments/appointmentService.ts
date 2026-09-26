import { supabase } from '../supabase/client';
import { Appointment, BookAppointmentDTO, BookingConfirmation } from '../../types/appointment';
import {
  ApiError,
  AuthError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../api/errors';

export class AppointmentService {
  /**
   * Atomically reserve a consultation slot and create an appointment (FR-BOOK-001).
   * Calls the PostgreSQL `book_appointment` RPC which runs with transaction-level concurrency
   * protection, pet ownership verification, slot validation, and conflict detection.
   */
  public async bookAppointment(dto: BookAppointmentDTO): Promise<BookingConfirmation> {
    // 1. Client-side input validation
    if (!dto.vet_id) {
      throw new ValidationError('Doctor ID is required.');
    }
    if (!dto.pet_id) {
      throw new ValidationError('Please select a pet for the consultation.');
    }
    if (!dto.starts_at) {
      throw new ValidationError('Please select an available consultation slot.');
    }
    if (!dto.mode || !['video', 'audio', 'chat'].includes(dto.mode)) {
      throw new ValidationError('Valid consultation format (Video, Audio, or Chat) is required.');
    }
    if (!dto.symptoms || !dto.symptoms.trim()) {
      throw new ValidationError("Please describe your pet's symptoms.");
    }

    const slotDate = new Date(dto.starts_at);
    if (isNaN(slotDate.getTime())) {
      throw new ValidationError('Invalid slot start timestamp.');
    }

    // 2. Invoke server-side atomic reservation RPC
    try {
      const { data, error } = await supabase.rpc('book_appointment', {
        p_vet_id: dto.vet_id,
        p_pet_id: dto.pet_id,
        p_starts_at: dto.starts_at,
        p_mode: dto.mode,
        p_symptoms: dto.symptoms.trim(),
        p_urgency: dto.urgency || 'Medium',
        p_contact_phone: dto.contact_phone?.trim() || null,
        p_medications: dto.medications?.trim() || null,
      });

      if (error) {
        // Concurrency race condition: slot was already booked
        if (
          error.code === '23505' ||
          error.message?.includes('Slot just taken') ||
          error.message?.includes('unique')
        ) {
          throw new ConflictError('Slot just taken. Please select another time.');
        }

        // Pet ownership violation
        if (error.code === '42501' || error.message?.includes('own pets')) {
          throw new ForbiddenError(
            'Pet not found or unauthorized. You can only book appointments for your own pets.',
          );
        }

        // Unauthenticated
        if (error.code === '28000' || error.message?.includes('Authentication required')) {
          throw new AuthError('Please sign in to complete your consultation booking.');
        }

        // Non-accepting vet
        if (error.code === '55000' || error.message?.includes('not accepting')) {
          throw new ValidationError('This veterinarian is currently not accepting new bookings.');
        }

        // Past slot / buffer error
        if (error.code === '22008' || error.message?.includes('past')) {
          throw new ValidationError(
            'The selected slot is no longer available. Please select a future time slot.',
          );
        }

        throw new ApiError(error.message, 500);
      }

      if (!data) {
        throw new ApiError('Failed to receive booking confirmation from server.', 500);
      }

      return data as BookingConfirmation;
    } catch (err: any) {
      if (
        err instanceof ConflictError ||
        err instanceof ForbiddenError ||
        err instanceof AuthError ||
        err instanceof ValidationError ||
        err instanceof ApiError
      ) {
        throw err;
      }
      throw new ApiError(err?.message || 'Failed to complete appointment reservation.', 500);
    }
  }

  /**
   * Retrieve appointments for the authenticated pet parent.
   */
  public async getMyAppointments(filter?: 'upcoming' | 'past'): Promise<Appointment[]> {
    try {
      let query = supabase.from('appointments').select(
        `
          *,
          vet:vet_profiles (
            id,
            name,
            specialty,
            flag,
            country,
            img_key,
            rating,
            verified
          )
        `,
      );

      const nowIso = new Date().toISOString();

      if (filter === 'upcoming') {
        // Upcoming scheduled appointments
        query = query
          .eq('status', 'scheduled')
          .gte('starts_at', nowIso)
          .order('starts_at', { ascending: true });
      } else if (filter === 'past') {
        // Completed, cancelled, or elapsed appointments
        query = query
          .or(`starts_at.lt.${nowIso},status.in.(completed,cancelled)`)
          .order('starts_at', { ascending: false });
      } else {
        query = query.order('starts_at', { ascending: false });
      }

      const { data, error } = await query;

      if (error) {
        throw new ApiError(error.message, 500);
      }

      return (data || []) as Appointment[];
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to load appointments.', 500);
    }
  }

  /**
   * Retrieve a single appointment by ID.
   */
  public async getAppointmentById(appointmentId: string): Promise<Appointment> {
    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required.');
    }

    try {
      const { data, error } = await supabase
        .from('appointments')
        .select(
          `
          *,
          vet:vet_profiles (
            id,
            name,
            specialty,
            flag,
            country,
            img_key,
            rating,
            verified
          )
        `,
        )
        .eq('id', appointmentId)
        .maybeSingle();

      if (error) {
        throw new ApiError(error.message, 500);
      }

      if (!data) {
        throw new NotFoundError('Appointment not found.');
      }

      return data as Appointment;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to fetch appointment details.', 500);
    }
  }

  /**
   * Cancel a scheduled appointment (FR-BOOK-002).
   * Verifies participant authorization, updates status to 'cancelled', and frees the slot.
   */
  public async cancelAppointment(
    appointmentId: string,
  ): Promise<{ success: boolean; lateCancellation: boolean }> {
    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required.');
    }

    try {
      const { data, error } = await supabase.rpc('cancel_appointment', {
        p_appointment_id: appointmentId,
      });

      if (error) {
        if (error.code === '42501') {
          throw new ForbiddenError('You are not authorized to cancel this appointment.');
        }
        throw new ApiError(error.message, 500);
      }

      return {
        success: true,
        lateCancellation: !!data?.late_cancellation,
      };
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to cancel appointment.', 500);
    }
  }

  /**
   * Complete a consultation appointment (FR-TELE-003).
   * Authorized strictly for the consulting veterinarian.
   * Calls the PostgreSQL `complete_appointment` RPC, atomically transitioning status to 'completed'.
   */
  public async completeAppointment(
    appointmentId: string,
  ): Promise<{ success: boolean; appointment_id: string; status: 'completed' }> {
    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required.');
    }

    try {
      const { data, error } = await supabase.rpc('complete_appointment', {
        p_appointment_id: appointmentId,
      });

      if (error) {
        if (error.code === '42501') {
          throw new ForbiddenError(
            'Forbidden: Only the consulting veterinarian can mark an appointment as completed.',
          );
        }
        if (error.code === 'P0002') {
          throw new NotFoundError('Appointment not found.');
        }
        if (error.code === '28000') {
          throw new AuthError('Authentication required to complete consultation.');
        }
        throw new ApiError(error.message, 500);
      }

      return data as { success: boolean; appointment_id: string; status: 'completed' };
    } catch (err: any) {
      if (
        err instanceof ForbiddenError ||
        err instanceof NotFoundError ||
        err instanceof AuthError ||
        err instanceof ValidationError ||
        err instanceof ApiError
      ) {
        throw err;
      }
      throw new ApiError(err?.message || 'Failed to complete consultation appointment.', 500);
    }
  }
}

export const appointmentService = new AppointmentService();
