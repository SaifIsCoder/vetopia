# Requirements Traceability Matrix — Vetopia Mobile MVP

This matrix maps every functional requirement (from `01-product/SRS.md`) to its corresponding UI screen, backend REST API endpoint, database entities, and verification test case.

---

## 1. Master Traceability Matrix

| Requirement ID | Screen ID & Route | API Endpoint | Database Table(s) | Automated Test Case |
| :--- | :--- | :--- | :--- | :--- |
| **`FR-AUTH-001`** (Registration) | `SCR-AUTH-003`<br>`app/(auth)/register.tsx`<br>`app/(auth)/onboarding.tsx` | Supabase `auth.signUp`<br>`public.profiles.upsert`<br>`public.user_roles.insert` | `auth.users`<br>`public.profiles`<br>`public.user_roles`<br>`public.vet_profiles` | `tests/unit/auth-service.test.ts`<br>`tests/unit/auth-store.test.ts`<br>`tests/components/AuthScreens.test.tsx` |
| **`FR-AUTH-002`** (Login & Biometrics)| `SCR-AUTH-002`<br>`app/(auth)/login.tsx`<br>`app/(auth)/welcome.tsx` | Supabase `auth.signInWithPassword`<br>`expo-local-authentication` | `auth.users`<br>`public.profiles`<br>`public.user_roles` | `tests/unit/auth-service.test.ts`<br>`tests/unit/biometrics.test.ts`<br>`tests/components/AuthScreens.test.tsx` |
| **`FR-AUTH-003`** (Session Refresh) | Background Interceptor<br>`src/lib/api/client.ts` | Supabase `auth.refreshSession`<br>`expo-secure-store` | `auth.users` | `tests/unit/api-client-auth.test.ts`<br>`tests/unit/auth-store.test.ts` |
| **`FR-PET-001`** (Register Pet) | `SCR-TAB-005`<br>`app/pets/add.tsx`<br>`app/(auth)/onboarding.tsx` | Supabase `public.pets.insert`<br>`useCreatePet` | `public.pets` | `tests/unit/pet-service.test.ts`<br>`tests/components/PetScreens.test.tsx` |
| **`FR-PET-002`** (Health Passport & CRUD) | `SCR-TAB-005` (Pet List)<br>`app/(tabs)/care.tsx`<br>`app/pets/[id].tsx`<br>`app/pets/edit.tsx` | Supabase `public.pets`<br>`select`, `update`, `delete`<br>`usePets`, `usePet`, `useUpdatePet`, `useDeletePet` | `public.pets` | `tests/unit/pet-service.test.ts`<br>`tests/components/PetScreens.test.tsx` |
| **`FR-VET-001`** (Doctor Directory) | `SCR-TAB-002`<br>`app/(tabs)/vets.tsx` | `GET /api/v1/vets` | `public.vet_profiles` | `test_vet_filter_specialty`<br>`test_vet_search_query` |
| **`FR-VET-002`** (Doctor Profile & Slots)| `SCR-BOOK-001`<br>`app/booking/[vetId].tsx` | `GET /api/v1/vets/:id`<br>`GET /api/v1/vets/:id/schedule` | `public.vet_profiles`<br>`public.vet_availability`<br>`public.appointments` | `test_slot_generator_build_slots`<br>`test_exclude_booked_slots` |
| **`FR-BOOK-001`** (Book Consultation) | `SCR-BOOK-001`<br>`app/booking/[vetId].tsx` | `POST /api/v1/appointments` | `public.appointments` | `test_appointment_booking_success`<br>`test_appointment_slot_race_409` |
| **`FR-BOOK-002`** (Manage / Cancel Appt)| `SCR-TAB-003`<br>`app/(tabs)/appointments.tsx` | `PUT /api/v1/appointments/:id/cancel` | `public.appointments` | `test_appointment_cancel_authorized`<br>`test_cancel_non_participant_403` |
| **`FR-TELE-001`** (Waiting Room & Dev) | `SCR-TELE-001`<br>`app/consult/[id].tsx` | `GET /api/v1/appointments/:id` | `public.appointments` | `test_waiting_room_permissions` |
| **`FR-TELE-002`** (WebRTC P2P Call) | `SCR-TELE-001`<br>`app/consult/[id].tsx` | Supabase Realtime Channel | `public.call_signals` | `test_webrtc_signaling_exchange`<br>`test_webrtc_connection_state` |
| **`FR-TELE-003`** (End & Complete Call)| `SCR-TELE-001`<br>`app/consult/[id].tsx` | `PUT /api/v1/appointments/:id/complete` | `public.appointments`<br>`public.call_signals` | `test_consult_complete_status_change` |
| **`FR-PRES-001`** (Issue Prescription)| `SCR-PRES-001`<br>`app/consult/[id]/prescription.tsx` | `POST /api/v1/prescriptions` | `public.prescriptions`<br>`public.prescription_items` | `test_prescription_create_vet_only`<br>`test_prescription_parent_reject_403` |
| **`FR-PRES-002`** (View Prescription) | `SCR-PRES-001`<br>`app/prescriptions/[id].tsx` | `GET /api/v1/prescriptions/:id` | `public.prescriptions`<br>`public.prescription_items` | `test_prescription_parent_read_own`<br>`test_prescription_unauthorized_403` |
| **`FR-MSG-001`** (1-to-1 Messaging) | `SCR-TAB-004`<br>`app/messages/[id].tsx` | `POST /api/v1/conversations/:id/messages` | `public.conversations`<br>`public.direct_messages` | `test_message_realtime_delivery`<br>`test_message_unread_counter` |
| **`FR-AI-001`** (24/7 AI Triage) | `SCR-AI-001`<br>`app/ai/chat.tsx` | `POST /api/v1/ai/triage-chat` | External Google Gemini | `test_ai_triage_streaming`<br>`test_ai_red_flag_emergency_detected` |
| **`FR-NOTIF-001`** (Push Alerts) | Native Tray -> Universal Links | `POST /api/v1/notifications/token` | `public.notifications`<br>`public.device_tokens` | `test_push_dispatch_on_booking`<br>`test_deep_link_resolution` |

---

## 2. Traceability Verification & Gap Audit

* **Completeness Check:** 100% of functional requirements defined in `01-product/SRS.md` have mapped UI screens, backend endpoints, database tables, and automated test cases.
* **Schema Gaps Identified & Resolved:**
  * `public.prescriptions` and `public.prescription_items` are required for `FR-PRES-001` and `FR-PRES-002` (documented in `05-database/database-design.md`).
  * `public.notifications` and `public.device_tokens` are required for `FR-NOTIF-001` (documented in `05-database/database-design.md`).
  * `public.appointments` has an added foreign key `pet_id` referencing `public.pets(id)` to link prescriptions to specific pets.
