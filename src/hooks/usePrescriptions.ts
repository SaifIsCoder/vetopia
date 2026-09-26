import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prescriptionService } from '../lib/prescriptions/prescriptionService';
import { CreatePrescriptionDTO, Prescription } from '../types/prescription';

export function usePrescription(id: string) {
  return useQuery<Prescription, Error>({
    queryKey: ['prescription', id],
    queryFn: () => prescriptionService.getPrescriptionById(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useAppointmentPrescription(appointmentId: string) {
  return useQuery<Prescription | null, Error>({
    queryKey: ['prescription', 'appointment', appointmentId],
    queryFn: () => prescriptionService.getPrescriptionByAppointmentId(appointmentId),
    enabled: !!appointmentId,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePetPrescriptions(petId: string) {
  return useQuery<Prescription[], Error>({
    queryKey: ['prescriptions', 'pet', petId],
    queryFn: () => prescriptionService.getPrescriptionsByPetId(petId),
    enabled: !!petId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePrescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreatePrescriptionDTO) => prescriptionService.createPrescription(dto),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({
        queryKey: ['prescription', 'appointment', variables.appointment_id],
      });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      queryClient.invalidateQueries({ queryKey: ['appointment', variables.appointment_id] });
    },
  });
}
