# API Specification — Vetopia Mobile MVP

This document specifies all REST API endpoints required for the **Vetopia Mobile MVP**. All endpoints are prefixed with `/api/v1`.

---

## 1. Authentication Module (`/auth`)

### `API-AUTH-001`: User Registration
* **Method & Path:** `POST /api/v1/auth/register`
* **Purpose:** Create new user account and assign initial role.
* **Authentication:** None (Public)
* **Request Body:**
  ```json
  {
    "email": "sarah@example.com",
    "password": "StrongPassword123!",
    "full_name": "Sarah Jenkins",
    "role": "pet_parent"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "uuid", "email": "sarah@example.com", "full_name": "Sarah Jenkins", "roles": ["pet_parent"] },
      "tokens": { "accessToken": "jwt_token_string", "refreshToken": "jwt_refresh_string" }
    }
  }
* **Errors:** `400 Bad Request` (Invalid email/password), `409 Conflict` (Email already registered).
* **Database Ops:** Inserts into `auth.users`, `public.profiles`, `public.user_roles`.
* **Related Screen:** `RegisterScreen` (`SCR-AUTH-003`).

---

### `API-AUTH-002`: User Login
* **Method & Path:** `POST /api/v1/auth/login`
* **Purpose:** Authenticate credentials and issue session tokens.
* **Authentication:** None (Public)
* **Request Body:**
  ```json
  {
    "email": "sarah@example.com",
    "password": "StrongPassword123!"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "uuid", "email": "sarah@example.com", "full_name": "Sarah Jenkins", "roles": ["pet_parent"], "avatar_url": null },
      "tokens": { "accessToken": "jwt_token_string", "refreshToken": "jwt_refresh_string" }
    }
  }
  ```
* **Errors:** `401 Unauthorized` (Invalid email or password), `429 Too Many Requests`.
* **Related Screen:** `LoginScreen` (`SCR-AUTH-002`).

---

### `API-AUTH-003`: Refresh Token Rotation
* **Method & Path:** `POST /api/v1/auth/refresh`
* **Purpose:** Rotate expired access token using valid refresh token.
* **Authentication:** Refresh Token in body.
* **Request Body:** `{ "refreshToken": "jwt_refresh_string" }`
* **Response (200 OK):** `{ "success": true, "data": { "accessToken": "new_jwt", "refreshToken": "new_refresh_jwt" } }`
* **Errors:** `401 Unauthorized` (Expired or revoked refresh token).

---

## 2. Veterinarian & Discovery Module (`/vets`)

### `API-VET-001`: Search Doctor Directory
* **Method & Path:** `GET /api/v1/vets`
* **Purpose:** Query verified veterinarians with clinical filters.
* **Authentication:** Optional
* **Query Parameters:**
  * `q` (`string`, optional) — Doctor name or clinic keyword
  * `specialty` (`string`, optional) — e.g. "Dermatology"
  * `language` (`string`, optional) — e.g. "French"
  * `country` (`string`, optional) — e.g. "United Kingdom"
  * `max_price` (`number`, optional) — Filter max consultation fee
  * `page` (`number`, default: 1), `limit` (`number`, default: 20)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "name": "Dr. Sarah Mitchell",
        "specialty": "General Veterinary Medicine",
        "country": "United Kingdom",
        "flag": "🇬🇧",
        "languages": ["English", "French"],
        "price_usd": 29.00,
        "rating": 4.9,
        "reviews": 312,
        "img_url": "https://...",
        "verified": true,
        "accepting": true
      }
    ],
    "meta": { "page": 1, "pageSize": 20, "total": 152 }
  }
  ```
* **Database Ops:** `SELECT FROM public.vet_profiles WHERE accepting = true`.
* **Related Screen:** `VetDirectoryScreen` (`SCR-TAB-002`).

---

