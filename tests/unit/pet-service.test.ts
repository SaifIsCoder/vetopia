import { petService } from '../../src/lib/pets/petService';
import { petPassportCache } from '../../src/lib/pets/petPassportCache';
import { supabase } from '../../src/lib/supabase/client';
import { AuthError, NotFoundError, ValidationError, ApiError } from '../../src/lib/api/errors';

// In-memory SecureStore mock
const mockSecureStorage = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStorage.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, val: string) => {
    mockSecureStorage.set(key, val);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStorage.delete(key);
    return Promise.resolve();
  }),
}));

// Mock Supabase Client
jest.mock('../../src/lib/supabase/client', () => {
  return {
    supabase: {
      auth: {
        getSession: jest.fn(),
      },
      from: jest.fn(),
    },
  };
});

describe('PetService — Unit & Security Verification (MVP-02)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Validation Rules', () => {
    test('Throws ValidationError if pet name is missing or too short', () => {
      expect(() => petService.validatePetInput({ name: '', species: 'Dog' })).toThrow(
        ValidationError,
      );
      expect(() => petService.validatePetInput({ name: 'A', species: 'Dog' })).toThrow(
        ValidationError,
      );
    });

    test('Throws ValidationError if species is missing', () => {
      expect(() => petService.validatePetInput({ name: 'Luna', species: '' })).toThrow(
        ValidationError,
      );
    });

    test('Throws ValidationError if weight is negative or exceeds limit', () => {
      expect(() =>
        petService.validatePetInput({ name: 'Luna', species: 'Dog', weight_kg: -5 }),
      ).toThrow(ValidationError);
      expect(() =>
        petService.validatePetInput({ name: 'Luna', species: 'Dog', weight_kg: 600 }),
      ).toThrow(ValidationError);
    });

    test('Passes validation with valid inputs', () => {
      expect(() =>
        petService.validatePetInput({
          name: 'Luna',
          species: 'Dog',
          weight_kg: 14.5,
          sex: 'female',
        }),
      ).not.toThrow();
    });
  });

  describe('2. Fetching Pets (getPets & getPetById)', () => {
    test('Successfully returns list of pets for authenticated owner', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: { user: { id: 'owner-123' } } },
      });

      const mockOrder = jest.fn().mockResolvedValue({
        data: [
          { id: 'pet-1', owner_id: 'owner-123', name: 'Luna', species: 'Dog' },
          { id: 'pet-2', owner_id: 'owner-123', name: 'Milo', species: 'Cat' },
        ],
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const pets = await petService.getPets();

      expect(supabase.from).toHaveBeenCalledWith('pets');
      expect(mockEq).toHaveBeenCalledWith('owner_id', 'owner-123');
      expect(pets).toHaveLength(2);
      expect(pets[0].name).toBe('Luna');
    });

    test('Throws AuthError if user is not signed in when fetching pets', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
      });

      await expect(petService.getPets()).rejects.toThrow(AuthError);
    });

    test('Successfully fetches single pet by ID', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: { id: 'pet-1', owner_id: 'owner-123', name: 'Luna', species: 'Dog' },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const pet = await petService.getPetById('pet-1');
      expect(pet.id).toBe('pet-1');
      expect(pet.name).toBe('Luna');
    });

    test('Throws NotFoundError when pet record is not found or inaccessible by RLS', async () => {
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      await expect(petService.getPetById('non-existent-or-unauthorized')).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe('3. Creating Pets (createPet)', () => {
    test('Registers a new pet and enforces owner_id binding', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: { user: { id: 'owner-123' } } },
      });

      let insertedPayload: any = null;
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: 'pet-new',
          owner_id: 'owner-123',
          name: 'Bella',
          species: 'Cat',
          weight_kg: 4.2,
        },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockImplementation((payload) => {
        insertedPayload = payload;
        return { select: mockSelect };
      });

      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await petService.createPet({
        name: 'Bella',
        species: 'Cat',
        weight_kg: 4.2,
      });

      expect(insertedPayload).toBeDefined();
      expect(insertedPayload.owner_id).toBe('owner-123'); // Authoritative ownership binding
      expect(insertedPayload.name).toBe('Bella');
      expect(result.id).toBe('pet-new');
    });

    test('Throws AuthError if user is not signed in when creating pet', async () => {
      (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
        data: { session: null },
      });

      await expect(
        petService.createPet({
          name: 'Bella',
          species: 'Cat',
        }),
      ).rejects.toThrow(AuthError);
    });
  });

  describe('4. Updating & Deleting Pets', () => {
    test('Successfully updates pet details', async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: 'pet-1', name: 'Luna Updated', species: 'Dog', weight_kg: 15.0 },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

      const updated = await petService.updatePet('pet-1', {
        name: 'Luna Updated',
        weight_kg: 15.0,
      });

      expect(mockEq).toHaveBeenCalledWith('id', 'pet-1');
      expect(updated.name).toBe('Luna Updated');
    });

    test('Successfully deletes pet', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      await expect(petService.deletePet('pet-1')).resolves.not.toThrow();
      expect(mockEq).toHaveBeenCalledWith('id', 'pet-1');
    });

    test('Throws ApiError if delete operation fails on database', async () => {
      const mockEq = jest.fn().mockResolvedValue({
        error: { message: 'Database constraint violation' },
      });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      await expect(petService.deletePet('pet-1')).rejects.toThrow(ApiError);
    });
  });

  describe('5. Phase B — Vaccination History & Validation (FR-PET-002)', () => {
    test('validateVaccinationInput validates required fields and dates', () => {
      expect(() =>
        petService.validateVaccinationInput({
          pet_id: '',
          vaccine_name: 'Rabies',
          administered_at: '2026-10-24',
        }),
      ).toThrow(ValidationError);

      expect(() =>
        petService.validateVaccinationInput({
          pet_id: 'pet-1',
          vaccine_name: '',
          administered_at: '2026-10-24',
        }),
      ).toThrow('Vaccine name is required.');

      expect(() =>
        petService.validateVaccinationInput({
          pet_id: 'pet-1',
          vaccine_name: 'Rabies',
          administered_at: 'invalid-date',
        }),
      ).toThrow('Administered date must be a valid date in YYYY-MM-DD format.');

      expect(() =>
        petService.validateVaccinationInput({
          pet_id: 'pet-1',
          vaccine_name: 'Rabies',
          administered_at: '2026-10-24',
          next_due_at: '2026-10-20',
        }),
      ).toThrow('Next due date must be after the administered date.');

      expect(() =>
        petService.validateVaccinationInput({
          pet_id: 'pet-1',
          vaccine_name: 'Rabies 3-Year',
          administered_at: '2026-10-24',
          next_due_at: '2029-10-24',
          batch_number: 'LOT-9921',
          administered_by: 'Metro Pet Hospital',
        }),
      ).not.toThrow();
    });

    test('getVaccinationsByPetId retrieves sorted vaccinations for pet', async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: [
          {
            id: 'vac-1',
            pet_id: 'pet-1',
            vaccine_name: 'Rabies 3-Year',
            administered_at: '2026-10-24',
          },
        ],
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ select: mockSelect });

      const vacs = await petService.getVaccinationsByPetId('pet-1');

      expect(supabase.from).toHaveBeenCalledWith('pet_vaccinations');
      expect(mockEq).toHaveBeenCalledWith('pet_id', 'pet-1');
      expect(mockOrder).toHaveBeenCalledWith('administered_at', { ascending: false });
      expect(vacs).toHaveLength(1);
      expect(vacs[0].vaccine_name).toBe('Rabies 3-Year');
    });

    test('createVaccination inserts record and returns PetVaccination', async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: 'vac-new',
          pet_id: 'pet-1',
          vaccine_name: 'DHPP Core',
          administered_at: '2026-10-24',
          next_due_at: '2027-10-24',
        },
        error: null,
      });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      (supabase.from as jest.Mock).mockReturnValue({ insert: mockInsert });

      const result = await petService.createVaccination({
        pet_id: 'pet-1',
        vaccine_name: 'DHPP Core',
        administered_at: '2026-10-24',
        next_due_at: '2027-10-24',
      });

      expect(supabase.from).toHaveBeenCalledWith('pet_vaccinations');
      expect(result.id).toBe('vac-new');
      expect(result.vaccine_name).toBe('DHPP Core');
    });

    test('deleteVaccination removes vaccination by ID', async () => {
      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      (supabase.from as jest.Mock).mockReturnValue({ delete: mockDelete });

      await expect(petService.deleteVaccination('vac-1')).resolves.not.toThrow();
      expect(mockEq).toHaveBeenCalledWith('id', 'vac-1');
    });
  });

  describe('6. Phase B — Offline Passport Caching (petPassportCache)', () => {

    test('savePassportCache and getPassportCache persist and retrieve passport snapshot', async () => {
      const samplePet = {
        id: 'pet-cache-1',
        owner_id: 'owner-1',
        name: 'Charlie',
        species: 'Dog',
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      };

      await petPassportCache.savePassportCache('pet-cache-1', {
        pet: samplePet,
        vaccinations: [],
        prescriptions: [],
        consultations: [],
      });

      const cached = await petPassportCache.getPassportCache('pet-cache-1');

      expect(cached).not.toBeNull();
      expect(cached?.pet.name).toBe('Charlie');
      expect(cached?.cachedAt).toBeDefined();
    });

    test('isCacheStale detects stale timestamps correctly', () => {
      const freshDate = new Date().toISOString();
      expect(petPassportCache.isCacheStale(freshDate, 60)).toBe(false);

      const oldDate = new Date(Date.now() - 120 * 60 * 1000).toISOString(); // 2 hours ago
      expect(petPassportCache.isCacheStale(oldDate, 60)).toBe(true);
    });

    test('clearPassportCache removes cached data', async () => {
      await petPassportCache.clearPassportCache('pet-cache-1');
      const cached = await petPassportCache.getPassportCache('pet-cache-1');
      expect(cached).toBeNull();
    });
  });
});

