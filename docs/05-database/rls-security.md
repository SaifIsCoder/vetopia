# Row Level Security (RLS) & Multi-Tier Data Protection — Vetopia Mobile MVP

This document specifies the complete multi-tier security model for **Vetopia Mobile**, covering Client-Side Security, Backend API Gateway Security, and Database Row Level Security (RLS) policies.

---

## 1. Multi-Tier Security Overview

```
Mobile Client (Expo)         Backend API (Express.js)       Database Layer (Supabase)
┌──────────────────────┐    ┌─────────────────────────┐    ┌─────────────────────────┐
│ • expo-secure-store  │    │ • JWT Verification      │    │ • Row Level Security    │
│ • SSL Pinning        ├───►│ • RBAC Middleware       ├───►│ • Multi-Tenant Isolation│
│ • Zero Plain Secrets │    │ • Zod Input Sanitization│    │ • Encrypted Storage RLS │
│ • Biometric Auth     │    │ • IP Rate Limiting      │    │ • Audit Triggers        │
└──────────────────────┘    └─────────────────────────┘    └─────────────────────────┘
```

---

## 2. Database Row Level Security Policies

Every table containing personal or clinical information has RLS enabled. Policies strictly enforce role and owner boundaries.

### 2.1 Profiles (`public.profiles`)
```sql
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can view public profile details (doctor names, parent usernames)
CREATE POLICY "profiles_select_public" 
  ON public.profiles FOR SELECT USING (true);

-- Users can only insert their own profile on signup
CREATE POLICY "profiles_insert_own" 
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "profiles_update_own" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);
```

### 2.2 Pets (`public.pets`)
```sql
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;

-- Revoke anon select to prevent unauthenticated data leakage
REVOKE SELECT ON public.pets FROM anon;

-- Owners can view their own pets; administrators can view all
CREATE POLICY "owner reads own pets" 
  ON public.pets FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR 
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Only authenticated pet parents can register new pets under their own ID
CREATE POLICY "owner inserts own pets" 
  ON public.pets FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Only pet owner can modify their pet record
CREATE POLICY "owner updates own pets" 
  ON public.pets FOR UPDATE TO authenticated
  USING (owner_id = auth.uid()) 
  WITH CHECK (owner_id = auth.uid());

-- Only pet owner can delete their pet record
CREATE POLICY "owner deletes own pets" 
  ON public.pets FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
```

### 2.3 Veterinarian Profiles & Hours (`public.vet_profiles`, `public.vet_availability`)
```sql
ALTER TABLE public.vet_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_availability ENABLE ROW LEVEL SECURITY;

-- 1. Public can search and view all doctor profiles and bookable hours
CREATE POLICY "vets are public" ON public.vet_profiles FOR SELECT USING (true);
CREATE POLICY "vet_availability_select_all" ON public.vet_availability FOR SELECT USING (true);

-- 2. Vet applicants can only register with verified = false (unless admin)
CREATE POLICY "vet creates own profile" ON public.vet_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (verified IS FALSE OR public.has_role(auth.uid(), 'admin'::public.app_role))
  );

-- 3. Doctors can update their own clinical and practice details
CREATE POLICY "vet updates own profile" 
  ON public.vet_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 4. Administrators can update any doctor profile (e.g. approve verification)
CREATE POLICY "admins update vet profiles"
  ON public.vet_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 5. Availability window management
CREATE POLICY "vet_availability_manage_own" 
  ON public.vet_availability FOR ALL USING (
    EXISTS (SELECT 1 FROM public.vet_profiles v WHERE v.id = vet_id AND v.user_id = auth.uid())
  );

-- 6. Trigger Guard: prevents non-admins from self-verifying or modifying verified status
CREATE OR REPLACE FUNCTION public.enforce_vet_verification_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.verified IS TRUE AND NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR current_user = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Veterinarian profiles cannot be self-verified upon registration.';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.verified IS DISTINCT FROM OLD.verified AND NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role) OR current_user = 'service_role'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can modify veterinarian verification status.';
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Secure Administrator Approval RPC
CREATE OR REPLACE FUNCTION public.approve_vet(target_vet_id uuid, approve_status boolean default true)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  updated_row public.vet_profiles%rowtype;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::public.app_role) OR current_user = 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can approve or verify veterinarians.';
  END IF;

  UPDATE public.vet_profiles SET verified = approve_status WHERE id = target_vet_id RETURNING * INTO updated_row;
  RETURN to_jsonb(updated_row);
END;
$$;

-- 8. Secure Server-Side Schedule RPC (FR-VET-002)
-- Evaluates recurring vet_availability minus all scheduled appointments across all users
-- in the veterinarian's authoritative timezone without leaking patient PII or confidential notes.
CREATE OR REPLACE FUNCTION public.get_vet_schedule(target_vet_id uuid, days_ahead int default 14)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
-- (See supabase/migrations/20260925120000_vet_schedule_rpc.sql for complete implementation)
$$;
GRANT EXECUTE ON FUNCTION public.get_vet_schedule(uuid, int) TO anon, authenticated, service_role;
```

