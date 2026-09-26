# Implementation Roadmap & Phase Progress — Vetopia Mobile MVP

This document tracks the phased implementation progress of the **Vetopia Mobile MVP**, recording completed phases, installed dependency versions, architectural boundaries, and readiness gates for subsequent development phases.

---

## Phase 1 — Mobile Foundation

**Status:** `COMPLETED / READY FOR REVIEW`  
**Execution Date:** 2026-09-23  
**Target Environment:** Expo SDK 57 · React Native 0.86 · React 19.x · Node.js 24 LTS

### 1. Objective
Establish the production-ready technical and UI foundation for the Vetopia mobile application under `mobile/`, ensuring all necessary infrastructure, design tokens, atomic components, state management stores, navigation shells, and testing pipelines are established prior to implementing functional MVP modules.

---

### 2. Implemented Scope
* **Application Shell & Configuration:**
  * Complete Expo SDK 57 + Expo Router file-based architecture.
  * Strict mode TypeScript configuration (`tsconfig.json`) with path aliases (`@/*`, `@/assets/*`).
  * Isolated environment management (`.env.example`, `.env`) with public credentials handling.
  * Code quality tooling: ESLint flat configuration (`eslint.config.mjs`) and Prettier (`.prettierrc`).
* **Design System & Theme Engine (`src/theme/`):**
  * Centralized palette tokens: Primary Lime (`#A8E831`), Deep Lime (`#88C71B`), Ink (`#131616`), Cream (`#FAF9F5`), Surface (`#F2F4EE`), Destructive (`#DC2626`), Success (`#16A34A`), Muted (`#6E7676`).
  * Typography scale: Display Large (32pt), Display Medium (26pt), Heading Large (20pt), Heading Medium (17pt), Body Large (16pt), Body Medium (14pt), Body Small (12pt), Caption (10pt), Button (14pt uppercase).
  * Spacing scale: `xs` (4pt) to `4xl` (48pt).
  * Corner radii: `sm` (8pt), `md` (12pt), `lg` (16pt), `xl` (24pt), `pill` (9999pt).
  * Cross-platform elevation/shadow definitions for cards and sheets.
* **Shared Atomic UI Component Library (`src/components/`):**
  * `Button`: 5 variants (`primary`, `secondary`, `outline`, `destructive`, `ghost`), 3 sizes, loading indicators, disabled states, min 48pt touch targets.
  * `IconButton`: Accessible min 48pt touch target button for actions and headers.
  * `Text` & `Heading`: Themed typography primitives with semantic heading levels.
  * `Input` & `SearchInput`: Styled inputs with active focus border (`#88C71B`), error states, helper texts, and clear triggers.
  * `Card`: Elevated container with standard 16pt border radius.
  * `Avatar`: Circular avatar with network image caching and initials fallback.
  * `Badge`: Status chips (`verified`, `scheduled`, `completed`, `cancelled`).
  * `Chip`: Selectable filter pill for specialty and category filtering.
  * `Divider`: 1px horizontal and vertical divider.
  * `Skeleton`: Pulsing shimmer loading placeholder.
  * `Screen` & `SafeAreaView`: Layout wrappers with keyboard-aware scrolling and safe area insets.
  * `LoadingState`, `EmptyState`, `ErrorState`: Reusable state feedback components with retry triggers.
  * `Modal` & `BottomSheet`: Accessible dialog and bottom sheet overlays.
* **Networking & Client Foundations (`src/lib/`):**
  * `ApiClient`: Typed HTTP client with configurable base URL, timeout handling via `AbortController`, standardized JSON parsing, and pluggable authentication token provider callback.
  * Error hierarchy: `ApiError`, `NetworkError`, `AuthError`, `ForbiddenError`, `ValidationError`, `ServerError`, `NotFoundError`.
  * `SupabaseClient`: Configured using public anon credentials with session persistence defaults.
  * `QueryClient`: Configured with 5-minute stale time and selective retry policy.
* **Client State Management (`src/store/`):**
  * `useAuthStore`: Lightweight Zustand store holding user session state shell.
  * `useUIStore`: Client UI state store for modal management and connectivity status.
