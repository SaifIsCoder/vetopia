export interface PrescriptionItem {
  id: string;
  prescription_id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  special_instructions?: string | null;
  created_at?: string;
}

export interface Prescription {
  id: string;
  appointment_id: string;
  vet_id: string;
  pet_id: string;
  diagnosis: string;
  notes?: string | null;
  refills_allowed: number;
  status: 'active' | 'completed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  items?: PrescriptionItem[];
  vet?: {
    id: string;
    name: string;
    specialty: string;
    flag: string;
    country: string;
    rating?: number;
    verified?: boolean;
  } | null;
  pet?: {
    id: string;
    name: string;
    species: string;
    breed?: string | null;
    age?: string | null;
    weight_kg?: number | null;
  } | null;
  appointment?: {
    id: string;
    starts_at: string;
    ends_at: string;
    mode: string;
    status: string;
  } | null;
}

export interface CreatePrescriptionItemDTO {
  medication_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  special_instructions?: string;
}

export interface CreatePrescriptionDTO {
  appointment_id: string;
  diagnosis: string;
  notes?: string;
  refills_allowed?: number;
  items: CreatePrescriptionItemDTO[];
}

export interface CreatePrescriptionResponse {
  success: boolean;
  prescription_id: string;
  appointment_id: string;
  item_count: number;
}
