# Database Design & Schema Specification — Vetopia Mobile MVP

This document specifies the PostgreSQL relational database schema for the **Vetopia Mobile MVP**, explicitly identifying which tables exist in the current Supabase migrations versus those required or proposed for the mobile application.

---

## 1. Schema Status Summary

| Table Name | Status in Repository | Purpose in Mobile MVP |
| :--- | :--- | :--- |
| `public.profiles` | `[EXISTING]` | User identity, username, full name, avatar, bio, location |
| `public.user_roles` | `[EXISTING]` | RBAC role binding (`pet_parent`, `vet`, `admin`) |
| `public.vet_profiles` | `[EXISTING]` | Doctor specialties, license verification, pricing, rating |
| `public.vet_availability` | `[EXISTING]` | Weekly recurring consulting windows (weekday 0–6, minutes) |
| `public.pets` | `[EXISTING]` | Household registered pets (species, breed, age, weight, bio) |
| `public.appointments` | `[EXISTING]` | Central consultation booking transactions |
| `public.messages` | `[EXISTING]` | Chat messages exchanged during live consultation room |
| `public.call_signals` | `[EXISTING]` | Ephemeral WebRTC signaling (offer, answer, ICE, hangup) |
| `public.conversations` | `[EXISTING + IMPLEMENTED MVP-07]` | Asynchronous 1-to-1 clinical messaging channels |
| `public.conversation_participants`| `[EXISTING + IMPLEMENTED MVP-07]` | Membership bridge for 1-to-1 conversation threads |
| `public.direct_messages` | `[EXISTING + IMPLEMENTED MVP-07]` | Asynchronous text messages in clinical conversation channels |
| `public.prescriptions` | `[EXISTING + IMPLEMENTED MVP-06]` | Digital prescriptions issued by vets upon consult completion |
| `public.prescription_items`| `[EXISTING + IMPLEMENTED MVP-06]` | Specific medications, dosages, and schedules on a prescription |
| `public.notifications` | `[APPROVED FOR MVP]` | In-app user notifications inbox (read/unread) |
| `public.device_tokens` | `[APPROVED FOR MVP]` | APNs and FCM push notification device registration |

---

## 2. Table Specifications

