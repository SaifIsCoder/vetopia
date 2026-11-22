/**
 * Supabase Database TypeScript Definitions
 * Reflects public schema tables, enums, and JSONB structures.
 */

export type AppRole = 'owner' | 'vet' | 'seller' | 'admin';
export type FarmType = 'dairy' | 'poultry' | 'livestock' | 'mixed';
export type HealthComplianceStatus = 'compliant' | 'review_required' | 'pending';
export type MarketplaceCategory = 'Food' | 'Toys' | 'Grooming' | 'Health' | 'Farm Supplies' | 'Pre-loved';
export type PaymentCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CAD' | 'AUD' | 'INR' | 'PKR' | 'AED';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PaymentItemType = 'consultation' | 'membership' | 'marketplace' | 'second_opinion';
export type AdoptionSpecies = 'Dogs' | 'Cats' | 'Birds' | 'Other';
export type AdoptionStatus = 'available' | 'requested' | 'approved' | 'completed';
export type ConsultationStatus = 'scheduled' | 'active' | 'completed' | 'cancelled';
export type ReportTargetType = 'post' | 'comment' | 'seller' | 'product' | 'clinic' | 'user';
export type ReportStatus = 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export interface DbProfile {
  id: string;
  email?: string;
  full_name: string;
  avatar_url?: string | null;
  phone?: string | null;
  role: AppRole;
  is_verified: boolean;
  preferred_language: string;
  country: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbPet {
  id: string;
  owner_id: string;
  digital_id: string;
  name: string;
  species: string;
  breed: string;
  dob?: string | null;
  age?: number;
  weight?: number;
  gender: string;
  microchip_number?: string | null;
  allergies?: string[];
  photo_url?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbClinic {
  id: string;
  owner_id?: string;
  name: string;
  license_number: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  services_offered: string[];
  operating_hours: string;
  doctors_count: number;
  emergency_care_available: boolean;
  verified: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbFarm {
  id: string;
  owner_id?: string;
  name: string;
  farm_type: FarmType;
  country: string;
  region: string;
  size: string;
  herd_count?: number;
  lactating_count?: number;
  yield_per_day_liters?: number;
  flock_count?: number;
  egg_production_per_day?: number;
  health_compliance_status: HealthComplianceStatus;
  verified: boolean;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DbMarketplaceItem {
  id: string;
  seller_id?: string;
  seller_name: string;
  name: string;
  slug: string;
  category: MarketplaceCategory;
  price_usd: number;
  rating: number;
  reviews_count: number;
  image_url: string;
  blurb: string;
  details: string[];
  stock_quantity: number;
  is_vet_approved: boolean;
  verified_seller: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DbPayment {
  id: string;
  user_id?: string;
  amount: number;
  currency: PaymentCurrency;
  exchange_rate_to_usd: number;
  amount_usd: number;
  status: PaymentStatus;
  item_type: PaymentItemType;
  reference_id: string;
  transaction_id: string;
  payment_method: string;
  gateway_response?: any;
  created_at?: string;
  updated_at?: string;
}

export interface DbAdoptionPet {
  id: string;
  shelter_id: string;
  shelter_name: string;
  name: string;
  slug: string;
  species: AdoptionSpecies;
  breed: string;
  age: string;
  location: string;
  image_url: string;
  story: string;
  vaccinated: boolean;
  neutered: boolean;
  status: AdoptionStatus;
  created_at?: string;
  updated_at?: string;
}

export interface DbAdoptionApplication {
  id: string;
  pet_slug: string;
  applicant_id?: string;
  applicant_name: string;
  applicant_email: string;
  home_type: string;
  activity_level: string;
  hours_alone: string;
  has_other_pets: boolean;
  status: 'pending' | 'approved' | 'rejected';
  created_at?: string;
}

export interface DbConsultation {
  id: string;
  appointment_id: string;
  owner_id?: string;
  vet_id?: string;
  pet_id?: string;
  scheduled_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds: number;
  status: ConsultationStatus;
  consultation_fee_usd: number;
  is_second_opinion: boolean;
  original_consultation_id?: string | null;
  second_opinion_notes?: string | null;
  prescription_id?: string | null;
  clinical_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface DbReport {
  id: string;
  reporter_id?: string;
  reporter_name?: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: ReportStatus;
  action_taken?: string | null;
  admin_notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
