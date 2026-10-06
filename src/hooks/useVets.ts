import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vetService } from '../lib/vets/vetService';
import { VetFilterParams, VetProfile, DaySchedule } from '../types/vet';
import { useAuthStore } from '../store/authStore';

export const VETS_QUERY_KEY = ['vets'];

/**
 * Hook to search and filter doctors in the directory (FR-VET-001).
 * Server state managed via TanStack Query.
 */
export function useVets(filters?: VetFilterParams) {
  return useQuery<VetProfile[], Error>({
    queryKey: [...VETS_QUERY_KEY, 'list', filters],
    queryFn: () => vetService.getVets(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });
}

/**
 * Hook to retrieve a single doctor profile (FR-VET-002).
 */
export function useVet(vetId: string) {
  return useQuery<VetProfile, Error>({
    queryKey: [...VETS_QUERY_KEY, 'detail', vetId],
    queryFn: () => vetService.getVetById(vetId),
    enabled: !!vetId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Hook to retrieve dynamically generated bookable slots for the next 14 days (FR-VET-002).
 */
export function useVetSchedule(vetId: string, daysAhead = 14) {
  return useQuery<DaySchedule[], Error>({
    queryKey: [...VETS_QUERY_KEY, 'schedule', vetId, daysAhead],
    queryFn: () => vetService.getVetSchedule(vetId, daysAhead),
    enabled: !!vetId,
    staleTime: 1000 * 60 * 2, // 2 minutes cache for live slots
  });
}

/**
 * Hook to retrieve the current authenticated veterinarian's own profile.
 */
export function useMyVetProfile() {
  const { isAuthenticated, role, user } = useAuthStore();
  const isVet = role === 'vet' || user?.isVet === true;

  return useQuery<VetProfile | null, Error>({
    queryKey: [...VETS_QUERY_KEY, 'my-profile', user?.id],
    queryFn: () => vetService.getMyVetProfile(),
    enabled: isAuthenticated && isVet,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to mutate practice settings (e.g. accepting status, fees) for the current doctor.
 */
export function useUpdateMyVetProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  return useMutation<VetProfile, Error, Partial<VetProfile>>({
    mutationFn: (updates: Partial<VetProfile>) => vetService.updateMyVetProfile(updates),
    onSuccess: (updated) => {
      queryClient.setQueryData([...VETS_QUERY_KEY, 'my-profile', user?.id], updated);
      queryClient.invalidateQueries({ queryKey: VETS_QUERY_KEY });
    },
  });
}
