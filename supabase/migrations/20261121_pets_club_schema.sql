-- ==============================================================================
-- Migration: 20261121_pets_club_schema.sql
-- Description: Complete Supabase PostgreSQL Schema & RLS for The Pets Club Ecosystem
-- ==============================================================================

-- 1. EXTEND PROFILES & APP ROLES
-- Ensure app_role enum or role column supports owner, vet, seller, admin
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('owner', 'vet', 'seller', 'admin');
  ELSE
    BEGIN
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
      ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'seller';
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;
END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'English';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'US';

-- 2. EXTEND PETS TABLE WITH DIGITAL ID & HEALTH ATTRIBUTES
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS digital_id TEXT UNIQUE;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS allergies TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS weight NUMERIC DEFAULT 5.0;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'male';
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS microchip_number TEXT;

CREATE INDEX IF NOT EXISTS idx_pets_digital_id ON public.pets(digital_id);

-- 2b. PET VACCINATIONS TABLE (If not already created)
CREATE TABLE IF NOT EXISTS public.pet_vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  administered_at DATE NOT NULL,
  next_due_at DATE,
  batch_number TEXT,
  administered_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_pet_id ON public.pet_vaccinations(pet_id);
ALTER TABLE public.pet_vaccinations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pet_vaccinations_public_select" ON public.pet_vaccinations;
CREATE POLICY "pet_vaccinations_public_select" ON public.pet_vaccinations
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "pet_vaccinations_insert_authenticated" ON public.pet_vaccinations;
CREATE POLICY "pet_vaccinations_insert_authenticated" ON public.pet_vaccinations
  FOR INSERT TO authenticated WITH CHECK (true);

-- 3. CLINICS TABLE
CREATE TABLE IF NOT EXISTS public.clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  license_number TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  services_offered TEXT[] DEFAULT ARRAY['General Medicine', 'Surgery']::TEXT[],
  operating_hours TEXT DEFAULT '24/7',
  doctors_count INT DEFAULT 1,
  emergency_care_available BOOLEAN DEFAULT TRUE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinics_public_select" ON public.clinics;
CREATE POLICY "clinics_public_select" ON public.clinics
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "clinics_insert_authenticated" ON public.clinics;
CREATE POLICY "clinics_insert_authenticated" ON public.clinics
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "clinics_update_owner_or_admin" ON public.clinics;
CREATE POLICY "clinics_update_owner_or_admin" ON public.clinics
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- 4. FARMS TABLE (Dairy, Poultry & Livestock)
CREATE TABLE IF NOT EXISTS public.farms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  farm_type TEXT NOT NULL CHECK (farm_type IN ('dairy', 'poultry', 'livestock', 'mixed')),
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  size TEXT DEFAULT 'Small (under 50 head)',
  herd_count INT,
  lactating_count INT,
  yield_per_day_liters NUMERIC,
  flock_count INT,
  egg_production_per_day INT,
  health_compliance_status TEXT DEFAULT 'pending' CHECK (health_compliance_status IN ('compliant', 'review_required', 'pending')),
  verified BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "farms_select_owner_or_admin" ON public.farms;
CREATE POLICY "farms_select_owner_or_admin" ON public.farms
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR true);

DROP POLICY IF EXISTS "farms_insert_owner" ON public.farms;
CREATE POLICY "farms_insert_owner" ON public.farms
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- 5. MARKETPLACE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.marketplace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  seller_name TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Food', 'Toys', 'Grooming', 'Health', 'Farm Supplies', 'Pre-loved')),
  price_usd NUMERIC NOT NULL,
  rating NUMERIC DEFAULT 5.0,
  reviews_count INT DEFAULT 0,
  image_url TEXT NOT NULL,
  blurb TEXT NOT NULL,
  details TEXT[] DEFAULT ARRAY[]::TEXT[],
  stock_quantity INT DEFAULT 50,
  is_vet_approved BOOLEAN DEFAULT TRUE,
  verified_seller BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.marketplace_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_items_public_select" ON public.marketplace_items;
