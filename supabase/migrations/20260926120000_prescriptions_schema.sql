-- ==============================================================================
-- Migration: 20260926120000_prescriptions_schema.sql
-- Module: MVP-06 Digital Prescriptions (Phase 7)
-- Author: Antigravity Team
-- Requirements: FR-PRES-001, FR-PRES-002
-- ==============================================================================

-- 1. Create public.prescriptions table
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id UUID NOT NULL UNIQUE REFERENCES public.appointments(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.vet_profiles(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  diagnosis TEXT NOT NULL,
  notes TEXT,
  refills_allowed INT NOT NULL DEFAULT 0 CHECK (refills_allowed >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for optimal querying by pet, vet, and appointment
CREATE INDEX IF NOT EXISTS idx_prescriptions_pet ON public.prescriptions(pet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_vet ON public.prescriptions(vet_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_appointment ON public.prescriptions(appointment_id);

-- 2. Create public.prescription_items table
CREATE TABLE IF NOT EXISTS public.prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration TEXT NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prescription_items_prescription ON public.prescription_items(prescription_id);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies: public.prescriptions
-- Pet parent can read prescriptions belonging to their own pet
-- Consulting vet can read prescriptions for consultations they conducted
-- Administrators have full read access
DROP POLICY IF EXISTS "prescriptions_select_authorized" ON public.prescriptions;
CREATE POLICY "prescriptions_select_authorized"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pets p
      WHERE p.id = public.prescriptions.pet_id
        AND p.owner_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.vet_profiles v
      WHERE v.id = public.prescriptions.vet_id
        AND v.user_id = auth.uid()
    )
    OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Direct client inserts, updates, and deletes are disabled to ensure clinical immutability.
-- Prescriptions must be created via the secure create_prescription() RPC.
DROP POLICY IF EXISTS "prescriptions_insert_vet" ON public.prescriptions;
CREATE POLICY "prescriptions_insert_vet"
  ON public.prescriptions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vet_profiles v
      WHERE v.id = public.prescriptions.vet_id
        AND v.user_id = auth.uid()
    )
  );

-- 5. RLS Policies: public.prescription_items
-- Read access is granted to anyone authorized to view the parent prescription
DROP POLICY IF EXISTS "prescription_items_select" ON public.prescription_items;
CREATE POLICY "prescription_items_select"
  ON public.prescription_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = public.prescription_items.prescription_id
        AND (
          EXISTS (
            SELECT 1 FROM public.pets pet
            WHERE pet.id = p.pet_id AND pet.owner_id = auth.uid()
          )
          OR
          EXISTS (
            SELECT 1 FROM public.vet_profiles v
            WHERE v.id = p.vet_id AND v.user_id = auth.uid()
          )
          OR
          public.has_role(auth.uid(), 'admin'::public.app_role)
        )
    )
  );

DROP POLICY IF EXISTS "prescription_items_insert_vet" ON public.prescription_items;
CREATE POLICY "prescription_items_insert_vet"
  ON public.prescription_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      JOIN public.vet_profiles v ON v.id = p.vet_id
      WHERE p.id = public.prescription_items.prescription_id
        AND v.user_id = auth.uid()
    )
  );

