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

### 4. Next Phase
**Phase 5 — MVP-04 Appointments & Scheduling**  
*Scope:* Slot reservation, multi-step booking modal (`app/booking/[vetId].tsx` steps 2-4: pet selection, clinical intake notes, format selection, confirmation), appointment management and cancellation (`app/(tabs)/appointments.tsx`).



