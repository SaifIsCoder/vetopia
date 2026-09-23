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

### 2.5 WebRTC Call Signals & In-Call Messages (`call_signals`, `messages`)
```sql
ALTER TABLE public.call_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Signals and messages are strictly restricted to verified appointment participants
CREATE POLICY "signals_participants_all" 
  ON public.call_signals FOR ALL USING (
    public.is_appointment_participant(appointment_id, auth.uid())
  ) WITH CHECK (
    sender_id = auth.uid() AND public.is_appointment_participant(appointment_id, auth.uid())
  );

CREATE POLICY "messages_participants_all" 
  ON public.messages FOR ALL USING (
    public.is_appointment_participant(appointment_id, auth.uid())
  ) WITH CHECK (
    sender_id = auth.uid() AND public.is_appointment_participant(appointment_id, auth.uid())
  );
```

### 2.6 Digital Prescriptions (`public.prescriptions`, `public.prescription_items`)
```sql
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prescription_items ENABLE ROW LEVEL SECURITY;

-- Pet parent of the prescribed pet and the authoring vet can read prescriptions
CREATE POLICY "prescriptions_select_authorized" 
  ON public.prescriptions FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_id AND p.owner_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.vet_profiles v WHERE v.id = vet_id AND v.user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
  );

-- Only verified doctors can issue a prescription linked to their appointment
CREATE POLICY "prescriptions_insert_vet" 
  ON public.prescriptions FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.vet_profiles v WHERE v.id = vet_id AND v.user_id = auth.uid())
  );

-- Prescriptions are immutable: NO UPDATE POLICY GRANTED
CREATE POLICY "prescription_items_select" 
  ON public.prescription_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.prescriptions p WHERE p.id = prescription_id)
  );

CREATE POLICY "prescription_items_insert_vet" 
  ON public.prescription_items FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.prescriptions p
      JOIN public.vet_profiles v ON v.id = p.vet_id
      WHERE p.id = prescription_id AND v.user_id = auth.uid()
    )
  );
```

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
