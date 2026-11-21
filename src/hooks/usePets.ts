import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { petService } from '../lib/pets/petService';
import { prescriptionService } from '../lib/prescriptions/prescriptionService';
import { appointmentService } from '../lib/appointments/appointmentService';
import { petPassportCache } from '../lib/pets/petPassportCache';
import { CreatePetDTO, UpdatePetDTO, Pet, CreateVaccinationDTO, PetVaccination } from '../types/pet';
import { Prescription } from '../types/prescription';
import { Appointment } from '../types/appointment';
import { useAuthStore } from '../store/authStore';

export const PETS_QUERY_KEY = ['pets'];
export const PET_VACCINATIONS_KEY = ['pet_vaccinations'];
export const PET_PASSPORT_KEY = ['pet_passport'];

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
 * Hook to retrieve vaccination records for a pet.
 */
export function usePetVaccinations(petId: string) {
  return useQuery({
    queryKey: [...PET_VACCINATIONS_KEY, petId],
    queryFn: () => petService.getVaccinationsByPetId(petId),
    enabled: !!petId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to record a new vaccination with cache invalidation.
 */
export function useCreateVaccination() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (dto: CreateVaccinationDTO) => petService.createVaccination(dto),
    onSuccess: (newVac: PetVaccination) => {
      queryClient.invalidateQueries({ queryKey: [...PET_VACCINATIONS_KEY, newVac.pet_id] });
      queryClient.invalidateQueries({ queryKey: [...PET_PASSPORT_KEY, newVac.pet_id] });
    },
  });
}

/**
 * Hook to delete a vaccination record with cache invalidation.
 */
export function useDeleteVaccination(petId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vaccinationId: string) => petService.deleteVaccination(vaccinationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...PET_VACCINATIONS_KEY, petId] });
      queryClient.invalidateQueries({ queryKey: [...PET_PASSPORT_KEY, petId] });
    },
  });
}

export interface PetPassportData {
  pet: Pet;
  vaccinations: PetVaccination[];
  prescriptions: Prescription[];
  consultations: Appointment[];
  isOffline: boolean;
  cachedAt: string | null;
}

/**
 * Hook to retrieve complete Pet Health Passport with automatic offline caching (FR-PET-002, NFR-REL-002).
 * Concurrently loads pet biometrics, vaccination history, prescription history, and consultation notes.
 * Automatically saves fresh snapshots to durable storage and serves cached data when offline.
 */
export function usePetPassport(petId: string) {
  return useQuery<PetPassportData>({
    queryKey: [...PET_PASSPORT_KEY, petId],
    queryFn: async (): Promise<PetPassportData> => {
      try {
        const [pet, vaccinations, prescriptions, consultations] = await Promise.all([
          petService.getPetById(petId),
          petService.getVaccinationsByPetId(petId),
          prescriptionService.getPrescriptionsByPetId(petId),
          appointmentService.getAppointmentsByPetId(petId),
        ]);

        // Save fresh snapshot to durable local cache
        await petPassportCache.savePassportCache(petId, {
          pet,
          vaccinations,
          prescriptions,
          consultations,
        });

        return {
          pet,
          vaccinations,
          prescriptions,
          consultations,
          isOffline: false,
          cachedAt: new Date().toISOString(),
        };
      } catch (networkErr) {
        // Fallback to durable local cache for offline access
        const cached = await petPassportCache.getPassportCache(petId);
        if (cached) {
          return {
            pet: cached.pet,
            vaccinations: cached.vaccinations,
            prescriptions: cached.prescriptions,
            consultations: cached.consultations,
            isOffline: true,
            cachedAt: cached.cachedAt,
          };
        }
        throw networkErr;
      }
    },
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
      queryClient.invalidateQueries({ queryKey: [...PET_PASSPORT_KEY, updatedPet.id] });
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