### 2.1 `public.profiles` `[EXISTING]`
* **Columns:**
  * `id` (`UUID`, Primary Key, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `full_name` (`TEXT`, Nullable)
  * `username` (`TEXT`, Unique, Nullable) — Regex: `^[a-z0-9_.]{3,24}$`
  * `phone` (`TEXT`, Nullable)
  * `avatar_url` (`TEXT`, Nullable)
  * `cover_url` (`TEXT`, Nullable)
  * `bio` (`TEXT`, Nullable)
  * `location` (`TEXT`, Nullable)
  * `website` (`TEXT`, Nullable)
  * `onboarded` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
  * `updated_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)

---

### 2.2 `public.user_roles` `[EXISTING]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `user_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `role` (`public.app_role`, NOT NULL, Values: `'pet_parent'`, `'vet'`, `'admin'`, `'shelter'`, `'seller'`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints:** `UNIQUE (user_id, role)`

---

### 2.3 `public.vet_profiles` `[EXISTING]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `user_id` (`UUID`, Unique, Nullable, `REFERENCES auth.users(id) ON DELETE SET NULL`)
  * `name` (`TEXT`, NOT NULL)
  * `specialty` (`TEXT`, NOT NULL, Default: `'General Veterinary Medicine'`)
  * `country` (`TEXT`, NOT NULL, Default: `''`)
  * `flag` (`TEXT`, NOT NULL, Default: `''`)
  * `languages` (`TEXT[]`, NOT NULL, Default: `'{English}'`)
  * `price_usd` (`NUMERIC(10,2)`, NOT NULL, Default: `29.00`)
  * `slot_minutes` (`INT`, NOT NULL, Default: `30`)
  * `rating` (`NUMERIC(2,1)`, NOT NULL, Default: `5.0`)
  * `reviews` (`INT`, NOT NULL, Default: `0`)
  * `bio` (`TEXT`, Nullable)
  * `img_key` (`TEXT`, Nullable)
  * `timezone` (`TEXT`, NOT NULL, Default: `'UTC'`)
  * `verified` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
  * `accepting` (`BOOLEAN`, NOT NULL, Default: `TRUE`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)

---

### 2.4 `public.vet_availability` `[EXISTING]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `vet_id` (`UUID`, NOT NULL, `REFERENCES public.vet_profiles(id) ON DELETE CASCADE`)
  * `weekday` (`INT`, NOT NULL, `CHECK (weekday BETWEEN 0 AND 6)`) — 0=Sun, 6=Sat
  * `start_minute` (`INT`, NOT NULL, `CHECK (start_minute BETWEEN 0 AND 1440)`) — e.g. 540 = 09:00
  * `end_minute` (`INT`, NOT NULL, `CHECK (end_minute BETWEEN 0 AND 1440)`) — e.g. 1020 = 17:00
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints:** `CHECK (end_minute > start_minute)`

---

### 2.5 `public.pets` `[EXISTING]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `owner_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `name` (`TEXT`, NOT NULL)
  * `species` (`TEXT`, NOT NULL, Default: `'Dog'`)
  * `breed` (`TEXT`, Nullable)
  * `age` (`TEXT`, Nullable)
  * `sex` (`TEXT`, Nullable)
  * `color` (`TEXT`, Nullable)
  * `weight_kg` (`NUMERIC`, Nullable)
  * `bio` (`TEXT`, Nullable)
  * `photo_url` (`TEXT`, Nullable)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
  * `updated_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Indexes:** `CREATE INDEX IF NOT EXISTS pets_owner_idx ON public.pets(owner_id);`

---

### 2.6 `public.appointments` `[EXISTING + IMPLEMENTED MVP-04]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `vet_id` (`UUID`, NOT NULL, `REFERENCES public.vet_profiles(id) ON DELETE CASCADE`)
  * `pet_parent_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `pet_id` (`UUID`, Nullable, `REFERENCES public.pets(id) ON DELETE SET NULL`)
  * `starts_at` (`TIMESTAMPTZ`, NOT NULL)
  * `ends_at` (`TIMESTAMPTZ`, NOT NULL)
  * `mode` (`TEXT`, NOT NULL, Default: `'video'`, `CHECK (mode IN ('chat','audio','video'))`)
  * `status` (`TEXT`, NOT NULL, Default: `'scheduled'`, `CHECK (status IN ('scheduled','completed','cancelled'))`)
  * `pet_name` (`TEXT`, Nullable) — Denormalized snapshot for consultation continuity
  * `species` (`TEXT`, Nullable) — Denormalized snapshot
  * `breed` (`TEXT`, Nullable)
  * `pet_age` (`TEXT`, Nullable)
  * `symptoms` (`TEXT`, Nullable)
  * `urgency` (`TEXT`, Nullable, `CHECK (urgency IN ('Low','Medium','High'))`)
  * `medications` (`TEXT`, Nullable)
  * `contact_phone` (`TEXT`, Nullable)
  * `price_usd` (`NUMERIC(10,2)`, NOT NULL, Default: `0.00`) — Consultation fee record; MVP booking is not gated by upfront payment
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
  * `updated_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints & Indexes:**
  * `appointments_vet_scheduled_slot_idx` (`UNIQUE INDEX ON public.appointments (vet_id, starts_at) WHERE status = 'scheduled'`) — Guarantees atomic race-condition protection against double-booking active slots, while allowing cancelled slots to be freed and re-booked.
* **Server-Side Security RPCs:**
  * `public.book_appointment(...)`: Atomic reservation function (`SECURITY DEFINER`, search_path set). Verifies authenticated user, enforces pet ownership (`pets.owner_id = auth.uid()`), checks vet acceptance and 15-minute advance buffer, creates appointment record with status `'scheduled'`, and raises 23505 conflict on race condition.
  * `public.cancel_appointment(...)`: Secure cancellation function (`SECURITY DEFINER`). Verifies participant identity (`pet_parent_id = auth.uid()` or vet owner), sets status to `'cancelled'`, frees the slot index, and flags late cancellation (< 2 hours).


---

### 2.7 `public.call_signals` `[EXISTING]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `appointment_id` (`UUID`, NOT NULL, `REFERENCES public.appointments(id) ON DELETE CASCADE`)
  * `sender_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `kind` (`TEXT`, NOT NULL, `CHECK (kind IN ('offer','answer','ice','hangup','ring'))`)
  * `payload` (`JSONB`, NOT NULL, Default: `'{}'::jsonb`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Indexes:** `CREATE INDEX call_signals_appointment_idx ON public.call_signals (appointment_id, created_at);`

---

### 2.8 `public.prescriptions` `[EXISTING + IMPLEMENTED MVP-06]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `appointment_id` (`UUID`, NOT NULL, Unique, `REFERENCES public.appointments(id) ON DELETE CASCADE`)
  * `vet_id` (`UUID`, NOT NULL, `REFERENCES public.vet_profiles(id) ON DELETE CASCADE`)
  * `pet_id` (`UUID`, NOT NULL, `REFERENCES public.pets(id) ON DELETE CASCADE`)
  * `diagnosis` (`TEXT`, NOT NULL)
  * `notes` (`TEXT`, Nullable)
  * `refills_allowed` (`INT`, NOT NULL, Default: `0`, `CHECK (refills_allowed >= 0)`)
  * `status` (`TEXT`, NOT NULL, Default: `'active'`, `CHECK (status IN ('active', 'completed', 'cancelled'))`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
  * `updated_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints & Indexes:**
  * `prescriptions_appointment_id_key` (`UNIQUE (appointment_id)`) — Enforces the single-prescription-per-completed-consultation policy at the database level.
  * `idx_prescriptions_pet` (`INDEX ON public.prescriptions(pet_id)`) — Optimized for Pet Passport clinical history retrieval.
  * `idx_prescriptions_vet` (`INDEX ON public.prescriptions(vet_id)`) — Optimized for veterinarian records.
* **Server-Side Security RPC:**
  * `public.create_prescription(p_appointment_id UUID, p_diagnosis TEXT, p_notes TEXT, p_refills_allowed INT, p_items JSONB)`:
    Atomic transaction (`SECURITY DEFINER`, search_path set). Verifies caller authentication, verifies caller is registered veterinarian (`vet_profiles.user_id = auth.uid()`), verifies appointment exists, has status `'completed'`, and belongs to the consulting veterinarian (`appointment.vet_id = v_vet_id`). Resolves pet identity from the appointment record (client cannot spoof pet), inserts prescription and all line items atomically, and returns a JSON payload with `prescription_id` and `item_count`.

### 2.9 `public.prescription_items` `[EXISTING + IMPLEMENTED MVP-06]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `prescription_id` (`UUID`, NOT NULL, `REFERENCES public.prescriptions(id) ON DELETE CASCADE`)
  * `medication_name` (`TEXT`, NOT NULL)
  * `dosage` (`TEXT`, NOT NULL) — e.g. "250mg", "1 tablet"
  * `frequency` (`TEXT`, NOT NULL) — e.g. "Twice daily with meals"
  * `duration` (`TEXT`, NOT NULL) — e.g. "14 days", "1 month"
  * `special_instructions` (`TEXT`, Nullable) — e.g. "Keep refrigerated, administer with food"
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Indexes:** `CREATE INDEX idx_prescription_items_prescription ON public.prescription_items(prescription_id);`

---

### 2.10 `public.conversations` `[EXISTING + IMPLEMENTED MVP-07]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `kind` (`public.conversation_kind`, NOT NULL, Default: `'general'`)
  * `subject` (`TEXT`, NOT NULL)
  * `appointment_id` (`UUID`, Nullable, `REFERENCES public.appointments(id) ON DELETE SET NULL`)
  * `open_to_join` (`BOOLEAN`, NOT NULL, Default: `FALSE`) — Strictly locked down for clinical channels
  * `created_by` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
  * `last_message_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints & Indexes:**
  * `idx_conversations_appointment` (`UNIQUE INDEX ON public.conversations (appointment_id) WHERE appointment_id IS NOT NULL`) — Guarantees exactly one 1-to-1 conversation per clinical consultation.
* **Server-Side Security RPCs:**
  * `public.get_or_create_appointment_conversation(p_appointment_id UUID)`: Atomic creation function (`SECURITY DEFINER`, search_path set). Verifies caller authentication and appointment participant authorization (`pet_parent_id = auth.uid()` or assigned vet), retrieves or atomically creates the conversation record with `open_to_join = false`, adds both participants, and returns metadata.
  * `public.get_user_conversations()`: Retrieves all conversations for the authenticated user with counterpart profiles, unread message count, latest message snippet, and appointment context.
  * `public.get_unread_message_count()`: Returns total unread messages count for current user across all conversations for tab badge synchronization.

### 2.11 `public.conversation_participants` `[EXISTING + IMPLEMENTED MVP-07]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `conversation_id` (`UUID`, NOT NULL, `REFERENCES public.conversations(id) ON DELETE CASCADE`)
  * `user_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `side` (`public.participant_side`, NOT NULL, Default: `'member'`) — `'member'` for pet parents, `'vet'` for doctors
  * `last_read_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`) — Boundary marker for calculating unread messages
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints & Indexes:**
  * `UNIQUE (conversation_id, user_id)` — Guarantees single participation per channel.
  * `idx_conversation_participants_lookup` (`INDEX ON public.conversation_participants(conversation_id, user_id)`)
  * `idx_conversation_participants_user_read` (`INDEX ON public.conversation_participants(user_id, last_read_at)`)
* **Server-Side Security RPC:**
  * `public.mark_conversation_read(p_conversation_id UUID)`: Advances authenticated caller's `last_read_at` timestamp to `now()`.

### 2.12 `public.direct_messages` `[EXISTING + IMPLEMENTED MVP-07]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `conversation_id` (`UUID`, NOT NULL, `REFERENCES public.conversations(id) ON DELETE CASCADE`)
  * `sender_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `body` (`TEXT`, NOT NULL, `CHECK (char_length(body) BETWEEN 1 AND 4000)`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints & Indexes:**
  * `idx_direct_messages_conv_created` (`INDEX ON public.direct_messages(conversation_id, created_at ASC)`) — Optimized for chronological thread retrieval.
* **Server-Side Security RPC & Triggers:**
  * `public.send_direct_message(p_conversation_id UUID, p_body TEXT)`: Atomic message dispatch function (`SECURITY DEFINER`, search_path set). Strictly checks caller membership (`is_conversation_member`), validates non-empty whitespace and 1..4000 character limit, inserts message, and advances sender's `last_read_at`.
  * `direct_messages_touch AFTER INSERT`: Database trigger executing `public.touch_conversation()` to automatically update `conversations.last_message_at = now()`.

---

### 2.13 `public.notifications` `[REQUIRED FOR MVP]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `user_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `title` (`TEXT`, NOT NULL)
  * `body` (`TEXT`, NOT NULL)
  * `kind` (`TEXT`, NOT NULL) — e.g. `'appointment_reminder'`, `'call_ready'`, `'prescription_issued'`, `'new_message'`
  * `data` (`JSONB`, NOT NULL, Default: `'{}'::jsonb`) — Contains deep link payload
  * `read` (`BOOLEAN`, NOT NULL, Default: `FALSE`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Indexes:** `CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read);`

### 2.11 `public.device_tokens` `[REQUIRED FOR MVP]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `user_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `token` (`TEXT`, NOT NULL) — Expo Push Token (`ExponentPushToken[...]`)
  * `platform` (`TEXT`, NOT NULL, `CHECK (platform IN ('ios', 'android'))`)
  * `updated_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints:** `UNIQUE (user_id, token)`
