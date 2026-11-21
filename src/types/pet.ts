/**
 * Pet Management Domain Types & Models — Vetopia Mobile MVP
 */

export type PetSpecies = 'Dog' | 'Cat' | 'Bird' | 'Rabbit' | 'Other';

export type PetSex = 'male' | 'female' | 'neutered_male' | 'spayed_female' | 'unknown';

export interface Pet {
  id: string;
  owner_id: string;
  name: string;
  species: string;
  breed?: string | null;
  age?: string | null;
  dob?: string | null;
  sex?: PetSex | string | null;
  color?: string | null;
  weight_kg?: number | null;
  bio?: string | null;
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePetDTO {
  name: string;
  species: string;
  breed?: string | null;
  age?: string | null;
  dob?: string | null;
  sex?: PetSex | string | null;
  color?: string | null;
  weight_kg?: number | null;
  bio?: string | null;
  photo_url?: string | null;
}

export interface UpdatePetDTO {
  name?: string;
  species?: string;
  breed?: string | null;
  age?: string | null;
  dob?: string | null;
  sex?: PetSex | string | null;
  color?: string | null;
  weight_kg?: number | null;
  bio?: string | null;
  photo_url?: string | null;
}

export const SPECIES_OPTIONS: PetSpecies[] = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'];

export const SEX_OPTIONS: { label: string; value: PetSex }[] = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Neutered Male', value: 'neutered_male' },
  { label: 'Spayed Female', value: 'spayed_female' },
  { label: 'Unknown', value: 'unknown' },
];

export interface PetVaccination {
  id: string;
  pet_id: string;
  vaccine_name: string;
  administered_at: string; // YYYY-MM-DD
  next_due_at?: string | null; // YYYY-MM-DD
  batch_number?: string | null;
  administered_by?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateVaccinationDTO {
  pet_id: string;
  vaccine_name: string;
  administered_at: string; // YYYY-MM-DD
  next_due_at?: string | null; // YYYY-MM-DD
  batch_number?: string | null;
  administered_by?: string | null;
  notes?: string | null;
}

export type VaccinationStatus = 'up_to_date' | 'due_soon' | 'overdue';

