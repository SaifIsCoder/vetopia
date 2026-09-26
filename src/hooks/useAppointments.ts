import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentService } from '../lib/appointments/appointmentService';
import { Appointment, BookAppointmentDTO, BookingConfirmation } from '../types/appointment';
import { useAuthStore } from '../store/authStore';
import { VETS_QUERY_KEY } from './useVets';

export const APPOINTMENTS_QUERY_KEY = ['appointments'];

/**
 * Hook to retrieve user appointments (upcoming or past).
 */
export function useAppointments(filter?: 'upcoming' | 'past') {
  const { user, isAuthenticated } = useAuthStore();
  const userId = user?.id;

  return useQuery<Appointment[], Error>({
    queryKey: [...APPOINTMENTS_QUERY_KEY, 'list', userId, filter],
    queryFn: () => appointmentService.getMyAppointments(filter),
    enabled: isAuthenticated && !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to retrieve a single appointment detail.
 */
export function useAppointment(appointmentId: string) {
  const { isAuthenticated } = useAuthStore();

  return useQuery<Appointment, Error>({
    queryKey: [...APPOINTMENTS_QUERY_KEY, 'detail', appointmentId],
    queryFn: () => appointmentService.getAppointmentById(appointmentId),
    enabled: isAuthenticated && !!appointmentId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Mutation hook to atomically book an appointment with cache invalidation.
 */
export function useBookAppointment() {
  const queryClient = useQueryClient();

  return useMutation<BookingConfirmation, Error, BookAppointmentDTO>({
    mutationFn: (dto: BookAppointmentDTO) => appointmentService.bookAppointment(dto),
    onSuccess: (confirmation) => {
      // Invalidate appointment queries
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
      // Invalidate the vet's schedule so the booked slot is immediately excluded
      queryClient.invalidateQueries({
        queryKey: [...VETS_QUERY_KEY, 'schedule', confirmation.vet_id],
      });
    },
  });
}

/**
 * Mutation hook to cancel a scheduled appointment with cache invalidation.
 */
export function useCancelAppointment() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; lateCancellation: boolean }, Error, string>({
    mutationFn: (appointmentId: string) => appointmentService.cancelAppointment(appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: VETS_QUERY_KEY });
    },
  });
}

/**
 * Mutation hook to complete a consultation appointment with cache invalidation (FR-TELE-003).
 */
export function useCompleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean; appointment_id: string; status: 'completed' },
    Error,
    string
  >({
    mutationFn: (appointmentId: string) => appointmentService.completeAppointment(appointmentId),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: APPOINTMENTS_QUERY_KEY });
      queryClient.invalidateQueries({
        queryKey: [...APPOINTMENTS_QUERY_KEY, 'detail', res.appointment_id],
      });
    },
  });
}