CREATE POLICY "marketplace_items_public_select" ON public.marketplace_items
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "marketplace_items_insert_seller" ON public.marketplace_items;
CREATE POLICY "marketplace_items_insert_seller" ON public.marketplace_items
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

-- 6. PAYMENTS & ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'INR', 'PKR', 'AED')),
  exchange_rate_to_usd NUMERIC DEFAULT 1.0,
  amount_usd NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  item_type TEXT NOT NULL CHECK (item_type IN ('consultation', 'membership', 'marketplace', 'second_opinion')),
  reference_id TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  payment_method TEXT DEFAULT 'card',
  gateway_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_owner" ON public.payments;
CREATE POLICY "payments_select_owner" ON public.payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "payments_insert_owner" ON public.payments;
CREATE POLICY "payments_insert_owner" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 7. ADOPTIONS & APPLICATIONS TABLES
CREATE TABLE IF NOT EXISTS public.adoptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shelter_id TEXT NOT NULL,
  shelter_name TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('Dogs', 'Cats', 'Birds', 'Other')),
  breed TEXT NOT NULL,
  age TEXT NOT NULL,
  location TEXT NOT NULL,
  image_url TEXT NOT NULL,
  story TEXT NOT NULL,
  vaccinated BOOLEAN DEFAULT TRUE,
  neutered BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'requested', 'approved', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.adoption_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_slug TEXT REFERENCES public.adoptions(slug) ON DELETE CASCADE,
  applicant_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  applicant_name TEXT NOT NULL,
  applicant_email TEXT NOT NULL,
  home_type TEXT DEFAULT 'Apartment',
  activity_level TEXT DEFAULT 'Moderate',
  hours_alone TEXT DEFAULT '4-8 hours',
  has_other_pets BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.adoptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.adoption_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adoptions_public_select" ON public.adoptions;
CREATE POLICY "adoptions_public_select" ON public.adoptions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "adoption_apps_select_applicant" ON public.adoption_applications;
CREATE POLICY "adoption_apps_select_applicant" ON public.adoption_applications
  FOR SELECT TO authenticated
  USING (applicant_id = auth.uid());

DROP POLICY IF EXISTS "adoption_apps_insert_authenticated" ON public.adoption_applications;
CREATE POLICY "adoption_apps_insert_authenticated" ON public.adoption_applications
  FOR INSERT TO authenticated
  WITH CHECK (applicant_id = auth.uid() OR applicant_id IS NULL);

-- 8. CONSULTATIONS TABLE (State machine: scheduled -> active -> completed)
CREATE TABLE IF NOT EXISTS public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id TEXT UNIQUE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vet_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES public.pets(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  consultation_fee_usd NUMERIC DEFAULT 45.0,
  is_second_opinion BOOLEAN DEFAULT FALSE,
  original_consultation_id TEXT,
  second_opinion_notes TEXT,
  prescription_id TEXT,
  clinical_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consultations_select_participants" ON public.consultations;
CREATE POLICY "consultations_select_participants" ON public.consultations
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR vet_id = auth.uid());

DROP POLICY IF EXISTS "consultations_insert_authenticated" ON public.consultations;
CREATE POLICY "consultations_insert_authenticated" ON public.consultations
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "consultations_update_participants" ON public.consultations;
CREATE POLICY "consultations_update_participants" ON public.consultations
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR vet_id = auth.uid());

-- 9. REPORTS TABLE (Abuse & Fraud Flagging)
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reporter_name TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment', 'seller', 'product', 'clinic', 'user')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  action_taken TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_insert_any" ON public.reports;
CREATE POLICY "reports_insert_any" ON public.reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "reports_select_admin" ON public.reports;
CREATE POLICY "reports_select_admin" ON public.reports
  FOR SELECT TO authenticated
  USING (true);
