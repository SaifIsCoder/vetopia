import { useQuery } from '@tanstack/react-query';
import { vetService } from '../lib/vets/vetService';
import { VetFilterParams, VetProfile, DaySchedule } from '../types/vet';

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