### 2.4 Appointments (`public.appointments`)
```sql
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Helper SQL Function: check if user is a valid appointment participant
CREATE OR REPLACE FUNCTION public.is_appointment_participant(_appointment_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.appointments a
    LEFT JOIN public.vet_profiles v ON v.id = a.vet_id
    WHERE a.id = _appointment_id
      AND (a.pet_parent_id = _user_id OR v.user_id = _user_id)
  );
$$;

-- Only direct participants can view the appointment details
CREATE POLICY "appointments_select_participants" 
  ON public.appointments FOR SELECT USING (
    public.is_appointment_participant(id, auth.uid()) OR public.has_role(auth.uid(), 'admin')
  );

-- Pet parent can book appointment for themselves
CREATE POLICY "appointments_insert_parent" 
  ON public.appointments FOR INSERT WITH CHECK (pet_parent_id = auth.uid());

-- Participants can update appointment (cancel, complete, update clinical notes)
CREATE POLICY "appointments_update_participants" 
  ON public.appointments FOR UPDATE USING (
    public.is_appointment_participant(id, auth.uid())
  );
```

#### Atomic Server-Side RPC Functions (Phase 5 / MVP-04)
To eliminate client-side race conditions and guarantee that pet parents only book their own pets:
1. `public.book_appointment(...)`:
   - `SECURITY DEFINER` with immutable `SET search_path = public, auth`.
   - Enforces `auth.uid() IS NOT NULL` (rejects anonymous booking).
   - Enforces pet ownership: `SELECT id FROM public.pets WHERE id = p_pet_id AND owner_id = auth.uid()`.
   - Validates veterinarian status (`accepting = true`) and 15-minute advance buffer.
   - Relies on unique partial index `appointments_vet_scheduled_slot_idx` to guarantee atomic conflict handling (raises error code `23505`).
2. `public.cancel_appointment(...)`:
   - `SECURITY DEFINER` with immutable `SET search_path = public, auth`.
   - Verifies caller is a participant (`pet_parent_id = auth.uid()` or assigned doctor).
   - Sets status to `'cancelled'`, freeing the partial index slot for re-booking.
   - Detects late cancellation (< 2 hours).
3. `public.complete_appointment(...)` (Phase 6 / MVP-05):
   - `SECURITY DEFINER` with immutable `SET search_path = public`.
   - Enforces `auth.uid() IS NOT NULL` (Error: `28000`).
   - Verifies appointment exists (Error: `P0002`).
   - Verifies appointment status is currently `'scheduled'` (Error: `P0001`).
   - Verifies caller is strictly the assigned veterinarian: `v_vet.user_id = auth.uid()` (Error: `42501`). Pet parents cannot mark appointments as completed.
   - Atomically updates appointment status to `'completed'` and `updated_at = now()`.
   - Disallows re-completion of already completed or cancelled consultations.

### 2.5 Telemedicine Media & Signaling Infrastructure (LiveKit Cloud Managed SFU)

> [!IMPORTANT]
> **SUPERSEDED ARCHITECTURE:** The legacy `call_signals` table and custom WebRTC SDP/ICE signaling have been completely removed and superseded. LiveKit Cloud Managed SFU handles all RTC signaling and media transport.

