# Software Requirements Specification (SRS) — Vetopia Mobile MVP

## 1. Functional Requirements

### 1.1 Authentication & User Management (MVP-01)

#### `FR-AUTH-001`: User Registration
* **Actor:** Unauthenticated User
* **Priority:** P0 (Must Have)
* **Preconditions:** User has installed app and is unauthenticated.
* **Main Behavior:** User provides full name, email, password, and selects an initial role (`pet_parent` or `vet`). System creates Supabase auth record, inserts profile into `profiles`, and assigns role in `user_roles`. System returns access token and refresh token.
* **Alternative Behavior:** User signs in with Google OAuth; system retrieves metadata and proceeds to onboarding.
* **Error Behavior:** Duplicate email returns `409 Conflict`; weak password (<6 characters) returns `422 Validation Error`.
* **Screen:** `RegisterScreen` (`app/(auth)/register.tsx`)
* **API:** `POST /api/v1/auth/register`
* **Database:** `auth.users`, `public.profiles`, `public.user_roles`
* **Test:** Verify account creation with valid payload; verify rejection of existing email.

#### `FR-AUTH-002`: User Authentication & Biometrics
* **Actor:** Unauthenticated User
* **Priority:** P0 (Must Have)
* **Preconditions:** User has a registered account.
* **Main Behavior:** User enters email and password. System validates credentials, issues access token (15m expiration) and refresh token (30d rotating). Tokens are stored in `expo-secure-store`. If enabled, Face ID/Touch ID unlocks app on subsequent launches.
* **Alternative Behavior:** If user enables biometrics, app prompts for local biometric scan before requesting stored token.
* **Error Behavior:** Invalid credentials return `401 Unauthorized`. 5 failed attempts trigger rate limiting (15 min lockout).
* **Screen:** `LoginScreen` (`app/(auth)/login.tsx`)
* **API:** `POST /api/v1/auth/login`
* **Database:** `auth.users`
* **Test:** Verify valid login returns tokens; verify rate limit after 5 failed attempts.

#### `FR-AUTH-003`: Session Refresh & Persistence
* **Actor:** Authenticated App Client
* **Priority:** P0 (Must Have)
* **Preconditions:** Access token has expired; refresh token is valid.
* **Main Behavior:** Axios/Ky HTTP client interceptor detects `401 Unauthorized`, pauses outbound requests, calls `/api/v1/auth/refresh` with refresh token, updates `expo-secure-store`, and replays original requests.
* **Error Behavior:** If refresh token is expired or revoked, user is signed out and redirected to `LoginScreen`.
* **Screen:** Background Service (Global Interceptor)
* **API:** `POST /api/v1/auth/refresh`
* **Database:** `auth.refresh_tokens`
* **Test:** Mock expired token, verify seamless token rotation without user interruption.

---

### 1.2 Pet Management & Passport (MVP-02)

#### `FR-PET-001`: Register Pet Profile
* **Actor:** Pet Parent
* **Priority:** P0 (Must Have)
* **Preconditions:** User is logged in as `pet_parent`.
* **Main Behavior:** User submits pet details: `name`, `species` (Dog, Cat, Bird, Other), `breed`, `age`, `sex`, `weight_kg`, `allergies`, `medical_notes`, and uploads an image. System saves record in `pets` table and returns new pet ID.
* **Alternative Behavior:** User skips image upload; system assigns default species illustration.
* **Error Behavior:** Missing required fields (`name`, `species`) returns `400 Bad Request`.
* **Screen:** `AddPetScreen` (`app/registration/pet.tsx`)
* **API:** `POST /api/v1/pets`
* **Database:** `public.pets`
* **Test:** Verify pet insertion and appearance in pet passport list.

#### `FR-PET-002`: View Pet Health Passport (Offline Capable)
* **Actor:** Pet Parent, Consulting Vet
* **Priority:** P0 (Must Have)
* **Preconditions:** Pet exists in system.
* **Main Behavior:** User views pet clinical record: basic biometrics, vaccination history, prescription history, and consultation notes. Data is cached locally via MMKV/WatermelonDB for offline viewing.
* **Alternative Behavior:** When offline, app renders cached snapshot with "Last updated" banner.
* **Error Behavior:** Pet ID not found returns `404 Not Found`.
* **Screen:** `PetPassportScreen` (`app/(tabs)/profile.tsx` -> Pet Detail)
* **API:** `GET /api/v1/pets/:id`
* **Database:** `public.pets`, `public.prescriptions`, `public.appointments`
* **Test:** Disconnect device network, verify cached passport renders accurately.

