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
