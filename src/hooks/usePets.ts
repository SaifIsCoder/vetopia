import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { petService } from '../lib/pets/petService';
import { CreatePetDTO, UpdatePetDTO, Pet } from '../types/pet';
import { useAuthStore } from '../store/authStore';

export const PETS_QUERY_KEY = ['pets'];

/**
 * Hook to retrieve all pets owned by the current authenticated user.
 */
export function usePets() {
  const { user, isAuthenticated } = useAuthStore();
  const userId = user?.id;

  return useQuery({
    queryKey: [...PETS_QUERY_KEY, userId],
    queryFn: () => petService.getPets(userId),
    enabled: isAuthenticated && !!userId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/**
 * Hook to retrieve a single pet by ID.
 */
export function usePet(petId: string) {
  return useQuery({
    queryKey: [...PETS_QUERY_KEY, 'detail', petId],
    queryFn: () => petService.getPetById(petId),
    enabled: !!petId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to create a new pet with automatic cache invalidation.
 */
export function useCreatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreatePetDTO) => petService.createPet(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY });
    },
  });
}

/**
 * Hook to update an existing pet with cache invalidation.
 */
export function useUpdatePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ petId, dto }: { petId: string; dto: UpdatePetDTO }) =>
      petService.updatePet(petId, dto),
    onSuccess: (updatedPet: Pet) => {
      queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY });
      queryClient.setQueryData([...PETS_QUERY_KEY, 'detail', updatedPet.id], updatedPet);
    },
  });
}

/**
 * Hook to delete a pet with cache invalidation.
 */
export function useDeletePet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (petId: string) => petService.deletePet(petId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PETS_QUERY_KEY });
    },
  });
}
