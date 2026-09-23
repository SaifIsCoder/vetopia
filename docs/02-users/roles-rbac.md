# Roles & Role-Based Access Control (RBAC) — Vetopia Mobile MVP

## 1. User Roles Overview

The Vetopia platform defines roles in the `public.app_role` PostgreSQL enum:
```sql
CREATE TYPE public.app_role AS ENUM ('pet_parent', 'vet', 'admin', 'shelter', 'seller');
```

For the **Mobile MVP**, only two roles are active within the mobile application:
1. **`pet_parent` (Pet Parent):** The consumer role. Pet parents register their household pets, search for licensed veterinarians, book appointments, attend video consultations, receive digital prescriptions, and message their consulting doctors.
2. **`vet` (Licensed Veterinarian):** The provider role. Doctors manage their weekly availability windows, accept consultations, conduct live video/audio examinations, write digital prescriptions, and message their assigned patients.
3. **`admin` (System Administrator):** Primarily operational via the web interface. Mobile backend APIs enforce administrative checks for vet credential approval and audit monitoring.
4. **`shelter` & `seller`:** Inactive in the Mobile MVP (reserved for Phase 2 & Phase 3).

---

## 2. Granular Permissions Matrix

| Functional Domain | Resource / Action | `pet_parent` | `vet` | `admin` | Unauthenticated |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Authentication** | Sign In / Sign Up | Full Access | Full Access | Full Access | Full Access |
| | Biometric Session Unlock | Own Device | Own Device | Own Device | Denied |
| **Pet Passport** | Create Pet Profile | Own Pets | Denied | Full Access | Denied |
| | View Pet Health Passport | Own Pets | Assigned Patients | Full Access | Denied |
| | Update / Archive Pet | Own Pets | Denied | Full Access | Denied |
| **Vet Discovery** | Search & View Vet Directory | Full Access | Full Access | Full Access | Read-Only |
| | View Doctor Profile & Slots | Full Access | Full Access | Full Access | Read-Only |
| | Edit Doctor Profile & Price | Denied | Own Profile | Full Access | Denied |
| | Manage Availability Windows | Denied | Own Schedule | Full Access | Denied |
| **Appointments** | Book Consultation Slot | Full Access | Denied | Full Access | Denied |
| | View Upcoming / Past Appts | Own Bookings | Assigned Appts | Full Access | Denied |
| | Cancel Appointment | Own Bookings | Assigned Appts | Full Access | Denied |
| **Telemedicine** | Enter Waiting Room | Own Bookings | Assigned Appts | Audit Only | Denied |
| | Join Active Video Call | Participant Only | Participant Only | Denied | Denied |
| | End Consultation | Participant Only | Participant Only | Denied | Denied |
| **Prescriptions** | Issue Digital Prescription | Denied | Assigned Patient | Full Access | Denied |
| | View / Download Prescription | Own Pets Only | Author Vet Only | Full Access | Denied |
| **Messaging** | Send Message in Thread | Participant Only | Participant Only | Denied | Denied |
| | View Conversation List | Participant Only | Participant Only | Full Access | Denied |
| **AI Assistant** | Symptom Triage Chatbot | Full Access | Full Access | Full Access | Rate-Limited |
| **Admin Operations** | Approve Vet License | Denied | Denied | Full Access | Denied |

---

## 3. Data Isolation & Security Rules

### Rule 1: Appointment Participant Isolation
A user can only view or interact with an appointment if:
`auth.uid() = appointments.pet_parent_id OR auth.uid() IN (SELECT user_id FROM vet_profiles WHERE id = appointments.vet_id)`
Any query violating this rule is blocked by Supabase RLS and the Express API authorization middleware.

### Rule 2: Pet Record Privacy
A pet parent can only read or modify pets where `owner_id = auth.uid()`.
A veterinarian is granted temporary read-only access to a pet's health passport *only* if an active or scheduled appointment exists between that veterinarian and the pet parent.

### Rule 3: WebRTC Signal Privacy
Calls signals (`offer`, `answer`, `ice`, `hangup`) inside `public.call_signals` can only be inserted or read by verified appointment participants verified by the SQL function `public.is_appointment_participant(appointment_id, auth.uid())`.

### Rule 4: Prescription Immutability
Once a veterinarian submits a prescription, it is immutable (`UPDATE` operations are forbidden). If a doctor makes an error, they must issue a superseding prescription with an audit reference to the previous prescription ID.

### Rule 5: Veterinarian Verification & Approval Guard
1. **Unverified Default**: A veterinarian applicant may self-register with role `vet`, but their initial `vet_profiles.verified` status is strictly enforced as `false`.
2. **RLS Insert Restriction**: Database Row Level Security on `public.vet_profiles` (`"vet creates own profile"`) rejects any `INSERT` with `verified = true` unless the caller has the `admin` role (`public.has_role(auth.uid(), 'admin')`).
3. **Trigger Immutability**: A PostgreSQL `BEFORE INSERT OR UPDATE` trigger (`vet_verification_guard`) enforces that non-administrators cannot modify `verified`. Any client-side or API attempt to self-verify is rejected at the database engine level.
4. **Authoritative Admin Approval**: Only authenticated administrators can verify a veterinarian, using either the administrative update RLS policy (`"admins update vet profiles"`) or the security definer RPC function `public.approve_vet(target_vet_id uuid, approve_status boolean)`. Normal users, unverified vets, and unauthorized callers are strictly denied.