* **No Database Signaling Table:** No `call_signals` or SDP/ICE exchange table exists in the database.
* **Token Authorization:** Authenticated users request short-lived LiveKit JWTs via backend API `POST /api/v1/telemedicine/token`.
* **Zero Media Storage in Database:** Audio/video streams flow exclusively through encrypted LiveKit SFU channels and are never stored in PostgreSQL.

### 2.6 Digital Prescriptions (`public.prescriptions`, `public.prescription_items`) `[IMPLEMENTED MVP-06]`
```sql
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

-- 1. Pet parent of the prescribed pet, the authoring vet, and admins can view prescriptions
CREATE POLICY "prescriptions_select_authorized" 
  ON public.prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.vet_profiles v WHERE v.id = vet_id AND v.user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 2. Line items can only be read by actors authorized to view the parent prescription
CREATE POLICY "prescription_items_select" 
  ON public.prescription_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      WHERE p.id = prescription_id AND (
        EXISTS (SELECT 1 FROM public.pets pet WHERE pet.id = p.pet_id AND pet.owner_id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.vet_profiles v WHERE v.id = p.vet_id AND v.user_id = auth.uid()) OR
        public.has_role(auth.uid(), 'admin'::public.app_role)
      )
    )
  );

-- 3. Immutability guarantee: NO direct INSERT/UPDATE/DELETE granted to clients.
-- All prescription creation must execute through the transactional SECURITY DEFINER RPC.
```

#### Security Definer RPC: `public.create_prescription`
```sql
CREATE OR REPLACE FUNCTION public.create_prescription(
  p_appointment_id UUID,
  p_diagnosis TEXT,
  p_notes TEXT DEFAULT NULL,
  p_refills_allowed INT DEFAULT 0,
  p_items JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```

* **Security Boundary Guarantees:**
  1. **Authentication Enforcement:** Ensures `auth.uid() IS NOT NULL` (Error: `28000`).
  2. **Role Verification:** Queries `public.vet_profiles` where `user_id = auth.uid()`. Throws `42501` if caller is not a registered doctor.
  3. **Appointment Existence & Status Precondition:** Queries `public.appointments` for `p_appointment_id`. If missing, throws `P0002`. If `status != 'completed'`, throws `22023` (prescriptions can only be issued for completed visits).
  4. **Doctor Assignment Verification:** Strictly asserts `appointment.vet_id = v_vet_id`. Throws `42501` if doctor attempts to prescribe for another vet's patient.
  5. **Client Tamper Proofing:** The client does **NOT** provide `vet_id` or `pet_id`. They are resolved server-side from verified database records.
  6. **Single-Prescription Policy:** The unique constraint `UNIQUE (appointment_id)` prevents accidental or malicious double-prescriptions (Error: `23505`).
  7. **Transactional Atomicity:** If any medication item fails validation or insertion, the entire transaction rolls back cleanly. No partial or corrupt prescriptions can exist.

### 2.7 Storage Buckets (`storage.objects`)
```sql
-- Public user media (avatars, pet photos)
CREATE POLICY "storage_user_media_public_read" 
  ON storage.objects FOR SELECT USING (bucket_id = 'user-media');

CREATE POLICY "storage_user_media_owner_upload" 
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Private verification documents (vet licenses, medical reports)
CREATE POLICY "storage_docs_owner_admin_read" 
  ON storage.objects FOR SELECT USING (
    bucket_id = 'verification-docs' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')
    )
  );

CREATE POLICY "storage_docs_owner_upload" 
  ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

---

## 3. Backend & Client Security Controls

1. **Client Token Isolation:** Mobile app stores JWT tokens in hardware-backed secure enclaves (`expo-secure-store`). Standard file system or `AsyncStorage` usage is forbidden.
2. **Backend Authentication Verification:** Express API verifies RS256 / HS256 signature on every inbound request and injects `req.user = { id, role }` into execution context.
3. **Database Security Invariant:** Even if a malicious actor accesses the Supabase REST/WebSocket API directly with a stolen anon key, Row Level Security policies prevent unauthorized access to other users' appointments, pets, or prescriptions.