### `API-VET-002`: Get Doctor Schedule & Live Slots
* **Method & Path:** `GET /api/v1/vets/:id/schedule`
* **Purpose:** Calculate available bookable appointment slots for the next 14 days.
* **Authentication:** Bearer JWT
* **Path Parameters:** `id` (Veterinarian UUID)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "vet_id": "uuid",
      "slot_minutes": 30,
      "days": [
        {
          "date": "2026-09-23",
          "slots": ["2026-09-23T09:00:00Z", "2026-09-23T09:30:00Z", "2026-09-23T14:00:00Z"]
        }
      ]
    }
  }
  ```
* **Business Logic:** Evaluates recurring `public.vet_availability` against existing booked `public.appointments`. Omit slots occurring in the past or within 15 minutes of present time.
* **Related Screen:** `BookingModalScreen` (`SCR-BOOK-001`).

---

## 3. Appointments Module (`/appointments`)

> **Architectural Implementation Note (Direct Supabase / RPC Architecture):**
> As established across Phases 1–4, Vetopia mobile communicates directly with Supabase Postgres and RLS. 
> Rather than proxying through an Express server:
> - `POST /api/v1/appointments` is implemented via the atomic PostgreSQL RPC `public.book_appointment(...)` (`SECURITY DEFINER`, search_path hardened, pet ownership verified, partial unique index `appointments_vet_scheduled_slot_idx` enforced).
> - `GET /api/v1/appointments` is executed via Supabase client queries directly against `public.appointments` protected by RLS (`appointments_select_participants`).
> - Appointment cancellation is implemented via PostgreSQL RPC `public.cancel_appointment(...)`.
> REST paths below are maintained as logical API contract mappings.

### `API-BOOK-001`: Book Consultation Appointment
* **Method & Path:** `POST /api/v1/appointments` (Mapped to `public.book_appointment` RPC)
* **Purpose:** Reserve a consultation slot and create clinical record.
* **Authentication:** Bearer JWT (`pet_parent`)
* **Request Body:**
  ```json
  {
    "vet_id": "uuid",
    "pet_id": "uuid",
    "starts_at": "2026-09-23T09:00:00Z",
    "mode": "video",
    "symptoms": "Vomiting and lethargy since yesterday evening",
    "urgency": "High",
    "contact_phone": "+1555019283"
  }
  ```
* **Response (201 Created):**
  ```json
  {
    "success": true,
    "data": {
      "appointment_id": "uuid",
      "status": "scheduled",
      "starts_at": "2026-09-23T09:00:00Z",
      "ends_at": "2026-09-23T09:30:00Z",
      "vet_name": "Dr. Sarah Mitchell",
      "mode": "video"
    }
  }
  ```
* **Errors:** `409 Conflict` (Duplicate `unique(vet_id, starts_at)`), `400 Bad Request`.
* **Database Ops:** Inserts into `public.appointments`.
* **Related Screen:** `BookingModalScreen` (`SCR-BOOK-001`).

---

### `API-BOOK-002`: List User Appointments
* **Method & Path:** `GET /api/v1/appointments`
* **Purpose:** Retrieve user's appointments grouped into upcoming and past.
* **Authentication:** Bearer JWT
* **Query Parameters:** `filter` (`upcoming` | `past`)
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "uuid",
        "starts_at": "2026-09-23T09:00:00Z",
        "ends_at": "2026-09-23T09:30:00Z",
        "mode": "video",
        "status": "scheduled",
        "pet_name": "Buddy",
        "species": "Dog",
        "symptoms": "Lethargy",
        "vet": { "id": "uuid", "name": "Dr. Sarah Mitchell", "specialty": "General Practice", "img_key": "vet1" }
      }
    ]
  }
  ```
* **Related Screen:** `AppointmentsHubScreen` (`SCR-TAB-003`).

---

### `API-BOOK-003`: Complete Consultation (RPC & REST)
* **Method & Path:** `rpc('complete_appointment', { p_appointment_id })` / `PUT /api/v1/appointments/:id/complete`
* **Purpose:** Mark consultation completed and perform atomic state transition.
* **Authentication:** Bearer JWT (`vet` participant who is assigned to this appointment)
* **PostgreSQL RPC Implementation:**
  ```sql
  complete_appointment(p_appointment_id uuid) RETURNS jsonb
  SECURITY DEFINER
  SET search_path = public
  ```