* **Navigation Shell (`app/`):**
  * Root Layout (`app/_layout.tsx`) providing `QueryClientProvider`, `SafeAreaProvider`, and status bar configuration.
  * 5-Destination Bottom Tab Navigator (`app/(tabs)/_layout.tsx`):
    * `Home` (`app/(tabs)/index.tsx`)
    * `Find Vet` (`app/(tabs)/vets.tsx`)
    * `Appointments` (`app/(tabs)/appointments.tsx`)
    * `Messages` (`app/(tabs)/messages.tsx`)
    * `Care Hub` (`app/(tabs)/care.tsx`)
  * Route shells for future phases:
    * `app/(auth)/` (`welcome.tsx`, `login.tsx`, `register.tsx`, `forgot-password.tsx`, `onboarding.tsx`)
    * `app/consult/[id].tsx` (Telemedicine room)
    * `app/booking/[vetId].tsx` (Booking wizard)
    * `app/messages/[id].tsx` (1-to-1 conversation)
    * `app/pets/[id].tsx` and `app/pets/add.tsx` (Pet health passport)
    * `app/prescriptions/[id].tsx` (Prescription viewer)
    * `app/ai/chat.tsx` (AI triage assistant)
    * `app/vet/dashboard.tsx` (Doctor portal)
    * `app/settings/profile.tsx` (Preferences & security)
* **Automated Testing Suite (`tests/`):**
  * Unit tests validating all design system tokens.
  * Unit tests validating API error normalization and client contracts.
  * Component tests for `Button`, `Text`, and `Card`.

---

### 3. Installed Dependency Versions (Actual)
```text
expo: ~57.0.24
expo-router: ~57.0.22
react: 19.2.3
react-native: 0.86.3
react-native-safe-area-context: ~5.7.0
react-native-screens: ~4.26.0
react-native-svg: ~15.11.2
@tanstack/react-query: ^5.83.0
zustand: ^5.0.3
@supabase/supabase-js: ^2.105.3
lucide-react-native: ^0.575.0
typescript: ~5.8.2
node: v24.14.0
```

---

### 4. Explicitly Excluded from Phase 1
In strict accordance with project rules, zero functional MVP business modules were implemented:
* No login/registration API execution or biometric key persistence (deferred to Phase 2).
* No pet record database operations (deferred to Phase 3).
* No doctor directory queries or slot availability calculations (deferred to Phase 4).
* No appointment booking transactions (deferred to Phase 5).
* No LiveKit video calls or media tracks (deferred to Phase 6).
* No prescription creation or PDF issuance (deferred to Phase 7).
* No Supabase Realtime messaging channel subscriptions (deferred to Phase 8).
* No push notification device token registration (deferred to Phase 9).
* No Gemini AI LLM streaming connections (deferred to Phase 10).
* No settings or admin operations (deferred to Phase 11).

---

## Phase 2 — MVP-01 Authentication & RBAC

**Status:** `COMPLETED`  
**Execution Date:** 2026-09-23  
**Target Environment:** Expo SDK 57 · React Native 0.86 · React 19.x · Supabase Auth

### 1. Objective
Deliver the complete, production-ready **MVP-01 Authentication & RBAC** module on top of the Phase 1 mobile foundation, integrating authoritatively with Supabase Auth, PostgreSQL Row Level Security, and local biometric security.

---

### 2. Architecture Reconciliation
* **Authoritative Auth Provider:** Reconciled documentation with active system architecture. The Vetopia platform uses **Supabase Auth** (`@supabase/supabase-js`) directly, backed by `auth.users`, `public.profiles`, `public.user_roles`, and `public.vet_profiles`. No separate Express authentication server is used.
* **Token Management & Injection:** `ApiClient` dynamically retrieves the active Supabase JWT `access_token` and injects `Authorization: Bearer <token>` on all authenticated requests. Automatic 401 interceptor rotates tokens via `supabase.auth.refreshSession()` with a singleton lock preventing duplicate refresh requests.
* **Hardware-Backed Session Storage:** Implemented `SecureStorageAdapter` utilizing `expo-secure-store` with chunking (threshold: 1800 bytes) to protect against Android KeyStore's 2048-byte limit.
* **Security & RLS Invariant:** Client never handles or stores `service_role` keys, database passwords, or JWT secrets. Public mobile variables strictly limited to `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_APP_ENV`. Privilege escalation to `admin` or `super_admin` is blocked client-side and enforced by PostgreSQL RLS.

