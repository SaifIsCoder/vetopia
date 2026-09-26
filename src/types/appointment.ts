export type AppointmentMode = 'video' | 'audio' | 'chat';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled';

export type AppointmentUrgency = 'Low' | 'Medium' | 'High';

export interface Appointment {
  id: string;
  vet_id: string;
  pet_parent_id: string;
  pet_id?: string | null;
  starts_at: string; // ISO 8601
  ends_at: string; // ISO 8601
  mode: AppointmentMode;
  status: AppointmentStatus;
  pet_name?: string | null;
  species?: string | null;
  breed?: string | null;
  pet_age?: string | null;
  symptoms?: string | null;
  urgency?: AppointmentUrgency | string | null;
  medications?: string | null;
  contact_phone?: string | null;
  price_usd: number;
  created_at: string;
  updated_at?: string;
  // Joined doctor metadata for card UI
  vet?: {
    id: string;
    name: string;
    specialty: string;
    flag: string;
    country: string;
    img_key?: string | null;
    rating?: number;
    verified?: boolean;
  } | null;
}

export interface BookAppointmentDTO {
  vet_id: string;
  pet_id: string;
  starts_at: string; // ISO 8601
  mode: AppointmentMode;
  symptoms: string;
  urgency?: AppointmentUrgency;
  contact_phone?: string;
  medications?: string;
}

export interface BookingConfirmation {
  success: boolean;
  appointment_id: string;
  status: 'scheduled';
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  vet_id: string;
  vet_name: string;
  pet_id: string;
  pet_name: string;
  species: string;
  mode: AppointmentMode;
  price_usd: number;
  urgency: string;
  contact_phone?: string;
}

export const APPOINTMENT_MODES: { label: string; value: AppointmentMode; icon: string }[] = [
  { label: 'Video Call', value: 'video', icon: 'Video' },
  { label: 'Audio Call', value: 'audio', icon: 'Phone' },
  { label: 'Live Chat', value: 'chat', icon: 'MessageSquare' },
];

export const APPOINTMENT_URGENCIES: {
  label: string;
  value: AppointmentUrgency;
  description: string;
}[] = [
  { label: 'Routine', value: 'Low', description: 'General checkup or mild questions' },
  { label: 'Moderate', value: 'Medium', description: 'Noticeable symptoms needing attention' },
  { label: 'Urgent', value: 'High', description: 'Acute distress or sudden onset illness' },
];
