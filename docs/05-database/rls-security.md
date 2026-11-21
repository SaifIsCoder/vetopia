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

The private table is readable by the profile owner and authenticated administrators. Owners can insert and update their own profiles. Anonymous and authenticated directory readers use `public.profile_directory`, which exposes only `id`, `full_name`, and `avatar_url`. The view grants read access only. Cross-user messaging lookups use this projection.

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

### 2.3 Veterinarian profiles, license requests, and hours

The public vet directory and its schedule show approved vets. Vet owners and administrators can also read pending profiles. The dashboard submits credentials through `request_vet_license_review(p_license_number)`. Each credential is private to the applicant and administrators, and cannot be replaced while its review is pending. Direct client writes cannot change `verified`. A signed-in administrator must call `approve_vet(target_vet_id, approve_status)` after checking a trusted licensing registry. This records the reviewer and decision and prevents self-approval.

### 2.4 Appointments (`public.appointments`)

Participants retain read access. Client roles cannot directly insert, update, or delete appointments. Use `book_appointment`, `cancel_appointment`, and `complete_appointment`. Booking requires ownership of the selected pet and an approved, accepting vet. Booking and discovery share the same published local slot grid. Slots must start at least 15 minutes ahead and fall within the vet's 30-day calendar. Duration and price come from the vet profile. A GiST exclusion constraint prevents conflicting scheduled intervals for the same vet, including simultaneous requests with different start times. Cancellation and completion lock the appointment before changing its status. Only the assigned approved vet can complete it.

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

### 2.8 Clinical Messaging (`public.conversations`, `public.conversation_participants`, `public.direct_messages`) `[IMPLEMENTED MVP-07]`

```sql
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Helper SQL Function: check if user is a member of the conversation
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  );
$$;

-- 1. Conversations: Only members or administrators can view conversations
CREATE POLICY "conversations_select_participant" 
  ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "conversations_insert_authenticated" 
  ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "conversations_update_participant" 
  ON public.conversations FOR UPDATE TO authenticated
  USING (public.is_conversation_member(id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. Participants: Only conversation members can view participants list
CREATE POLICY "conversation_participants_select" 
  ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "conversation_participants_insert" 
  ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Direct Messages: Read restricted to verified conversation members
CREATE POLICY "direct_messages_select" 
  ON public.direct_messages FOR SELECT TO authenticated
  USING (public.is_conversation_member(conversation_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- Insertion requires caller to be a participant AND sender_id must strictly match auth.uid()
CREATE POLICY "direct_messages_insert" 
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    public.is_conversation_member(conversation_id, auth.uid())
  );

-- Updating message status restricted to original sender or admin
CREATE POLICY "direct_messages_update" 
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role));
```

#### Security Definer Messaging RPC Functions (MVP-07)
To prevent client-side sender spoofing, preserve appointment-level participant integrity, and ensure atomic conversation timestamp synchronization:
1. `public.get_or_create_appointment_conversation(p_appointment_id uuid)`:
   - `SECURITY DEFINER` with `SET search_path = public, pg_temp`.
   - Requires `auth.uid() IS NOT NULL` (Error: `28000`).
   - Validates appointment exists and resolves `pet_parent_id` and assigned `vet_user_id` (Error: `P0002`).
   - Asserts caller is strictly the appointment's pet parent or assigned veterinarian (Error: `42501`).
   - Idempotently retrieves existing conversation via unique index on `appointment_id` or creates conversation and inserts both participants in a single transaction.
2. `public.send_direct_message(p_conversation_id uuid, p_body text)`:
   - `SECURITY DEFINER` with `SET search_path = public, pg_temp`.
   - Derives sender strictly from `auth.uid()` (eliminates client spoofing).
   - Validates message body length (`1 <= length(trim(p_body)) <= 4000`) (Error: `22023`).
   - Verifies caller membership in conversation (Error: `42501`).
   - Inserts message into `public.direct_messages` and atomically updates `conversations.last_message_at = now()`.
   - Updates `last_read_at = now()` for sender in `conversation_participants`.
3. `public.mark_conversation_read(p_conversation_id uuid)`:
   - Updates `last_read_at = now()` in `conversation_participants` for `auth.uid()`.
4. `public.get_user_conversations()` & `public.get_unread_message_count()`:
   - Aggregates conversations and calculates unread counts strictly for `auth.uid()` against messages where `sender_id != auth.uid()` and `created_at > participant.last_read_at`.

### 2.9 Notifications & Device Tokens (`public.notifications`, `public.device_tokens`) `[IMPLEMENTED MVP-08]`