---

### 3. Implemented Scope
* **Authentication Screens (`app/(auth)/`):**
  * `welcome.tsx` (`SCR-AUTH-001`): Value proposition carousel with 3 feature slides, indicators, and navigation triggers.
  * `login.tsx` (`SCR-AUTH-002`): Email/password inputs with field validation, secure text toggle, biometric unlock trigger, forgot-password navigation, and inline error banner.
  * `register.tsx` (`SCR-AUTH-003`): Role switcher (`pet_parent` vs `vet`), doctor-specific specialty and consultation fee inputs, terms acceptance, validation, and authoritative Supabase registration.
  * `forgot-password.tsx` (`SCR-AUTH-004`): Password recovery email trigger with dedicated confirmation state.
  * `onboarding.tsx` (`SCR-AUTH-005`): Two-step onboarding wizard for profile personalization and first pet or clinic setup with skip support.
* **Application Lifecycle & Gatekeeper (`app/_layout.tsx`, `app/index.tsx`):**
  * Session bootstrap on cold launch with branded splash loader.
  * Realtime `onAuthStateChange` listener synchronizing session and profile state.
  * Route guard protecting `(tabs)`, `vet`, `booking`, `consult`, `pets`, `prescriptions`, `settings` from unauthenticated users.
  * Role-aware routing: routes `pet_parent` to `/(tabs)` and `vet` to `/vet/dashboard`; restricts `pet_parent` from doctor portal.
  * Enforces onboarding completion before granting access to protected dashboards.
* **State & Services (`src/lib/`, `src/store/`):**
  * `useAuthStore`: Enhanced Zustand store tracking `session`, `user`, `role`, `roles`, `onboardingCompleted`, `biometricAvailable`, and `biometricsEnabled`.
  * `authService`: Production methods for `register`, `login`, `signOut`, `requestPasswordReset`, `loadUserProfile`, `refreshSession`, and `completeOnboarding`.
  * `biometrics`: Local biometric hardware detection, enrollment check, and authentication prompts via `expo-local-authentication`.
  * `SecureStorageAdapter`: Custom storage engine for Supabase Auth in React Native.
* **Role Dashboards (`app/vet/dashboard.tsx`, `app/(tabs)/care.tsx`):**
  * `vet/dashboard.tsx`: Doctor portal header displaying verified doctor profile and Sign Out button.
  * `(tabs)/care.tsx`: Pet Parent profile summary card with status badge and Sign Out button.

---

### 4. Dependency Versions Added
```text
expo-secure-store: ~57.0.4
expo-local-authentication: ~57.0.3
```

---

### 5. Automated Verification Results
```text
TypeScript (tsc --noEmit): PASS (0 errors)
ESLint (eslint .): PASS (0 errors, 0 warnings)
Prettier (prettier --check .): PASS (100% compliant)
Jest Unit & Component Tests: PASS (10 suites, 44 tests)
Expo Export (npx expo export --no-bytecode): PASS (iOS, Android, Web)
```

---

### 6. Next Phase
Phase 2 completed.

---

## Phase 3 — MVP-02 Pet Management

**Status:** `COMPLETED`  
**Execution Date:** 2026-09-23  
**Target Environment:** Expo SDK 57 · React Native 0.86 · React 19.x · Supabase PostgreSQL RLS

### 1. Objective
Deliver the complete, production-ready **MVP-02 Pet Management** module on top of the Phase 1 mobile foundation and Phase 2 authentication system, providing pet parents with complete CRUD capabilities over their household pets while enforcing strict database-level Row Level Security (RLS) isolation.

---