* **Authorization Checks:**
  1. Validates `auth.uid() IS NOT NULL` (Error: 28000).
  2. Validates appointment exists (Error: P0002).
  3. Validates status is `'scheduled'` (Error: P0001).
  4. Validates caller is the consulting veterinarian (`vet.user_id = auth.uid()`, Error: 42501).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "appointment_id": "c8b4b72e-84b2-4d2a-89a7-9f4482ad5b92",
    "status": "completed"
  }
  ```
* **Database Ops:** `UPDATE public.appointments SET status = 'completed', updated_at = now() WHERE id = :id`.
* **Related Screen:** `ConsultRoomScreen` (`app/consult/[id].tsx`).

---

### `API-TELE-001`: Generate LiveKit Room Token
* **Method & Path:** `POST /api/v1/telemedicine/token`
* **Purpose:** Issue cryptographically signed, short-lived LiveKit JWT access token for mobile RTC consultation.
* **Authentication:** Bearer JWT (`pet_parent` or `vet` participant in the appointment)
* **Request Body:**
  ```json
  {
    "appointment_id": "c8b4b72e-84b2-4d2a-89a7-9f4482ad5b92"
  }
  ```
* **Server-Side Authorization Invariants:**
  1. Authenticates Supabase session token (`auth.uid()`).
  2. Queries appointment by `appointment_id`.
  3. Validates caller is a participant: `pet.owner_id == auth.uid()` OR `vet.user_id == auth.uid()`.
  4. Validates appointment status is `'scheduled'`.
  5. Validates consultation timing: window opens at `starts_at - 15 minutes` (T-15m) and closes at `ends_at + 30 minutes`.
  6. Room name is deterministically generated server-side: `vetopia-consult-{appointment_id}`.
  7. Participant identity is deterministically generated server-side: `user_{auth.uid()}`.
* **Response (200 OK):**
  ```json
  {
    "serverUrl": "wss://vetopia-rtc.livekit.cloud",
    "roomName": "vetopia-consult-c8b4b72e-84b2-4d2a-89a7-9f4482ad5b92",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "identity": "user_7a4b8c9d-1111-2222-3333-444444444444",
    "participantName": "Dr. Sarah Mitchell",
    "expiresIn": 3600
  }
  ```
* **Security Grants:** `livekit-server-sdk` `AccessToken` with minimum required grant (`roomJoin: true`, `room: roomName`, `canPublish: true`, `canSubscribe: true`). Token TTL: 1 hour. LiveKit API secrets are never returned.
* **Errors:** `401 Unauthorized` (Missing/invalid token), `403 Forbidden` (Caller is not participant), `404 Not Found` (Appointment not found), `409 Conflict` (Cancelled/completed or outside consultation window).
* **Related Screen:** `ConsultRoomScreen` (`app/consult/[id].tsx`).


---

## 4. Pet Management Module (`/pets`)

### `API-PET-001`: Register Pet
* **Method & Path:** `POST /api/v1/pets`
* **Purpose:** Create new pet clinical record.
* **Authentication:** Bearer JWT (`pet_parent`)
* **Request Body:**
  ```json
  {
    "name": "Buddy",
    "species": "Dog",
    "breed": "Golden Retriever",
    "age": "2 yrs",
    "sex": "Male",
    "weight_kg": 28.5,
    "allergies": "Chicken",
    "bio": "Affectionate family dog",
    "photo_url": "https://..."
  }
  ```
* **Response (201 Created):** `{ "success": true, "data": { "id": "uuid", "name": "Buddy" } }`
* **Database Ops:** Inserts into `public.pets`.
* **Related Screen:** `AddPetScreen` (`app/registration/pet.tsx`).

---

## 5. Digital Prescriptions Module (`/prescriptions`)

### `API-PRES-001`: Create Digital Prescription
* **Architecture Implementation:** Database-side `SECURITY DEFINER` RPC `public.create_prescription` (also mapped via Mobile Data Service `prescriptionService.createPrescription`).
* **Purpose:** Authoring veterinarian writes structured digital prescription and line items for a completed consultation.
* **Authentication:** Authenticated Veterinarian (`auth.uid() = vet_profiles.user_id`).
* **Precondition:** Appointment must exist and have status `'completed'`.
* **Request Payload:**
  ```json
  {
    "appointment_id": "11111111-2222-3333-4444-555555555555",
    "diagnosis": "Canine Atopic Dermatitis",
    "notes": "Administer oral tablets with morning food. Clean paws daily.",
    "refills_allowed": 1,
    "items": [
      {
        "medication_name": "Apoquel (Oclacitinib)",
        "dosage": "16mg",
        "frequency": "Twice daily for 14 days, then once daily",
        "duration": "30 days",
        "special_instructions": "Give with or without food"
      }
    ]
  }
  ```
* **Response (200 OK / 201 Created):**
  ```json
  {
    "success": true,
    "prescription_id": "33333333-4444-5555-6666-777777777777",
    "appointment_id": "11111111-2222-3333-4444-555555555555",
    "item_count": 1
  }
  ```
* **Security & Constraints:**
  * Client cannot override `vet_id` or `pet_id` (derived strictly from authenticated doctor and appointment record).
  * Unique constraint `UNIQUE (appointment_id)` prevents duplicate prescriptions.
  * Controlled substances (Schedules II–V) strictly prohibited.
* **Related Screen:** `CreatePrescriptionScreen` (`app/consult/[id]/prescription.tsx`).

---

### `API-PRES-002`: View & Export Digital Prescription
* **Architecture Implementation:** Supabase RLS Query `public.prescriptions` + client-side PDF compilation via `expo-print` and `expo-sharing`.
* **Purpose:** Retrieve structured prescription record and export official PDF for pet parents and consulting veterinarians.
* **Authentication:** Authenticated Pet Owner (`pets.owner_id = auth.uid()`) or Authoring Veterinarian (`vet_profiles.user_id = auth.uid()`).
* **Parameters:** `id` (`UUID`, path parameter).
* **Response (200 OK):**
  ```json
  {
    "id": "33333333-4444-5555-6666-777777777777",
    "appointment_id": "11111111-2222-3333-4444-555555555555",
    "vet_id": "vet-profile-1",
    "pet_id": "pet-123",
    "diagnosis": "Canine Atopic Dermatitis",
    "notes": "Administer oral tablets with morning food.",
    "refills_allowed": 1,
    "status": "active",
    "created_at": "2026-10-01T10:35:00Z",
    "items": [
      {
        "id": "item-1",
        "prescription_id": "33333333-4444-5555-6666-777777777777",
        "medication_name": "Apoquel (Oclacitinib)",
        "dosage": "16mg",
        "frequency": "Twice daily",
        "duration": "30 days",
        "special_instructions": "Give with food"
      }
    ],
    "vet": {
      "name": "Dr. Sarah Mitchell",
      "specialty": "General Veterinary Medicine",
      "country": "United Kingdom",
      "flag": "🇬🇧",
      "verified": true
    },
    "pet": {
      "name": "Luna",
      "species": "Canine",
      "breed": "Golden Retriever",
      "age": "3 years",
      "weight_kg": 28.5
    }
  }
  ```
* **PDF Export:** Generated via `Print.printToFileAsync` and shared via `Sharing.shareAsync` with official Vetopia branding, patient snapshot, medication table, and legal disclaimer.
* **Related Screen:** `PrescriptionDetailScreen` (`app/prescriptions/[id].tsx`).

---

## 6. AI Triage Module (`/ai`)

### `API-AI-001`: Stream AI Symptom Triage
* **Method & Path:** `POST /api/v1/ai/triage-chat`
* **Purpose:** Stream veterinary guidance and emergency detection.
* **Authentication:** Bearer JWT (or Guest Rate-Limited)
* **Request Body:**
  ```json
  {
    "messages": [
      { "role": "user", "content": "My dog ate 100g of dark chocolate 20 minutes ago." }
    ]
  }
  ```
* **Response:** Server-Sent Events (`text/event-stream`) streaming Markdown tokens, concluding with `[DONE]`.
* **Upstream Service:** Google Gemini 2.5 Flash with clinical safety instructions.
* **Related Screen:** `AIChatbotScreen` (`SCR-AI-001`).

---

## 7. Clinical Messaging Module (`/messages`, RPCs, and Realtime) `[IMPLEMENTED MVP-07]`

### `API-MSG-001`: Get or Create Appointment Conversation
* **Method & Path:** `rpc('get_or_create_appointment_conversation', { p_appointment_id })`
* **Purpose:** Idempotently initiate or fetch a 1-to-1 clinical conversation between pet parent and consulting veterinarian for an appointment.
* **Authentication:** Bearer JWT (`pet_parent` or `vet` participant of the specified appointment).
* **RPC Parameters:**
  ```json
  {
    "p_appointment_id": "c8b4b72e-84b2-4d2a-89a7-9f4482ad5b92"
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "id": "conv-uuid",
    "created_at": "2026-09-26T18:00:00Z",
    "last_message_at": "2026-09-26T18:00:00Z",
    "appointment_id": "c8b4b72e-84b2-4d2a-89a7-9f4482ad5b92"
  }
  ```
* **Security & Invariants:**
  - Verifies `auth.uid() IS NOT NULL` (Error: `28000`).
  - Ensures caller is strictly the appointment's pet parent or assigned vet (Error: `42501`).
  - Prevents duplicate conversation records through unique partial index on `appointment_id`.
* **Related Screen:** `MessageThreadScreen` (`app/messages/[id].tsx`), `AppointmentCard` (`src/components/appointments/AppointmentCard.tsx`).

---

### `API-MSG-002`: Send Direct Message
* **Method & Path:** `rpc('send_direct_message', { p_conversation_id, p_body })`
* **Purpose:** Send a validated text message (max 4,000 characters) in a 1-to-1 clinical conversation.
* **Authentication:** Bearer JWT (verified conversation member).
* **RPC Parameters:**
  ```json
  {
    "p_conversation_id": "conv-uuid",
    "p_body": "Hello Doctor, Luna is recovering well after taking the medication."
  }
  ```
* **Response (200 OK):**
  ```json
  {
    "id": "msg-uuid",
    "conversation_id": "conv-uuid",
    "sender_id": "user-uuid",
    "body": "Hello Doctor, Luna is recovering well after taking the medication.",
    "status": "sent",
    "created_at": "2026-09-26T18:05:00Z"
  }
  ```
* **Security & Invariants:**
  - `sender_id` is assigned strictly from `auth.uid()` server-side (spoofing impossible).
  - Character limit: `1 <= length(trim(p_body)) <= 4000` (Error: `22023`).
  - Caller must be an active participant in `conversation_participants` (Error: `42501`).
  - Atomically updates `conversations.last_message_at = now()` and sender's `last_read_at = now()`.
* **Related Screen:** `MessageComposer` (`src/components/messages/MessageComposer.tsx`).

---

### `API-MSG-003`: List User Conversations
* **Method & Path:** `rpc('get_user_conversations')`
* **Purpose:** Retrieve all clinical conversations for the authenticated user, enriched with counterpart details, pet snapshot, last message, and unread counts.
* **Authentication:** Bearer JWT.
* **Response (200 OK):**
  ```json
  [
    {
      "id": "conv-uuid",
      "appointment_id": "appt-uuid",
      "created_at": "2026-09-26T18:00:00Z",
      "last_message_at": "2026-09-26T18:05:00Z",
      "counterpart": {
        "id": "user-vet-uuid",
        "name": "Dr. Sarah Mitchell",
        "avatar_url": null,
        "role": "vet"
      },
      "appointment_context": {
        "id": "appt-uuid",
        "pet_name": "Buddy",
        "pet_species": "Dog",
        "scheduled_at": "2026-09-26T15:00:00Z",
        "status": "completed"
      },
      "last_message": {
        "id": "msg-uuid",
        "body": "Hello Doctor, Luna is recovering well.",
        "created_at": "2026-09-26T18:05:00Z",
        "sender_id": "user-uuid"
      },
      "unread_count": 0
    }
  ]
  ```
* **Related Screen:** `MessagesTabScreen` (`SCR-TAB-004` / `app/(tabs)/messages.tsx`).

---

### `API-MSG-004`: Retrieve Thread Messages
* **Method & Path:** Supabase SELECT `public.direct_messages`
* **Filter:** `conversation_id = :id`, ordered by `created_at ASC`
* **Purpose:** Retrieve full chronological message history for a conversation.
* **Authentication:** Bearer JWT (enforced by RLS `is_conversation_member(conversation_id, auth.uid())`).
* **Related Screen:** `MessageThreadScreen` (`SCR-MSG-001` / `app/messages/[id].tsx`).

---

### `API-MSG-005`: Mark Conversation Read
* **Method & Path:** `rpc('mark_conversation_read', { p_conversation_id })`
* **Purpose:** Update the authenticated participant's `last_read_at` to the current timestamp.
* **Authentication:** Bearer JWT.
* **Response (200 OK):** `true`
* **Related Screen:** `MessageThreadScreen` (`app/messages/[id].tsx`).

---

### `API-MSG-006`: Total Unread Message Count
* **Method & Path:** `rpc('get_unread_message_count')`
* **Purpose:** Fetch aggregated count of unread incoming messages across all conversations for tab badge rendering.
* **Authentication:** Bearer JWT.
* **Response (200 OK):** integer (e.g. `2`)
* **Related Screen:** `TabLayout` (`app/(tabs)/_layout.tsx`).

---

### `API-MSG-007`: Realtime Direct Message Channel
* **Protocol:** Supabase Realtime WebSocket (`postgres_changes`)
* **Channel Name:** `messages:{conversation_id}`
* **Event:** `INSERT` on schema `public`, table `direct_messages`, filter `conversation_id=eq.{id}`
* **Payload:** Newly inserted `DirectMessage` row.
* **Client Handling:** Deduplication via message `id`, chronological insertion into React Query cache, auto-scrolling to bottom.

