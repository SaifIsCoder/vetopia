import { apiClient } from '../api';
import { AdoptablePet, AdoptionApplicationPayload, AdoptionSpecies } from '../../types/adoption';

export const fallbackAdoptablePets: AdoptablePet[] = [
  {
    slug: 'buddy',
    name: 'Buddy',
    species: 'Dogs',
    breed: 'Golden Retriever',
    age: '2 yrs',
    location: 'Brooklyn, NY',
    imageUrl: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
    story: 'Buddy is a calm, affectionate Golden looking for a family with a yard. Loves children and other dogs.',
    vaccinated: true,
    neutered: true,
    status: 'available',
    shelterName: 'North Shore Rescue Haven',
  },
  {
    slug: 'luna',
    name: 'Luna',
    species: 'Cats',
    breed: 'Tabby Cat',
    age: '1 yr',
    location: 'Austin, TX',
    imageUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=600&q=80',
    story: 'Luna is an independent young tabby. Quiet, clean, and perfect for apartment living.',
    vaccinated: true,
    neutered: true,
    status: 'available',
    shelterName: 'Austin Animal Friends',
  },
  {
    slug: 'charlie',
    name: 'Charlie',
    species: 'Dogs',
    breed: 'Labrador Mix',
    age: '3 yrs',
    location: 'Miami, FL',
    imageUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=600&q=80',
    story: 'Charlie is a beach-loving Lab mix who is all heart. Knows sit, stay, and snack time.',
    vaccinated: true,
    neutered: true,
    status: 'available',
    shelterName: 'Sunshine Rescue Network',
  },
  {
    slug: 'kiwi',
    name: 'Kiwi',
    species: 'Birds',
    breed: 'Green-cheeked Conure',
    age: '2 yrs',
    location: 'San Diego, CA',
    imageUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&w=600&q=80',
    story: 'Kiwi is a chatty conure who loves shoulder rides and sunflower seeds.',
    vaccinated: true,
    neutered: false,
    status: 'available',
    shelterName: 'Pacific Avian Sanctuary',
  },
];

export async function fetchAdoptionPets(species?: AdoptionSpecies): Promise<AdoptablePet[]> {
  try {
    const res = await apiClient.request<AdoptablePet[]>('adoption/pets', {
      params: species && species !== 'All' ? { species } : undefined,
      requiresAuth: false,
    });
    if (res.data && res.data.length > 0) {
      return res.data;
    }
  } catch {
    // Fallback to static verified animals
  }

  if (species && species !== 'All') {
    return fallbackAdoptablePets.filter((p) => p.species === species);
  }
  return fallbackAdoptablePets;
}

export async function fetchPetBySlug(slug: string): Promise<AdoptablePet | null> {
  const all = await fetchAdoptionPets();
  return all.find((p) => p.slug === slug) || null;
}

export async function submitAdoptionApplication(slug: string, payload: AdoptionApplicationPayload): Promise<any> {
  const res = await apiClient.request(`adoption/pets/${slug}/apply`, {
    method: 'POST',
    body: payload,
    requiresAuth: false,
  });
  return res.data;
}
