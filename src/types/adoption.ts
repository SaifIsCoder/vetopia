export type AdoptionSpecies = 'All' | 'Dogs' | 'Cats' | 'Birds' | 'Other';
export type AdoptionStatus = 'available' | 'requested' | 'approved' | 'completed';

export interface AdoptablePet {
  id?: string;
  slug: string;
  name: string;
  species: 'Dogs' | 'Cats' | 'Birds' | 'Other';
  breed: string;
  age: string;
  location: string;
  imageUrl: string;
  story: string;
  vaccinated: boolean;
  neutered: boolean;
  status: AdoptionStatus;
  shelterName?: string;
}

export interface AdoptionApplicationPayload {
  applicantName: string;
  applicantEmail: string;
  homeType: string;
  activityLevel: string;
  hoursAlone: string;
  hasOtherPets: boolean;
}