### 2. Implemented Scope
* **Database & RLS Hardening (`supabase/migrations/20260923190000_pet_management_security.sql`):**
  * Revoked unauthenticated `SELECT` on `public.pets` from `anon`.
  * Replaced permissive `"pets are publicly viewable"` policy with `"owner reads own pets"` enforcing `USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))`.
  * Verified ownership constraints on INSERT, UPDATE, and DELETE policies.
  * Added `dob text` column supporting birth dates alongside age.
* **Domain Models & Services (`src/types/pet.ts`, `src/lib/pets/petService.ts`):**
  * `Pet`, `CreatePetDTO`, `UpdatePetDTO`, species options (`Dog`, `Cat`, `Bird`, `Rabbit`, `Other`), sex options.
  * `PetService`: CRUD operations (`getPets`, `getPetById`, `createPet`, `updatePet`, `deletePet`) and input validation (`validatePetInput`).
  * `usePets`, `usePet`, `useCreatePet`, `useUpdatePet`, `useDeletePet`: TanStack Query hooks with automatic cache invalidation on mutations.
* **UI Screens & Care Hub (`app/pets/`, `app/(tabs)/care.tsx`):**
  * `app/pets/add.tsx` (`SCR-TAB-005`): Add Pet screen with species/sex chips, biometrics inputs, validation, and error states.
  * `app/pets/edit.tsx`: Edit Pet screen with pre-filled state, validation, and update mutation.
  * `app/pets/[id].tsx`: Pet Details & Health Passport screen with hero card, biometrics grid, clinical notes, edit link, and delete confirmation modal.
  * `app/(tabs)/care.tsx`: Integrated "My Pets" Section with loading indicator, empty state CTA, and list of registered pet cards navigating to pet details.
* **Automated Quality Gates:**
  * `tests/unit/pet-service.test.ts`: Unit tests for validation, CRUD operations, authentication requirements, and RLS ownership isolation.
  * `tests/components/PetScreens.test.tsx`: Component tests for AddPetScreen, PetPassportScreen, and CareScreen My Pets section.

---

### 3. Automated Verification Results
```text
TypeScript (tsc --noEmit): PASS (0 errors)
ESLint (eslint .): PASS (0 errors, 0 warnings)
Prettier (prettier --check .): PASS (100% compliant)
Jest Unit & Component Tests: PASS (13 suites, 72 tests)
Expo Export (npx expo export --no-bytecode): PASS (iOS, Android, Web)
```

---

### 4. Next Phase
Phase 3 completed.

---

## Phase 4 — MVP-03 Veterinarian Discovery

**Status:** `COMPLETED`  
**Execution Date:** 2026-09-24  
**Target Environment:** Expo SDK 57 · React Native 0.86 · React 19.x · Supabase PostgreSQL RLS

### 1. Objective
Deliver the complete, production-ready **MVP-03 Veterinarian Discovery** module on top of the established Phase 1–3 mobile foundation, allowing pet parents to search and filter certified veterinarians across 12 specialties and 11 languages, view doctor credentials, and inspect 14-day bookable availability slots while strictly preserving the Phase 5 (MVP-04 Appointments) boundary.

---

### 2. Implemented Scope
* **Domain Models & Constants (`src/types/vet.ts`):**
  * `VetProfile`, `VetAvailability`, `TimeSlot`, `DaySchedule`, `VetFilterParams`.
  * Authoritative constants: 12 specialties (`VET_SPECIALTIES`), 11 languages (`VET_LANGUAGES`), countries (`VET_COUNTRIES`), consultation price filters (`VET_PRICE_OPTIONS`).
* **Service Layer & 14-Day Slot Generator (`src/lib/vets/vetService.ts`):**
  * `VetService.getVets()`: Database queries against `public.vet_profiles` with text search (`q` matching name/specialty), specialty filter, language filter, country filter, max price filter, and accepting status.
  * Empty query alternative behavior: returns top-rated doctors currently accepting consults.
  * `VetService.getVetById()`: Fetches single verified doctor profile.
  * `buildSlots()`: Pure function generating 14-day bookable consultation slots from `public.vet_availability` minus existing scheduled `public.appointments`, omitting past slots and slots within a 15-minute advance buffer.
  * `VetService.getVetSchedule()`: Fetches availability windows and appointments to generate live slots.
