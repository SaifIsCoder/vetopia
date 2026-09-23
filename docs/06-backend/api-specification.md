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

### `API-BOOK-001`: Book Consultation Appointment
* **Method & Path:** `POST /api/v1/appointments`
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

### `API-BOOK-003`: Complete Consultation
* **Method & Path:** `PUT /api/v1/appointments/:id/complete`
* **Purpose:** Mark consultation completed and trigger prescription handoff.
* **Authentication:** Bearer JWT (`vet` participant)
* **Response (200 OK):** `{ "success": true, "data": { "id": "uuid", "status": "completed" } }`
* **Database Ops:** `UPDATE public.appointments SET status = 'completed' WHERE id = :id`.
* **Related Screen:** `TelemedicineRoomScreen` (`SCR-TELE-001`).

---

### `API-TELE-001`: Generate LiveKit Room Token
* **Method & Path:** `POST /api/v1/telemedicine/token`
* **Purpose:** Issue cryptographically signed short-lived LiveKit JWT token for mobile video room.
* **Authentication:** Bearer JWT (`pet_parent` or `vet` participating in the appointment)
* **Request Body:**
  ```json
  {
    "appointment_id": "c8b4b72e-84b2-4d2a-89a7-9f4482ad5b92"
  }
  ```
* **Validation:** Caller must be either `pet_parent_id` or `vet_id` of the appointment. Appointment status must be `scheduled` and within valid time window (T-15m to end).
* **Response (200 OK):**
  ```json
  {
    "success": true,
    "data": {
      "server_url": "wss://vetopia-rtc.livekit.cloud",
      "room_name": "appointment_c8b4b72e-84b2-4d2a-89a7-9f4482ad5b92",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "participant_identity": "user_7a4b8c9d-...",
      "participant_name": "Dr. Sarah Mitchell"
    }
  }
  ```
* **Service Logic:** Express uses `livekit-server-sdk` `AccessToken` with `VideoGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true })`, TTL 2 hours.
* **Related Screen:** `TelemedicineRoomScreen` (`SCR-TELE-001`).


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

### `API-PRES-001`: Issue Digital Prescription
* **Method & Path:** `POST /api/v1/prescriptions`
* **Purpose:** Doctor writes structured e-prescription for an appointment.
* **Authentication:** Bearer JWT (`vet`)
* **Request Body:**
  ```json
  {
    "appointment_id": "uuid",
    "pet_id": "uuid",
    "diagnosis": "Acute Gastroenteritis",
    "notes": "Ensure abundant water intake",
    "items": [
      {
        "medication_name": "Metronidazole",
        "dosage": "250mg",
        "frequency": "Twice daily",
        "duration_days": 7,
        "instructions": "Administer with meal"
      }
    ]
  }
  ```
* **Response (201 Created):** `{ "success": true, "data": { "prescription_id": "uuid" } }`
* **Database Ops:** Inserts into `public.prescriptions` and `public.prescription_items`. Dispatches push notification to pet parent.
* **Related Screen:** `CreatePrescriptionScreen`.

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
