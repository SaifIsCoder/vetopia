-- ==============================================================================
-- Migration: 20261024110000_pet_vaccinations_schema.sql
-- Module: Phase B — Pet Passport and Offline Access (FR-PET-002, NFR-REL-002)
-- Description: Vaccination history data model, security RLS policies, and indexes
-- ==============================================================================

-- 1. Create public.pet_vaccinations table
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

-- Performance indexes for querying by pet and date
CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_pet_id ON public.pet_vaccinations(pet_id);
CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_administered_at ON public.pet_vaccinations(administered_at);
CREATE INDEX IF NOT EXISTS idx_pet_vaccinations_next_due_at ON public.pet_vaccinations(next_due_at);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.pet_vaccinations ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies: public.pet_vaccinations
-- (a) SELECT: Allowed for pet owner OR consulting veterinarian who has an appointment for this pet
DROP POLICY IF EXISTS "pet_vaccinations_select_policy" ON public.pet_vaccinations;
CREATE POLICY "pet_vaccinations_select_policy"
  ON public.pet_vaccinations FOR SELECT TO authenticated
  USING (
    -- Pet owner
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = public.pet_vaccinations.pet_id
        AND p.owner_id = auth.uid()
    )
    OR
    -- Consulting veterinarian
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.vet_profiles v ON a.vet_id = v.id
      WHERE a.pet_id = public.pet_vaccinations.pet_id
        AND v.user_id = auth.uid()
    )
    OR
    -- Administrator role
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- (b) INSERT: Allowed for pet owner OR consulting veterinarian
DROP POLICY IF EXISTS "pet_vaccinations_insert_policy" ON public.pet_vaccinations;
CREATE POLICY "pet_vaccinations_insert_policy"
  ON public.pet_vaccinations FOR INSERT TO authenticated
  WITH CHECK (
    -- Pet owner
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = public.pet_vaccinations.pet_id
        AND p.owner_id = auth.uid()
    )
    OR
    -- Consulting veterinarian
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.vet_profiles v ON a.vet_id = v.id
      WHERE a.pet_id = public.pet_vaccinations.pet_id
        AND v.user_id = auth.uid()
    )
    OR
    -- Administrator role
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- (c) UPDATE: Allowed for pet owner or administering veterinarian
DROP POLICY IF EXISTS "pet_vaccinations_update_policy" ON public.pet_vaccinations;
CREATE POLICY "pet_vaccinations_update_policy"
  ON public.pet_vaccinations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = public.pet_vaccinations.pet_id
        AND p.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.appointments a
      JOIN public.vet_profiles v ON a.vet_id = v.id
      WHERE a.pet_id = public.pet_vaccinations.pet_id
        AND v.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );

-- (d) DELETE: Allowed for pet owner or administrator
DROP POLICY IF EXISTS "pet_vaccinations_delete_policy" ON public.pet_vaccinations;
CREATE POLICY "pet_vaccinations_delete_policy"
  ON public.pet_vaccinations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = public.pet_vaccinations.pet_id
        AND p.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
    )
  );