* **TanStack Query Hooks (`src/hooks/useVets.ts`):**
  * `useVets()`: Server-state hook with 5-minute cache and query invalidation.
  * `useVet()`: Doctor profile query hook.
  * `useVetSchedule()`: 14-day live bookable slots query hook.
* **Reusable UI Components (`src/components/vets/`):**
  * `VetCard.tsx`: Doctor card with avatar, name, verified badge, specialty, nationality flag, rating & review count, languages, consultation fee, and accepting status indicator.
  * `VetFilterSheet.tsx`: Bottom sheet filter modal covering specialty, language, country, max fee, and availability status with Reset and Apply actions.
* **Authoritative Screens (`app/(tabs)/vets.tsx`, `app/booking/[vetId].tsx`):**
  * `app/(tabs)/vets.tsx` (`SCR-TAB-002`): Find a Vet directory screen with sticky search, filter modal trigger with active filter counter badge, horizontal specialty chip scroll, active filter dismissal pills, pull-to-refresh, skeleton loading state, error retry state, empty state with filter reset, and card navigation.
  * `app/booking/[vetId].tsx` (`SCR-BOOK-001` / `FR-VET-002`): Doctor Profile & Live Slots screen displaying biography, license verification badge, rating, reviews, fee, timezone, 14-day date selector strip, time slots grid, disabled "Currently Not Accepting Bookings" state, and strict Phase 5 boundary alert on booking CTA.
* **Automated Quality Gates:**
  * `tests/unit/vet-service.test.ts`: Unit tests for `buildSlots`, past slot omission, booked appointment omission (`test_exclude_booked_slots`), text search query (`test_vet_search_query`), specialty filter (`test_vet_filter_specialty`), language/country/price filters, and security verification.
  * `tests/components/VetScreens.test.tsx`: Component tests for `VetCard`, `VetDirectoryScreen`, and `VetProfileScreen` verifying all UI states, slot selection, not-accepting state, and Phase 5 booking boundary.

---

### 3. Automated Verification Results
```text
TypeScript (tsc --noEmit): PASS (0 errors)
ESLint (eslint .): PASS (0 errors, 0 warnings)
Prettier (prettier --check .): PASS (100% compliant)
Jest Unit & Component Tests: PASS (15 suites, 104 tests)
Expo Export (npx expo export --no-bytecode): PASS (iOS, Android, Web - 32 static routes)
```

---

---

### 4. Phase 5 Implementation Complete — MVP-04 Appointments & Scheduling
* **Implementation Status:** COMPLETE (Strict adherence to FR-BOOK-001 and FR-BOOK-002; zero Phase 6+ features introduced).
* **Delivered Artifacts:**
  * `supabase/migrations/20260925130000_appointments_booking.sql`: Added `pet_id REFERENCES public.pets(id) ON DELETE SET NULL`, `updated_at`, partial unique index `appointments_vet_scheduled_slot_idx` (`WHERE status = 'scheduled'`), atomic reservation RPC `public.book_appointment`, and cancellation RPC `public.cancel_appointment`.
  * `src/types/appointment.ts`: Comprehensive domain types (`Appointment`, `AppointmentMode`, `AppointmentStatus`, `AppointmentUrgency`, `BookAppointmentDTO`, `BookingConfirmation`).
  * `src/lib/appointments/appointmentService.ts`: Direct Supabase client + RPC service implementing `bookAppointment`, `getMyAppointments`, `getAppointmentById`, and `cancelAppointment`.
  * `src/hooks/useAppointments.ts`: TanStack Query hooks with automatic cache invalidation (`useAppointments`, `useAppointment`, `useBookAppointment`, `useCancelAppointment`).
  * `src/components/appointments/AppointmentCard.tsx`: Reusable consultation card with doctor info, patient snapshot, format badge, status pill, fee, and cancellation trigger.
  * `app/booking/[vetId].tsx`: Multi-step booking wizard: Step 1 (Schedule & slot selection), Step 2 (Pet selection & consultation format), Step 3 (Clinical intake: symptoms, urgency, phone), Step 4 (Summary review & confirm CTA), Step 5 (Confirmed receipt with confirmation ID and navigation CTAs). HTTP 409 conflict handling displays "Slot just taken. Please select another time." and resets to Step 1.
  * `app/(tabs)/appointments.tsx`: Consultations hub with segmented tabs (Upcoming vs. Past Consultations), cancellation modal with 2-hour policy disclosure, skeleton loading, pull-to-refresh, empty state with directory navigation CTA.
