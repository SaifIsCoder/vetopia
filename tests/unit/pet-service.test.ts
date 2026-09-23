import { petService } from '../../src/lib/pets/petService';
import { supabase } from '../../src/lib/supabase/client';
import { AuthError, NotFoundError, ValidationError, ApiError } from '../../src/lib/api/errors';

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
});