---

### 1.3 Vet Discovery & Profiles (MVP-03)

#### `FR-VET-001`: Doctor Directory Search & Filtering
* **Actor:** Pet Parent
* **Priority:** P0 (Must Have)
* **Preconditions:** User is on Vet Discovery tab.
* **Main Behavior:** User searches doctor directory by text query or filters by: `specialty` (12 specialties), `language` (11 languages), `country`, `max_price`, and `accepting_status`. System returns paginated list of doctor cards.
* **Alternative Behavior:** Empty search query returns top-rated doctors currently accepting consults.
* **Error Behavior:** Network error displays retry banner with cached doctor profiles.
* **Screen:** `VetDirectoryScreen` (`app/(tabs)/vets.tsx`)
* **API:** `GET /api/v1/vets`
* **Database:** `public.vet_profiles`
* **Test:** Verify filter by specialty returns only matching veterinarians.

#### `FR-VET-002`: Doctor Detailed Profile & Live Slots
* **Actor:** Pet Parent
* **Priority:** P0 (Must Have)
* **Preconditions:** Doctor exists with verified profile.
* **Main Behavior:** User taps doctor card. System displays doctor biography, license verification badge, rating, review count, consultation price, and dynamically generated bookable slots for the next 14 days based on `vet_availability` minus existing `appointments`.
* **Error Behavior:** Doctor who is not accepting patients displays "Currently Not Accepting Bookings" CTA disabled.
* **Screen:** `VetProfileScreen` (`app/booking/[vetId].tsx`)
* **API:** `GET /api/v1/vets/:id`, `GET /api/v1/vets/:id/schedule`
* **Database:** `public.vet_profiles`, `public.vet_availability`, `public.appointments`
* **Test:** Verify slot generation correctly omits already-scheduled appointments.

---

### 1.4 Appointments & Scheduling (MVP-04)

#### `FR-BOOK-001`: Appointment Reservation
* **Actor:** Pet Parent
* **Priority:** P0 (Must Have)
* **Preconditions:** User is authenticated, has selected an available slot, and chosen a pet.
* **Main Behavior:** User provides: `slot_start`, `mode` (`video`, `audio`, `chat`), `pet_id`, `symptoms`, `duration`, `urgency`, and `contact_phone`. System verifies slot is unreserved, inserts into `appointments` with `status: 'scheduled'`, and returns booking confirmation ID.
* **Error Behavior:** Slot conflict (race condition, duplicate `unique(vet_id, starts_at)`) returns `409 Conflict` with error message "Slot just taken. Please select another time."
* **Screen:** `BookingModalScreen` (`app/booking/[vetId].tsx`)
* **API:** `POST /api/v1/appointments`
* **Database:** `public.appointments`
* **Test:** Concurrently book same slot from two test clients; verify one succeeds and one receives 409.

#### `FR-BOOK-002`: Appointment Cancellation & Management
* **Actor:** Pet Parent or Consulting Vet
* **Priority:** P1 (Should Have)
* **Preconditions:** Appointment has `status: 'scheduled'`.
* **Main Behavior:** Actor selects "Cancel Appointment". System verifies caller is participant, updates status to `cancelled`, and frees up the slot.
* **Error Behavior:** Cancellation attempted less than 2 hours before consult start prompts warning dialog regarding cancellation policies.
* **Screen:** `AppointmentsListScreen` (`app/(tabs)/appointments.tsx`)
* **API:** `PUT /api/v1/appointments/:id/cancel`
* **Database:** `public.appointments`
* **Test:** Verify status updates to `cancelled` and slot reappears in doctor schedule.

---

### 1.5 Telemedicine & WebRTC (MVP-05)

#### `FR-TELE-001`: Consultation Waiting Room & Device Check
* **Actor:** Pet Parent, Vet
* **Priority:** P0 (Must Have)
* **Preconditions:** Scheduled appointment is within 15 minutes of start time or currently active.
* **Main Behavior:** User opens consultation room. App performs native camera and microphone permission check, displays local video preview, and displays waiting room banner: "Waiting for Doctor..." or "Patient in Waiting Room".
* **Alternative Behavior:** User can toggle camera and mic off prior to joining.
* **Error Behavior:** Permission denial displays modal directing user to system settings.
* **Screen:** `ConsultRoomScreen` (`app/consult/[id].tsx`)
* **API:** `GET /api/v1/appointments/:id`
* **Database:** `public.appointments`
* **Test:** Verify local media stream initializes properly before call connection.

