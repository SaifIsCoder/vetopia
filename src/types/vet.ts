export interface VetProfile {
  id: string;
  user_id?: string | null;
  name: string;
  specialty: string;
  country: string;
  flag: string;
  languages: string[];
  price_usd: number;
  slot_minutes: number;
  rating: number;
  reviews: number;
  bio?: string | null;
  img_key?: string | null;
  timezone: string;
  verified: boolean;
  accepting: boolean;
  created_at?: string;
}

export interface VetAvailability {
  id: string;
  vet_id: string;
  weekday: number; // 0=Sun, 6=Sat
  start_minute: number; // e.g. 540 = 09:00
  end_minute: number; // e.g. 1020 = 17:00
  created_at?: string;
}

export interface TimeSlot {
  date: string; // YYYY-MM-DD
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  formattedTime: string; // "09:00"
}

export interface DaySchedule {
  date: string; // YYYY-MM-DD
  dayLabel: string; // "Wed, Sep 24"
  slots: TimeSlot[];
}

export interface VetFilterParams {
  q?: string;
  specialty?: string;
  language?: string;
  country?: string;
  max_price?: number;
  accepting_only?: boolean;
  page?: number;
  limit?: number;
}

/**
 * 12 Authoritative Specialties documented in SRS FR-VET-001
 */
export const VET_SPECIALTIES = [
  'General Veterinary Medicine',
  'Internal Medicine',
  'Dermatology',
  'Behavioral Medicine',
  'Cardiology',
  'Surgery',
  'Ophthalmology',
  'Emergency & Critical Care',
  'Nutrition',
  'Sport Medicine & Orthopaedics',
  'Dentistry',
  'Pathology & Infectious Disease',
] as const;

/**
 * 11 Authoritative Languages documented in SRS FR-VET-001 & PRD Section 5
 */
export const VET_LANGUAGES = [
  'English',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Russian',
  'Chinese',
  'Japanese',
  'Hindi',
  'Arabic',
  'Urdu',
] as const;

/**
 * Authoritative Countries from doctor network
 */
export const VET_COUNTRIES = [
  'United Kingdom',
  'Japan',
  'Nigeria',
  'Brazil',
  'United States',
  'India',
  'France',
  'Italy',
  'Mexico',
  'Vietnam',
  'UAE',
] as const;

export const VET_PRICE_OPTIONS = [30, 40, 50] as const;