```sql
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_reminders ENABLE ROW LEVEL SECURITY;

-- 1. Device Tokens: Authenticated users manage only their own tokens
CREATE POLICY "device_tokens_select_own" 
  ON public.device_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "device_tokens_insert_own" 
  ON public.device_tokens FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "device_tokens_update_own" 
  ON public.device_tokens FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "device_tokens_delete_own" 
  ON public.device_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 2. Notifications: Users can only read and mark their own notifications
CREATE POLICY "notifications_select_own" 
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" 
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Deny direct client INSERT/DELETE: Creation is strictly server-authoritative
REVOKE INSERT, DELETE ON public.notifications FROM authenticated, anon;
REVOKE ALL ON public.appointment_reminders FROM anon, authenticated;
```

#### Security Definer Notification RPC Functions (MVP-08)
To prevent cross-user token tampering, ensure server-authoritative recipient determination, and guarantee notification delivery invariants:
1. `public.register_device_token(p_token text, p_platform text)`:
   - `SECURITY DEFINER` with `SET search_path = public, pg_temp`.
   - Requires `auth.uid() IS NOT NULL` (Error: `28000`).
   - Validates non-empty token and supported platform.
   - Atomically upserts `public.device_tokens` for `auth.uid()` on `(user_id, token)`.
2. `public.deactivate_device_token(p_token text)`:
   - Sets `is_active = FALSE` strictly where `user_id = auth.uid() AND token = p_token`.
3. `public.mark_notification_read(p_notification_id uuid)` & `public.mark_all_notifications_read()`:
   - Updates `read = TRUE, read_at = now()` strictly for rows where `user_id = auth.uid()`.
4. `public.notify_doctor_entered_consultation(p_appointment_id uuid)`:
   - Asserts caller is strictly the assigned consulting veterinarian (`v_vet.user_id = auth.uid()`, Error: `42501`).
   - Resolves the pet parent ID server-side and inserts the notification.
5. `public.process_appointment_reminders()`:
   - Internal `SECURITY DEFINER` function scanning scheduled visits in `[NOW(), NOW() + 16m]`.
   - Idempotently logs sent reminders in `public.appointment_reminders(appointment_id, '15m')` preventing duplicate alerts.

---

## 3. Backend & Client Security Controls

1. **Client Token Isolation:** Mobile app stores JWT tokens in hardware-backed secure enclaves (`expo-secure-store`). Standard file system or `AsyncStorage` usage is forbidden.
2. **Backend Authentication Verification:** Express API verifies RS256 / HS256 signature on every inbound request and injects `req.user = { id, role }` into execution context.
3. **Database Security Invariant:** Even if a malicious actor accesses the Supabase REST/WebSocket API directly with a stolen anon key, Row Level Security policies prevent unauthorized access to other users' appointments, pets, or prescriptions.

## Phase 1 rollout and validation

- Apply the ordered migrations in an isolated staging database first. The compatibility bridge `20260926190000_prepare_notification_message_rpc.sql` precedes the historical notification migration and only drops the legacy JSONB version of the message RPC. When deploying to a database that has already recorded the later version, verify the complete migration history and use Supabase's include-all migration option for the out-of-order bridge. The historical migration files remain the deployment history and `complete_schema.sql` is an ordered snapshot for inspection or clean installs.
- Check existing scheduled visits for invalid or overlapping intervals before migration. Resolve conflicts explicitly with the practice and affected owners. The migration rejects conflicting data and does not cancel or change appointments.
- All legacy approval flags are cleared because the old schema cannot distinguish independent checks from self-verification. Coordinate reapproval before reopening booking. Provision the first reviewer through trusted database administration by assigning the `admin` role to a known Auth user in `user_roles`. Using that administrator's authenticated session, read pending rows in `vet_license_requests`, validate credentials against the relevant authority, and call `approve_vet` with the decision. Advise approved vets to refresh the dashboard. Publish confirmed recurring hours in `vet_availability` for vets who have no existing hours.
- Configure `EXPO_PUBLIC_SUPABASE_URL` with the relevant Supabase project and set `SUPABASE_SERVICE_ROLE_KEY` only in the Express backend. Set a random `NOTIFICATION_WORKER_SECRET` in the backend and trusted scheduler. In production, configure the scheduler to POST to `/api/v1/notifications/reminders/run` and then `/api/v1/notifications/dispatch-pending` with the worker secret as a bearer token. The reminder endpoint returns only a count. The worker leases dispatch rows and retries failures after the lease expires. Expo delivery is at least once and a partially successful batch may retry accepted tokens.
- Run `bash tests/database/run-phase1.sh` with Docker. It applies the migration chain on network-isolated PostgreSQL, exercises the Supabase roles and SQL contracts with test fixtures, and races two real booking transactions.
