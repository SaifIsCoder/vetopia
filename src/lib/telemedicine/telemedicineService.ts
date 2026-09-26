import { apiClient } from '../api/client';
import { Appointment } from '../../types/appointment';
import { appointmentService } from '../appointments/appointmentService';
import { ApiError, ValidationError } from '../api/errors';

export interface TelemedicineTokenResponseData {
  server_url: string;
  token: string;
  room_name: string;
  participant_identity: string;
  participant_name: string;
  role: 'pet_parent' | 'vet';
  mode: 'video' | 'audio' | 'chat';
}

export interface ConsultationEligibility {
  eligible: boolean;
  reason?: 'too_early' | 'expired' | 'cancelled' | 'completed' | 'not_scheduled';
  message: string;
}

/**
 * Validates consultation timing according to the project's T-15m rule (FR-TELE-001).
 * Window is valid from 15 minutes before starts_at until 30 minutes after ends_at.
 */
export function isConsultationWindowActive(
  startsAtIso: string,
  endsAtIso: string,
  currentTimestamp: number = Date.now(),
): { active: boolean; reason?: 'too_early' | 'expired' } {
  const startsAt = new Date(startsAtIso).getTime();
  const endsAt = new Date(endsAtIso).getTime();

  if (isNaN(startsAt) || isNaN(endsAt)) {
    return { active: false, reason: 'expired' };
  }

  const fifteenMinutesMs = 15 * 60 * 1000;
  const thirtyMinutesMs = 30 * 60 * 1000;

  if (currentTimestamp < startsAt - fifteenMinutesMs) {
    return { active: false, reason: 'too_early' };
  }

  if (currentTimestamp > endsAt + thirtyMinutesMs) {
    return { active: false, reason: 'expired' };
  }

  return { active: true };
}

export class TelemedicineService {
  /**
   * Request a signed LiveKit consultation token from the backend (API-TELE-001).
   * Validates appointment status, participant authorization, and timing window.
   */
  public async requestConsultationToken(
    appointmentId: string,
  ): Promise<TelemedicineTokenResponseData> {
    if (!appointmentId) {
      throw new ValidationError('Appointment ID is required.');
    }

    try {
      const response = await apiClient.post<TelemedicineTokenResponseData>('/telemedicine/token', {
        appointment_id: appointmentId,
      });

      if (!response.data) {
        throw new ApiError('Failed to receive LiveKit token data from server.', 500);
      }

      return response.data;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to request consultation token.', 500);
    }
  }

  /**
   * Evaluates whether an appointment is eligible for entry into the consultation room.
   * Follows the project rule: T-15 minutes before scheduled start time up to 30 min after end.
   */
  public checkEligibility(
    appointment: Appointment,
    currentTimestamp: number = Date.now(),
  ): ConsultationEligibility {
    if (appointment.status === 'cancelled') {
      return {
        eligible: false,
        reason: 'cancelled',
        message: 'This appointment has been cancelled.',
      };
    }

    if (appointment.status === 'completed') {
      return {
        eligible: false,
        reason: 'completed',
        message: 'This consultation has already been completed.',
      };
    }

    if (appointment.status !== 'scheduled') {
      return {
        eligible: false,
        reason: 'not_scheduled',
        message: `Appointment is not active (status: ${appointment.status}).`,
      };
    }

    const timing = isConsultationWindowActive(
      appointment.starts_at,
      appointment.ends_at,
      currentTimestamp,
    );

    if (!timing.active) {
      if (timing.reason === 'too_early') {
        const startsAt = new Date(appointment.starts_at);
        const timeStr = !isNaN(startsAt.getTime())
          ? startsAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : 'scheduled time';
        return {
          eligible: false,
          reason: 'too_early',
          message: `Consultation room opens 15 minutes before ${timeStr}.`,
        };
      }
      return {
        eligible: false,
        reason: 'expired',
        message: 'The scheduled time window for this consultation has elapsed.',
      };
    }

    return {
      eligible: true,
      message: 'Consultation room is ready.',
    };
  }

  /**
   * Complete the consultation via secure PostgreSQL RPC (FR-TELE-003).
   * Only the consulting veterinarian can execute this operation.
   */
  public async completeConsultation(appointmentId: string): Promise<boolean> {
    const result = await appointmentService.completeAppointment(appointmentId);
    return result.success;
  }
}

export const telemedicineService = new TelemedicineService();
