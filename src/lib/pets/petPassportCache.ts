import { SecureStorageAdapter } from '../supabase/storage';
import { Pet, PetVaccination } from '../../types/pet';
import { Prescription } from '../../types/prescription';
import { Appointment } from '../../types/appointment';

export interface CachedPetPassport {
  pet: Pet;
  vaccinations: PetVaccination[];
  prescriptions: Prescription[];
  consultations: Appointment[];
  cachedAt: string; // ISO 8601 string
}

const PASSPORT_CACHE_PREFIX = 'vetopia_passport_cache_';

/**
 * PetPassportCache
 * Provides durable local offline caching for pet health passports, vaccination histories,
 * digital prescriptions, and past telemedicine consultations (FR-PET-002, NFR-REL-002).
 * Uses SecureStorageAdapter to store chunk-safe snapshots readable without internet connectivity.
 */
export const petPassportCache = {
  /**
   * Save a full snapshot of the pet passport data to durable local cache.
   */
  async savePassportCache(
    petId: string,
    data: {
      pet: Pet;
      vaccinations: PetVaccination[];
      prescriptions: Prescription[];
      consultations: Appointment[];
    },
  ): Promise<void> {
    if (!petId) return;

    try {
      const payload: CachedPetPassport = {
        pet: data.pet,
        vaccinations: data.vaccinations || [],
        prescriptions: data.prescriptions || [],
        consultations: data.consultations || [],
        cachedAt: new Date().toISOString(),
      };

      await SecureStorageAdapter.setItem(
        `${PASSPORT_CACHE_PREFIX}${petId}`,
        JSON.stringify(payload),
      );
    } catch (err) {
      console.warn(`[PetPassportCache] Failed to save passport cache for pet ${petId}:`, err);
    }
  },

  /**
   * Retrieve cached pet passport from durable storage for offline viewing.
   */
  async getPassportCache(petId: string): Promise<CachedPetPassport | null> {
    if (!petId) return null;

    try {
      const raw = await SecureStorageAdapter.getItem(`${PASSPORT_CACHE_PREFIX}${petId}`);
      if (!raw) return null;

      const parsed: CachedPetPassport = JSON.parse(raw);
      if (!parsed || !parsed.pet) return null;

      return parsed;
    } catch (err) {
      console.warn(`[PetPassportCache] Failed to read passport cache for pet ${petId}:`, err);
      return null;
    }
  },

  /**
   * Clear cached passport data for a pet (e.g. upon pet deletion).
   */
  async clearPassportCache(petId: string): Promise<void> {
    if (!petId) return;

    try {
      await SecureStorageAdapter.removeItem(`${PASSPORT_CACHE_PREFIX}${petId}`);
    } catch (err) {
      console.warn(`[PetPassportCache] Failed to clear passport cache for pet ${petId}:`, err);
    }
  },

  /**
   * Determine whether a cached snapshot is considered stale (default threshold: 60 minutes).
   */
  isCacheStale(cachedAt: string, maxAgeMinutes = 60): boolean {
    if (!cachedAt) return true;
    const time = new Date(cachedAt).getTime();
    if (isNaN(time)) return true;
    return Date.now() - time > maxAgeMinutes * 60 * 1000;
  },

  /**
   * Format the cachedAt timestamp for user-facing offline indicators.
   */
  formatLastUpdated(isoString: string): string {
    if (!isoString) return 'Unknown';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  },
};