#### `FR-TELE-002`: WebRTC Signaling & Connection
* **Actor:** Pet Parent and Vet
* **Priority:** P0 (Must Have)
* **Preconditions:** Both participants are in consultation room.
* **Main Behavior:** Caller creates SDP offer and inserts into `call_signals` table via Supabase Realtime channel. Callee receives offer, generates SDP answer, and responds. Both exchange ICE candidates. Peer-to-peer WebRTC connection is established. Live video/audio streams display.
* **Error Behavior:** Connection failure attempts ICE restart up to 3 times before displaying "Reconnecting... Please check your internet connection."
* **Screen:** `ConsultRoomScreen` (`app/consult/[id].tsx`)
* **API / Realtime:** Supabase `call_signals` Realtime Channel
* **Database:** `public.call_signals`
* **Test:** Verify SDP offer/answer exchange results in `connected` state on two physical devices.

#### `FR-TELE-003`: Call Termination & Consultation Completion
* **Actor:** Consulting Vet (Primary) or Pet Parent
* **Priority:** P0 (Must Have)
* **Preconditions:** Call is currently connected.
* **Main Behavior:** Vet taps "End Consultation". System terminates WebRTC peer connection, stops all local media tracks, clears `call_signals`, updates `appointments.status = 'completed'`, and opens the prescription/notes generation modal for the doctor.
* **Screen:** `ConsultRoomScreen` (`app/consult/[id].tsx`)
* **API:** `PUT /api/v1/appointments/:id/complete`
* **Database:** `public.appointments`, `public.call_signals`
* **Test:** Verify call ends cleanly, tracks are stopped, and appointment status updates to `completed`.

---

### 1.6 Prescriptions (MVP-06)

#### `FR-PRES-001`: Create Digital Prescription
* **Actor:** Consulting Veterinarian
* **Priority:** P0 (Must Have)
* **Preconditions:** Appointment has `status: 'completed'`.
* **Main Behavior:** Vet fills prescription form: Diagnosis, list of medications (drug name, dosage, frequency, duration, special instructions), and refill allowance. System saves prescription linked to `appointment_id`, `pet_id`, and `vet_id`.
* **Error Behavior:** Empty medication list prevents submission.
* **Screen:** `CreatePrescriptionScreen` (`app/consult/[id]/prescription.tsx`)
* **API:** `POST /api/v1/prescriptions`
* **Database:** `public.prescriptions`, `public.prescription_items`
* **Test:** Submit prescription, verify record creation and automated push notification to pet parent.

#### `FR-PRES-002`: View & Download Prescription
* **Actor:** Pet Parent
* **Priority:** P0 (Must Have)
* **Preconditions:** Prescription exists for pet parent's pet.
* **Main Behavior:** Pet parent views structured digital prescription, doctor's electronic signature, clinic license details, and instructions. Pet parent can export prescription as formatted PDF.
* **Screen:** `PrescriptionDetailScreen` (`app/prescriptions/[id].tsx`)
* **API:** `GET /api/v1/prescriptions/:id`
* **Database:** `public.prescriptions`, `public.prescription_items`
* **Test:** Verify pet parent can view prescription; verify non-owner receives `403 Forbidden`.

---

### 1.7 1-to-1 Clinical Messaging (MVP-07)

#### `FR-MSG-001`: Direct Doctor ↔ Parent Conversation
* **Actor:** Pet Parent, Consulting Vet
* **Priority:** P0 (Must Have)
* **Preconditions:** An appointment exists between the pet parent and vet (or open inquiry).
* **Main Behavior:** Either party can send text messages. Message is inserted into `direct_messages`, updates `conversations.last_message_at`, and is broadcast in real time over Supabase channel to the recipient.
* **Alternative Behavior:** If recipient is offline, system dispatches APNs/FCM push notification.
* **Error Behavior:** Text exceeding 4,000 characters returns validation error.
* **Screen:** `MessageThreadScreen` (`app/messages/[id].tsx`)
* **API / Realtime:** `POST /api/v1/conversations/:id/messages`, Supabase Realtime
* **Database:** `public.conversations`, `public.conversation_participants`, `public.direct_messages`
* **Test:** Send message from User A; verify immediate receipt on User B screen via WebSocket.

