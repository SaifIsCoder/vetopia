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
| `public.conversations` | `[EXISTING]` | Asynchronous 1-to-1 P2P messaging channels |
| `public.conversation_participants`| `[EXISTING]` | Membership bridge for 1-to-1 conversation threads |
| `public.direct_messages` | `[EXISTING]` | Asynchronous text messages in clinical conversation channels |
| `public.prescriptions` | `[APPROVED FOR MVP]` | Digital prescriptions issued by vets upon consult completion |
| `public.prescription_items`| `[APPROVED FOR MVP]` | Specific medications, dosages, and schedules on a prescription |
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

### 2.6 `public.appointments` `[EXISTING + APPROVED MVP EXPANSION]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `vet_id` (`UUID`, NOT NULL, `REFERENCES public.vet_profiles(id) ON DELETE CASCADE`)
  * `pet_parent_id` (`UUID`, NOT NULL, `REFERENCES auth.users(id) ON DELETE CASCADE`)
  * `pet_id` (`UUID`, Nullable, `[APPROVED FOR MVP] REFERENCES public.pets(id) ON DELETE SET NULL`)
  * `starts_at` (`TIMESTAMPTZ`, NOT NULL)
  * `ends_at` (`TIMESTAMPTZ`, NOT NULL)
  * `mode` (`TEXT`, NOT NULL, Default: `'video'`, `CHECK (mode IN ('chat','audio','video'))`)
  * `status` (`TEXT`, NOT NULL, Default: `'scheduled'`, `CHECK (status IN ('scheduled','completed','cancelled'))`)
  * `pet_name` (`TEXT`, Nullable) — Preserved for web backwards compatibility
  * `species` (`TEXT`, Nullable) — Preserved for web backwards compatibility
  * `breed` (`TEXT`, Nullable)
  * `pet_age` (`TEXT`, Nullable)
  * `symptoms` (`TEXT`, Nullable)
  * `urgency` (`TEXT`, Nullable)
  * `medications` (`TEXT`, Nullable)
  * `contact_phone` (`TEXT`, Nullable)
  * `price_usd` (`NUMERIC(10,2)`, NOT NULL, Default: `0.00`) — Stored for record-keeping; upfront payment gate deferred to Phase 3
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Constraints:** `UNIQUE (vet_id, starts_at)`


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

### 2.8 `public.prescriptions` `[REQUIRED FOR MVP]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `appointment_id` (`UUID`, NOT NULL, `REFERENCES public.appointments(id) ON DELETE CASCADE`)
  * `vet_id` (`UUID`, NOT NULL, `REFERENCES public.vet_profiles(id) ON DELETE CASCADE`)
  * `pet_id` (`UUID`, NOT NULL, `REFERENCES public.pets(id) ON DELETE CASCADE`)
  * `diagnosis` (`TEXT`, NOT NULL)
  * `notes` (`TEXT`, Nullable)
  * `status` (`TEXT`, NOT NULL, Default: `'active'`, `CHECK (status IN ('active', 'completed', 'cancelled'))`)
  * `created_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
  * `updated_at` (`TIMESTAMPTZ`, NOT NULL, Default: `NOW()`)
* **Indexes:** `CREATE INDEX idx_prescriptions_pet ON public.prescriptions(pet_id);`

### 2.9 `public.prescription_items` `[REQUIRED FOR MVP]`
* **Columns:**
  * `id` (`UUID`, Primary Key, Default: `gen_random_uuid()`)
  * `prescription_id` (`UUID`, NOT NULL, `REFERENCES public.prescriptions(id) ON DELETE CASCADE`)
  * `medication_name` (`TEXT`, NOT NULL)
  * `dosage` (`TEXT`, NOT NULL) — e.g. "25mg"
  * `frequency` (`TEXT`, NOT NULL) — e.g. "Twice daily with food"
  * `duration_days` (`INT`, NOT NULL, Default: `7`)
  * `instructions` (`TEXT`, Nullable)
  * `refills_allowed` (`INT`, NOT NULL, Default: `0`)

---

### 2.10 `public.notifications` `[REQUIRED FOR MVP]`
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
