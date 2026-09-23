import { supabase } from '../supabase/client';
import { Pet, CreatePetDTO, UpdatePetDTO } from '../../types/pet';
import { ApiError, AuthError, NotFoundError, ValidationError } from '../api/errors';

export class PetService {
  /**
   * Validate pet input fields
   */
  public validatePetInput(input: Partial<CreatePetDTO>, isUpdate = false): void {
    if (!isUpdate || input.name !== undefined) {
      if (!input.name || input.name.trim().length < 2) {
        throw new ValidationError('Pet name must be at least 2 characters.');
      }
    }

    if (!isUpdate || input.species !== undefined) {
      if (!input.species || !input.species.trim()) {
        throw new ValidationError('Species is required.');
      }
    }

    if (input.weight_kg !== undefined && input.weight_kg !== null) {
      const weight = Number(input.weight_kg);
      if (isNaN(weight) || weight <= 0 || weight > 500) {
        throw new ValidationError('Weight must be a valid positive number up to 500 kg.');
      }
    }
  }

  /**
   * Fetch all pets belonging to the authenticated user.
   * RLS strictly ensures only owned pets are returned.
   */
  public async getPets(ownerId?: string): Promise<Pet[]> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('You must be signed in to view pets.');
      }

      const effectiveOwnerId = ownerId || session.user.id;

      const { data, error } = await supabase
        .from('pets')
        .select('*')
        .eq('owner_id', effectiveOwnerId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new ApiError(error.message, 500);
      }

      return (data || []) as Pet[];
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to fetch pets.', 500);
    }
  }

  /**
   * Fetch a single pet by ID.
   * Protected by RLS (returns error if caller is not the owner or authorized).
   */
  public async getPetById(petId: string): Promise<Pet> {
    if (!petId) {
      throw new ValidationError('Pet ID is required.');
    }

    try {
      const { data, error } = await supabase.from('pets').select('*').eq('id', petId).maybeSingle();

      if (error) {
        throw new ApiError(error.message, 500);
      }

      if (!data) {
        throw new NotFoundError('Pet not found or you do not have permission to view it.');
      }

      return data as Pet;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to fetch pet details.', 500);
    }
  }

  /**
   * Register a new household pet for the current user.
   */
  public async createPet(dto: CreatePetDTO): Promise<Pet> {
    this.validatePetInput(dto);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('You must be signed in to register a pet.');
      }

      const payload = {
        owner_id: session.user.id,
        name: dto.name.trim(),
        species: dto.species.trim(),
        breed: dto.breed?.trim() || null,
        age: dto.age?.trim() || null,
        dob: dto.dob?.trim() || null,
        sex: dto.sex || null,
        color: dto.color?.trim() || null,
        weight_kg:
          dto.weight_kg !== undefined && dto.weight_kg !== null ? Number(dto.weight_kg) : null,
        bio: dto.bio?.trim() || null,
        photo_url: dto.photo_url?.trim() || null,
      };

      const { data, error } = await supabase.from('pets').insert(payload).select().single();

      if (error) {
        throw new ApiError(error.message, 500);
      }

      return data as Pet;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to register pet.', 500);
    }
  }

  /**
   * Update an existing pet record.
   * RLS ensures only the pet owner can update.
   */
  public async updatePet(petId: string, dto: UpdatePetDTO): Promise<Pet> {
    if (!petId) {
      throw new ValidationError('Pet ID is required.');
    }

    this.validatePetInput(dto, true);

    try {
      const updates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (dto.name !== undefined) updates.name = dto.name.trim();
      if (dto.species !== undefined) updates.species = dto.species.trim();
      if (dto.breed !== undefined) updates.breed = dto.breed?.trim() || null;
      if (dto.age !== undefined) updates.age = dto.age?.trim() || null;
      if (dto.dob !== undefined) updates.dob = dto.dob?.trim() || null;
      if (dto.sex !== undefined) updates.sex = dto.sex || null;
      if (dto.color !== undefined) updates.color = dto.color?.trim() || null;
      if (dto.weight_kg !== undefined) {
        updates.weight_kg = dto.weight_kg !== null ? Number(dto.weight_kg) : null;
      }
      if (dto.bio !== undefined) updates.bio = dto.bio?.trim() || null;
      if (dto.photo_url !== undefined) updates.photo_url = dto.photo_url?.trim() || null;

      const { data, error } = await supabase
        .from('pets')
        .update(updates)
        .eq('id', petId)
        .select()
        .single();

      if (error) {
        throw new ApiError(error.message, 500);
      }

      if (!data) {
        throw new NotFoundError('Pet not found or you do not have permission to update it.');
      }

      return data as Pet;
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to update pet record.', 500);
    }
  }

  /**
   * Delete a pet record.
   * RLS ensures only the pet owner can delete.
   */
  public async deletePet(petId: string): Promise<void> {
    if (!petId) {
      throw new ValidationError('Pet ID is required.');
    }

    try {
      const { error } = await supabase.from('pets').delete().eq('id', petId);

      if (error) {
        throw new ApiError(error.message, 500);
      }
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(err?.message || 'Failed to delete pet.', 500);
    }
  }
}

export const petService = new PetService();