* **Automated Verification Results:**
```text
TypeScript (tsc --noEmit): PASS (0 errors)
ESLint (eslint .): PASS (0 errors, 0 warnings)
Prettier (prettier --check .): PASS (100% compliant)
Jest Unit & Component Tests: PASS (18 suites, 151 tests)
Expo Export (npx expo export --no-bytecode): PASS (iOS, Android, Web - 32 static routes)
```

---

### 5. Phase 6 Implementation Complete — MVP-05 Telemedicine Consultations
* **Implementation Status:** `CLOSED / COMPLETED`
* **Execution Date:** 2026-09-25
* **Target Environment:** Expo SDK 57 · React Native 0.86 · React 19.x · LiveKit Cloud Managed RTC SFU
* **Delivered Scope:**
  * `supabase/migrations/20260925200000_telemedicine_completion.sql`: Implemented `public.complete_appointment` `SECURITY DEFINER` RPC with `SET search_path = public`. Strictly authorizes the assigned consulting veterinarian (`v_vet.user_id = auth.uid()`), checks `scheduled` status, and atomically marks appointment `completed`.
  * `src/server/telemedicineTokenHandler.ts` & `src/server/server.ts`: Server-side token generator (`POST /api/v1/telemedicine/token`) using `livekit-server-sdk`. Authenticates Supabase session, verifies appointment participant ownership, enforces T-15m timing window, deterministically generates room name (`vetopia-consult-{id}`) and identity (`user_{id}`), and signs short-lived LiveKit JWT. Server secrets (`LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`) are never exposed to client.
  * `src/lib/telemedicine/telemedicineService.ts`: Telemedicine service handling token request, T-15m client-side eligibility guard, and consultation completion orchestration.
  * `src/lib/appointments/appointmentService.ts` & `src/hooks/useAppointments.ts`: Added `completeAppointment` RPC caller and `useCompleteAppointment` mutation with automatic React Query cache invalidation.
  * `src/components/telemedicine/CallControls.tsx`: Hardware control dock for microphone mute, camera privacy toggle, camera flip, speakerphone toggle, and red end-call button.
  * `src/components/telemedicine/WaitingRoomView.tsx` (`FR-TELE-001`): Waiting room with doctor details, pet info, scheduled time, local camera preview, device check, waiting status banner ("Waiting for Doctor to admit you..." / "Patient is in the Waiting Room"), and "Enter Consultation Room" CTA.
  * `src/components/telemedicine/ActiveCallView.tsx` (`FR-TELE-002`): Fullscreen remote participant view, floating local PiP window, live duration timer, encryption badge, and 20-second automatic reconnection overlay with retry CTA.
  * `app/consult/[id].tsx`: Composed consultation screen managing lifecycle states (loading, ineligible/expired, waiting_room, connecting, connected, ended), native camera/mic permission handling, and role-differentiated exit flows (Vet: End & Mark Completed; Pet Parent: Leave Room without completion).
  * `src/components/appointments/AppointmentCard.tsx`: Integrated "Enter Room" CTA for scheduled appointments routing to `/consult/[id]`.
* **Automated Verification Results:**
```text
TypeScript (tsc --noEmit): PASS (0 errors)
ESLint (eslint .): PASS (0 errors, 0 warnings)
Prettier (prettier --check .): PASS (100% compliant)
Jest Unit & Component Tests: PASS (21 suites, 187 tests)
Expo Export (npx expo export --no-bytecode): PASS (iOS, Android, Web - 32 static routes)
```

