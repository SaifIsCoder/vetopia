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
| **`FR-BOOK-001`** (Book Consultation) | `SCR-BOOK-001`<br>`app/booking/[vetId].tsx` | Supabase RPC `book_appointment`<br>`appointmentService.bookAppointment`<br>`useBookAppointment` | `public.appointments`<br>`public.pets`<br>`public.vet_profiles` | `tests/unit/appointment-service.test.ts`<br>`tests/unit/appointment-security-concurrency.test.ts`<br>`tests/components/AppointmentScreens.test.tsx` |
| **`FR-BOOK-002`** (Manage / Cancel Appt)| `SCR-TAB-003`<br>`app/(tabs)/appointments.tsx` | Supabase RPC `cancel_appointment`<br>`appointmentService.getMyAppointments`<br>`appointmentService.cancelAppointment` | `public.appointments`<br>`public.vet_profiles` | `tests/unit/appointment-service.test.ts`<br>`tests/unit/appointment-security-concurrency.test.ts`<br>`tests/components/AppointmentScreens.test.tsx` |
| **`FR-TELE-001`** (Waiting Room & Device Check) | `SCR-TELE-001`<br>`app/consult/[id].tsx` | Supabase `getAppointmentById`<br>`telemedicineService.checkEligibility` | `public.appointments`<br>`public.vet_profiles`<br>`public.pets` | `tests/components/TelemedicineScreens.test.tsx` |
| **`FR-TELE-002`** (LiveKit Cloud Managed RTC) | `SCR-TELE-001`<br>`app/consult/[id].tsx` | `POST /api/v1/telemedicine/token`<br>LiveKit Cloud Managed SFU | LiveKit Server SDK / Cloud<br>(No media in DB) | `tests/unit/telemedicine-token-security.test.ts`<br>`tests/components/TelemedicineScreens.test.tsx` |
| **`FR-TELE-003`** (End & Complete Consultation)| `SCR-TELE-001`<br>`app/consult/[id].tsx` | Supabase RPC `complete_appointment`<br>`appointmentService.completeAppointment` | `public.appointments`<br>`public.vet_profiles` | `tests/unit/telemedicine-completion-security.test.ts`<br>`tests/components/TelemedicineScreens.test.tsx` |
| **`FR-PRES-001`** (Issue Prescription)| `SCR-PRES-001`<br>`app/consult/[id]/prescription.tsx` | Supabase RPC `public.create_prescription`<br>`prescriptionService.createPrescription`<br>`useCreatePrescription` | `public.prescriptions`<br>`public.prescription_items`<br>`public.appointments`<br>`public.pets` | `tests/unit/prescription-security.test.ts`<br>`tests/components/PrescriptionScreens.test.tsx` |
| **`FR-PRES-002`** (View & PDF Prescription) | `SCR-PRES-002`<br>`app/prescriptions/[id].tsx`<br>`app/pets/[id].tsx` | Supabase RLS `getPrescriptionById`<br>`expo-print` & `expo-sharing` PDF generator<br>`usePrescription`, `usePetPrescriptions` | `public.prescriptions`<br>`public.prescription_items`<br>`public.pets`<br>`public.vet_profiles` | `tests/unit/prescription-security.test.ts`<br>`tests/components/PrescriptionScreens.test.tsx` |
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