---

### 1.8 24/7 AI Triage Assistant (MVP-09)

#### `FR-AI-001`: Symptom Assessment & Emergency Detection
* **Actor:** Pet Parent
* **Priority:** P0 (Must Have)
* **Preconditions:** User is logged in or in guest triage mode.
* **Main Behavior:** Pet parent describes pet symptoms. Mobile client sends message history to AI gateway. Backend streams response from Google Gemini 2.5 Flash with clinical safety system prompt. If red-flag symptoms are detected (e.g., gastric torsion, difficulty breathing, seizures, poisoning), system immediately renders prominent Red-Flag Emergency Banner with direct dial to emergency vet.
* **Safety Boundary:** AI explicitly states it cannot prescribe medications or replace an in-person physical exam.
* **Error Behavior:** Upstream gateway timeout (504) displays fallback message: "AI assistant unavailable. If this is an emergency, please contact an in-person clinic immediately."
* **Screen:** `AIChatbotScreen` (`app/ai/chat.tsx`)
* **API:** `POST /api/v1/ai/triage-chat` (Server-Sent Events streaming)
* **Test:** Submit emergency prompt ("dog ate dark chocolate and is shaking"); verify red-flag banner renders.

---

### 1.9 Notifications (MVP-08)

#### `FR-NOTIF-001`: Push Notification Delivery
* **Actor:** System
* **Priority:** P0 (Must Have)
* **Preconditions:** User has granted push notification permissions.
* **Main Behavior:** System triggers push notifications for:
  1. Appointment Booked / Confirmed
  2. 15-Minute Consultation Reminder (High Priority)
  3. Doctor Entered Consultation Room
  4. Incoming Clinical Message
  5. Digital Prescription Issued
* **Screen:** Native Notification Tray -> Deep link to target screen.
* **API:** `POST /api/v1/notifications/token` (Device token registration)
* **Database:** `public.notifications`, `public.device_tokens`
* **Test:** Trigger consultation reminder; verify device displays notification and opens room on tap.

---

## 2. Non-Functional Requirements

### 2.1 Security & Compliance (NFR-SEC)
* **`NFR-SEC-001` (Zero Plaintext Secrets):** Mobile client bundle must never contain Supabase service-role keys, payment secret keys, or private API secrets.
* **`NFR-SEC-002` (Secure Token Storage):** JWT access and refresh tokens must be stored exclusively in iOS Keychain and Android KeyStore via `expo-secure-store`.
* **`NFR-SEC-003` (Transport Security):** All network communications must use HTTPS with TLS 1.3. Certificate pinning must be enforced on Express API endpoints.
* **`NFR-SEC-004` (Multi-Tenant Isolation):** All database read/write queries must pass Supabase Row Level Security (RLS) policies verifying `auth.uid()`.

### 2.2 Performance & Responsiveness (NFR-PERF)
* **`NFR-PERF-001` (60 FPS Scrolling):** Virtualized lists (`FlashList`) must maintain 60 frames per second on devices with mid-range processors.
* **`NFR-PERF-002` (Cold Start Time):** Mobile application cold start to interactive home screen must complete in under 2.0 seconds on standard 4G connections.
* **`NFR-PERF-003` (WebRTC Latency):** Peer-to-peer audio/video packet latency must remain under 300ms round-trip time under standard Wi-Fi/4G conditions.

### 2.3 Reliability & Availability (NFR-REL)
* **`NFR-REL-001` (WebRTC Reconnection):** When a network drop occurs during a consultation, app must automatically attempt ICE reconnection for 20 seconds before prompting user action.
* **`NFR-REL-002` (Offline Accessibility):** Pet passport records, vaccination dates, and past prescriptions must be readable offline without internet access.

### 2.4 Accessibility (NFR-ACC)
* **`NFR-ACC-001` (Touch Target Size):** All interactive buttons, icon hits, and form inputs must meet minimum touch target dimensions of 44 x 44 points.
* **`NFR-ACC-002` (Dynamic Type):** All typography must support dynamic system font scaling with a maximum scale factor of 1.3x.