---

### 6. Phase 7 Implementation Complete — MVP-06 Digital Prescriptions
* **Implementation Status:** `CLOSED / COMPLETED`
* **Execution Date:** 2026-09-26
* **Target Environment:** Expo SDK 57 · React Native 0.86 · React 19.x · `expo-print` · `expo-sharing` · Supabase Auth / PostgreSQL RLS
* **Delivered Scope:**
  * `supabase/migrations/20260926120000_prescriptions_schema.sql`: Implemented `public.prescriptions` and `public.prescription_items` tables with `UNIQUE (appointment_id)` constraint, clinical foreign keys, RLS policies (pet owner, authoring vet, admin select; client direct writes revoked), and `public.create_prescription` `SECURITY DEFINER` RPC.
  * `src/types/prescription.ts`: Comprehensive domain types (`Prescription`, `PrescriptionItem`, `CreatePrescriptionDTO`, `CreatePrescriptionItemDTO`, `CreatePrescriptionResponse`).
  * `src/lib/prescriptions/prescriptionService.ts`: Direct Supabase client + RPC service implementing `createPrescription`, `getPrescriptionById`, `getPrescriptionsByPetId`, and `getPrescriptionByAppointmentId`.
  * `src/hooks/usePrescriptions.ts`: TanStack Query hooks with automatic cache invalidation (`usePrescription`, `useAppointmentPrescription`, `usePetPrescriptions`, `useCreatePrescription`).
  * `src/lib/prescriptions/prescriptionPdf.ts`: Authoritative HTML generator and PDF export pipeline via `expo-print` and `expo-sharing` featuring Vetopia branding, patient snapshot, prescribing veterinarian verification, structured medication table, refills, electronic signature, and clinical disclaimer.
  * `src/components/prescriptions/`:
    * `MedicationItemRow.tsx`: Line item row displaying drug name, dosage badge, schedule, duration, instructions, and remove action.
    * `MedicationFormModal.tsx`: Modal form for adding/editing medication items with validation and key-based unmount lifecycle.
    * `PrescriptionCard.tsx`: Reusable summary card with status badge, doctor name, medication counter, refill count, and details navigation.
  * `app/consult/[id]/prescription.tsx` (`SCR-PRES-001` / `FR-PRES-001`): Authoritative doctor prescription authoring screen with completed appointment precondition guard, consultation context card, diagnosis input, notes, refills stepper, dynamic medication list, and single-prescription mutation handling.
  * `app/prescriptions/[id].tsx` (`SCR-PRES-002` / `FR-PRES-002`): Structured prescription detail screen with PDF export trigger, doctor credential card, patient biometrics card, medication regimen, and digital signature representation.
  * **Integration Points:**
    * `src/components/appointments/AppointmentCard.tsx`: Completed consultations display "Create Prescription" (for consulting doctor when no prescription issued) or "View Prescription" (when prescription exists).
    * `app/consult/[id].tsx`: Concluding consultation alert offers veterinarian immediate "Create Prescription" navigation.
    * `app/pets/[id].tsx`: Pet Health Passport displays active digital prescriptions with count badge and `PrescriptionCard` list.
* **Automated Verification Results:**
```text
TypeScript (tsc --noEmit): PASS (0 errors)
ESLint (eslint .): PASS (0 errors, 0 warnings)
Prettier (prettier --check .): PASS (100% compliant)
Jest Unit & Component Tests: PASS (23 suites, 222 tests)
Expo Export (npx expo export --no-bytecode): PASS (iOS, Android, Web - 33 static routes)
```

---

### 7. Next Phase
**Phase 8 — MVP-07 Direct Messaging**  
*Scope:* Asynchronous 1-to-1 P2P messaging channels, conversation threads between pet parents and veterinarians, unread counters, Supabase Realtime channel subscriptions, and offline message queue (`SCR-TAB-004`, `SCR-MSG-001`, `FR-MSG-001`). Push notifications infrastructure and AI triage remain deferred.