-- 6. Atomic Server-Side Prescription Creation RPC (FR-PRES-001)
-- Enforces:
--  - Caller is authenticated
--  - Appointment exists
--  - Appointment status is strictly 'completed'
--  - Caller is the assigned consulting veterinarian
--  - At least one medication item is provided
--  - Validates required fields on each medication item
--  - One-prescription-per-appointment uniqueness constraint
--  - Atomic transaction: prescription + all items created together
CREATE OR REPLACE FUNCTION public.create_prescription(
  p_appointment_id UUID,
  p_diagnosis TEXT,
  p_notes TEXT DEFAULT NULL,
  p_refills_allowed INT DEFAULT 0,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
  v_vet public.vet_profiles%ROWTYPE;
  v_prescription_id UUID;
  v_item JSONB;
  v_medication_name TEXT;
  v_dosage TEXT;
  v_frequency TEXT;
  v_duration TEXT;
  v_special_instructions TEXT;
  v_item_count INT;
BEGIN
  -- 1. Verify caller authentication
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is null' USING ERRCODE = '28000';
  END IF;

  -- 2. Verify appointment existence
  SELECT * INTO v_appt
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found' USING ERRCODE = 'P0002';
  END IF;

  -- 3. Verify appointment status is 'completed'
  IF v_appt.status <> 'completed' THEN
    RAISE EXCEPTION 'Prescription can only be issued for completed appointments (current status: %)', v_appt.status
      USING ERRCODE = 'P0001';
  END IF;

  -- 4. Verify consulting veterinarian ownership
  SELECT * INTO v_vet
  FROM public.vet_profiles
  WHERE id = v_appt.vet_id;

  IF NOT FOUND OR v_vet.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden: Only the assigned consulting veterinarian can create a prescription for this appointment'
      USING ERRCODE = '42501';
  END IF;

  -- 5. Verify pet is assigned
  IF v_appt.pet_id IS NULL THEN
    RAISE EXCEPTION 'Cannot issue prescription: Appointment has no linked pet' USING ERRCODE = '22023';
  END IF;

  -- 6. Enforce duplicate prescription policy (one prescription per appointment)
  IF EXISTS (SELECT 1 FROM public.prescriptions WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'A prescription has already been issued for this appointment' USING ERRCODE = '23505';
  END IF;

  -- 7. Validate diagnosis
  IF p_diagnosis IS NULL OR trim(p_diagnosis) = '' THEN
    RAISE EXCEPTION 'Clinical diagnosis is required' USING ERRCODE = '22023';
  END IF;

  -- 8. Validate medication items list
  v_item_count := jsonb_array_length(p_items);
  IF v_item_count IS NULL OR v_item_count = 0 THEN
    RAISE EXCEPTION 'At least one medication item is required on a digital prescription' USING ERRCODE = '22023';
  END IF;

  -- 9. Insert prescription record
  INSERT INTO public.prescriptions (
    appointment_id,
    vet_id,
    pet_id,
    diagnosis,
    notes,
    refills_allowed,
    status
  ) VALUES (
    v_appt.id,
    v_appt.vet_id,
    v_appt.pet_id,
    trim(p_diagnosis),
    CASE WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' THEN trim(p_notes) ELSE NULL END,
    GREATEST(0, COALESCE(p_refills_allowed, 0)),
    'active'
  )
  RETURNING id INTO v_prescription_id;

  -- 10. Insert each medication item atomically
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_medication_name := trim(COALESCE(v_item->>'medication_name', ''));
    v_dosage := trim(COALESCE(v_item->>'dosage', ''));
    v_frequency := trim(COALESCE(v_item->>'frequency', ''));
    v_duration := trim(COALESCE(v_item->>'duration', ''));
    v_special_instructions := trim(COALESCE(v_item->>'special_instructions', ''));

    IF v_medication_name = '' THEN
      RAISE EXCEPTION 'Medication name is required for all prescription items' USING ERRCODE = '22023';
    END IF;

    IF v_dosage = '' THEN
      RAISE EXCEPTION 'Dosage is required for medication: %', v_medication_name USING ERRCODE = '22023';
    END IF;

    IF v_frequency = '' THEN
      RAISE EXCEPTION 'Frequency is required for medication: %', v_medication_name USING ERRCODE = '22023';
    END IF;

    IF v_duration = '' THEN
      RAISE EXCEPTION 'Duration is required for medication: %', v_medication_name USING ERRCODE = '22023';
    END IF;

    INSERT INTO public.prescription_items (
      prescription_id,
      medication_name,
      dosage,
      frequency,
      duration,
      special_instructions
    ) VALUES (
      v_prescription_id,
      v_medication_name,
      v_dosage,
      v_frequency,
      v_duration,
      CASE WHEN v_special_instructions <> '' THEN v_special_instructions ELSE NULL END
    );
  END LOOP;

  -- 11. Return successful creation confirmation
  RETURN jsonb_build_object(
    'success', true,
    'prescription_id', v_prescription_id,
    'appointment_id', v_appt.id,
    'item_count', v_item_count
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.create_prescription(UUID, TEXT, TEXT, INT, JSONB) TO authenticated, service_role;
