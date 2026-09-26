# Screen Specifications — Vetopia Mobile MVP

This document specifies every screen included in the **Vetopia Mobile MVP**. All non-MVP screens (community feeds, adoption marketplaces, farm registries) are excluded.

---

## 1. Authentication & Onboarding Module

### Screen `SCR-AUTH-001`: Welcome / Splash Screen
* **File Path:** `mobile/app/(auth)/welcome.tsx`
* **Purpose:** Introduce the Vetopia value proposition ("Online Vet in Your Language", "24/7 AI Triage", "Digital Pet Passport") and offer entry into login or registration.
* **Allowed Roles:** Unauthenticated
* **Entry Points:** App cold launch when no active session exists.
* **Exit Points:** `LoginScreen`, `RegisterScreen`.
* **UI Structure:**
  * Top: Brand logo (`The Pets Club / Vetopia`).
  * Center: Auto-scrolling carousel with 3 hero illustrations and benefit statements.
  * Bottom: "Get Started" (Primary Lime Button), "I already have an account" (Ghost Button), and "Sign in with Google" button.
* **State:** Active carousel slide index (`useState(0)`).
* **API Dependencies:** None.
* **Permissions:** None.
* **Accessibility:** Accessible carousel with page indicators announced by voiceover.
* **Related Requirements:** `FR-AUTH-001`, `FR-AUTH-002`.

---

### Screen `SCR-AUTH-002`: Login Screen
* **File Path:** `mobile/app/(auth)/login.tsx`
* **Purpose:** Authenticate existing pet parents and veterinarians using email/password or local biometrics.
* **Allowed Roles:** Unauthenticated
* **Entry Points:** `WelcomeScreen`, deep link to protected route.
* **Exit Points:** `HomeScreen` (on success), `ForgotPasswordScreen`, `RegisterScreen`.
* **UI Structure:**
  * Header: Back button, screen title "Welcome Back".
  * Body: Email Input, Password Input (with secure entry toggle), "Forgot Password?" text link.
  * Bottom: Primary "Sign In" Button, Biometric icon button (Face ID / Fingerprint).
* **State:** `email`, `password`, `isSubmitting`, `biometricAvailable`.
* **Validation:** Email format (`z.string().email()`), Password non-empty.
* **API Dependencies:** `POST /api/v1/auth/login`.
* **Loading State:** Button displays activity spinner, inputs disabled.
* **Error State:** Red inline error banner for invalid credentials or locked account.
* **Related Requirements:** `FR-AUTH-002`.

---

### Screen `SCR-AUTH-003`: Registration Screen
* **File Path:** `mobile/app/(auth)/register.tsx`
* **Purpose:** Create a new user account with initial role designation.
* **Allowed Roles:** Unauthenticated
* **Entry Points:** `WelcomeScreen`, `LoginScreen`.
* **Exit Points:** `OnboardingScreen` (on success), `LoginScreen`.
* **UI Structure:**
  * Header: Back button, screen title "Join The Pets Club".
  * Role Switcher: Segmented cards for "Pet Parent" (Book & consult) vs "Veterinarian" (Provide care).
  * Form Fields: Full Name, Email, Password, Confirm Password.
  * Vet-Specific Fields (if Vet selected): Primary Specialty dropdown, Consultation Price (USD).
  * Terms & Privacy checkbox.
  * Bottom: "Create Account" Primary Button.
* **Validation:** Full Name min 2 chars, Email valid, Password min 6 chars with confirmation match.
* **API Dependencies:** `POST /api/v1/auth/register`.
* **Database Dependencies:** `auth.users`, `public.profiles`, `public.user_roles`, `public.vet_profiles`.
* **Related Requirements:** `FR-AUTH-001`.

---

### Screen `SCR-AUTH-004`: Onboarding Wizard
* **File Path:** `mobile/app/(auth)/onboarding.tsx`
* **Purpose:** Guide newly registered users through initial profile photo upload and first pet registration.
* **Allowed Roles:** `pet_parent`, `vet` with `profile.onboarded == false`.
* **Entry Points:** Automatic redirect following successful registration.
* **Exit Points:** `HomeScreen` (`app/(tabs)/index.tsx`).
* **UI Structure:**
  * Progress Bar: Step 1 (Profile & Avatar) -> Step 2 (Register First Pet) -> Complete.
  * Step 1: Avatar image picker (Camera or Gallery), Username field (`^[a-z0-9_.]{3,24}$`), Location.
  * Step 2: Pet Name, Species (Dog/Cat/Bird/Other), Breed, Age, Weight, Photo.
  * Action: "Skip for now" link vs "Complete Setup" button.
* **API Dependencies:** `POST /api/v1/users/onboarding`, `POST /api/v1/pets`.
* **Permissions:** Camera and photo library permissions (`expo-image-picker`).
* **Related Requirements:** `FR-AUTH-001`, `FR-PET-001`.

---

## 2. Core Bottom Tab Screens

### Screen `SCR-TAB-001`: Home Dashboard Screen
* **File Path:** `mobile/app/(tabs)/index.tsx`
* **Purpose:** Daily hub for pet parents and doctors. Offers instant emergency triage, upcoming appointments, and quick booking access.
* **Allowed Roles:** `pet_parent`, `vet`.
* **Entry Points:** Bottom Tab Bar (Tab 1), default post-login route.
* **Exit Points:** `ConsultRoomScreen`, `VetDirectoryScreen`, `AIChatbotScreen`, `PetPassportScreen`.
* **UI Structure:**
  * Top Bar: Greeting ("Good morning, Sarah"), Active consultation beacon (if consult within 15m), notification bell.
  * Emergency Triage Banner: High-contrast red/lime banner: "24/7 AI Pet Triage — Instant Symptoms Assessment".
  * "My Pets" Quick Strip: Horizontal avatar row of registered pets with health status dots. Plus button to add pet.
  * Upcoming Consultations Card: Next scheduled appointment countdown with direct "Join Room" button.
  * Quick-Book Veterinarians Carousel: Doctors currently online and accepting consults in < 15 mins.
* **State:** Server state via TanStack Query (`dashboardQuery`).
* **Loading State:** Skeleton shimmer cards for upcoming appointments and doctor carousel.
* **Empty State:** If no pets registered, displays "Add your pet to get customized health reminders".
* **API Dependencies:** `GET /api/v1/home/dashboard`.
* **Related Requirements:** `FR-BOOK-001`, `FR-VET-001`, `FR-AI-001`.

---

### Screen `SCR-TAB-002`: Vet Directory Screen
* **File Path:** `mobile/app/(tabs)/vets.tsx`
* **Purpose:** Search, filter, and discover certified veterinarians across 11 languages and 12 specialties.
* **Allowed Roles:** All users.
* **Entry Points:** Bottom Tab Bar (Tab 2), "Browse All Vets" buttons.
* **Exit Points:** `VetProfileScreen`, `BookingModalScreen`.
* **UI Structure:**
  * Search Header: Sticky search input with debounced text matching.
  * Horizontal Filter Chips: Specialty pills (All, General, Dermatology, Surgery, Cardiology, etc.), Language dropdown, Country flag filter.
  * Doctor FlashList:
    * Card: Avatar, verified shield badge, nationality flag, full name, specialty subtitle.
    * Metadata: Star rating, review count, languages spoken, next available slot badge.
    * Price & Action: Consultation price (USD/localized), "Book Consult" button.
* **State:** `searchQuery`, `selectedSpecialty`, `selectedLanguage`, `maxPrice`.
* **Empty State:** "No veterinarians match your filters. Try clearing some criteria." with Reset button.
* **API Dependencies:** `GET /api/v1/vets`.
* **Database Dependencies:** `public.vet_profiles`.
* **Related Requirements:** `FR-VET-001`.

---

### Screen `SCR-TAB-003`: Appointments Hub Screen
* **File Path:** `mobile/app/(tabs)/appointments.tsx`
* **Purpose:** Manage active, upcoming, and past veterinary consultations.
* **Allowed Roles:** `pet_parent`, `vet`.
* **Entry Points:** Bottom Tab Bar (Tab 3), consultation push notification taps.
* **Exit Points:** `ConsultRoomScreen`, `PrescriptionDetailScreen`, `BookingModalScreen`.
* **UI Structure:**
  * Segmented Control Header: "Upcoming" (with count badge) | "Past Consultations".
  * Upcoming Appointments List:
    * Card: Date & time chip, doctor avatar & name, pet name & species tag, format badge (Video/Audio/Chat).
    * Action Row: "Join Room" (Primary Lime button, enabled 15m prior to call), "Cancel" text button.
  * Past Consultations List:
    * Card: Completed date, doctor name, status pill (`completed` or `cancelled`).
    * Action Row: "View Prescription" button (if script issued), "Consultation Summary".
* **Empty State (Upcoming):** "No upcoming consultations scheduled." with "Find a Vet" CTA button.
* **API Dependencies:** `GET /api/v1/appointments`.
* **Database Dependencies:** `public.appointments`, `public.vet_profiles`, `public.prescriptions`.
* **Related Requirements:** `FR-BOOK-002`, `FR-TELE-001`.

---

### Screen `SCR-TAB-004`: Clinical Messages Inbox Screen
* **File Path:** `mobile/app/(tabs)/messages.tsx`
* **Purpose:** 1-to-1 asynchronous messaging inbox between pet parents and consulting veterinarians.
* **Allowed Roles:** `pet_parent`, `vet`.
* **Entry Points:** Bottom Tab Bar (Tab 4).
* **Exit Points:** `MessageThreadScreen`.
* **UI Structure:**
  * Header: "Messages", unread messages badge.
  * Inbox FlashList:
    * Thread Item: Counterpart avatar (Doctor or Pet Parent), Counterpart name, last message preview snippet, timestamp, unread count pill.
* **Empty State:** "No conversations yet. When you book a consult or reach out to a vet, your chats appear here."
* **API Dependencies:** `GET /api/v1/conversations`.
* **Database Dependencies:** `public.conversations`, `public.direct_messages`.
* **Related Requirements:** `FR-MSG-001`.

---

### Screen `SCR-TAB-005`: Care Hub & Profile Screen
* **File Path:** `mobile/app/(tabs)/care.tsx`
* **Purpose:** Centralized repository for pet health passports, prescription history, AI assistant entry, and account settings.
* **Allowed Roles:** `pet_parent`, `vet`.
* **Entry Points:** Bottom Tab Bar (Tab 5).
* **Exit Points:** `PetPassportScreen`, `AddPetScreen`, `PrescriptionDetailScreen`, `AIChatbotScreen`, `VetDashboardScreen`, `SettingsScreen`.
* **UI Structure:**
  * User Card: Avatar, user full name, email, role badge (`Pet Parent` or `Verified Vet`).
  * "My Pets" Section:
    * Pet Cards: Photo thumbnail, pet name, breed, age, weight. Plus card to "Register Another Pet".
  * Quick Links List:
    * "Digital Prescriptions Archive" (Shows count of active prescriptions).
    * "24/7 AI Veterinary Assistant".
    * "Vet Provider Dashboard" (Rendered conditionally if user has `vet` role).
    * "Account Settings & Security" (Biometrics, language, notifications).
    * "Log Out" button.
* **API Dependencies:** `GET /api/v1/pets`, `GET /api/v1/users/me`.
* **Database Dependencies:** `public.profiles`, `public.pets`, `public.user_roles`.
* **Related Requirements:** `FR-PET-001`, `FR-PET-002`.

---

## 3. Telemedicine & Detail Modal Screens

### Screen `SCR-TELE-001`: Telemedicine Consultation Room
* **File Path:** `mobile/app/consult/[id].tsx`
* **Purpose:** End-to-end WebRTC video/audio/chat consultation room with hardware media toggles.
* **Allowed Roles:** Appointment participants only (`pet_parent_id` or `vet.user_id`).
* **Entry Points:** "Join Room" CTA from Home, Appointments, or deep link.
* **Exit Points:** Return to `AppointmentsScreen` upon call end.
* **UI Structure:**
  * Top Bar: Doctor name/pet name, call duration timer (`00:14:22`), encrypted lock badge.
  * Main Viewport:
    * Full-Screen: Remote video stream (Peer's camera).
    * Floating PiP Window: Local video preview (drag-draggable across corners).
    * Waiting Room Banner: "Waiting for other participant to connect..."
  * Controls Dock (Floating Bottom Bar):
    * Mic Toggle (Mute/Unmute).
    * Camera Toggle (Video On/Off).
    * Camera Flip (Front/Rear camera).
    * Speakerphone Toggle (Earpiece/Speaker).
    * In-Call Chat Overlay Trigger (Opens sliding text panel).
    * End Call Button (Prominent Red Circular Button).
  * Post-Call Drawer (For Vet only): "Complete Consult & Write Prescription".
* **State:** `callState` (`waiting`, `connecting`, `connected`, `ended`), `micMuted`, `cameraOff`, `isFrontCamera`.
* **Permissions:** Mandatory camera and microphone access (`expo-camera`, WebRTC audio tracks).
* **Network Error State:** "Connection interrupted. Reconnecting..." with auto ICE restart.
* **API / Realtime:** Supabase `call_signals` channel, `PUT /api/v1/appointments/:id/complete`.
* **Related Requirements:** `FR-TELE-001`, `FR-TELE-002`, `FR-TELE-003`.

---

### Screen `SCR-BOOK-001`: Multi-Step Booking Modal
* **File Path:** `mobile/app/booking/[vetId].tsx`
* **Purpose:** Multi-step reservation wizard for scheduling a telemedicine appointment.
* **Allowed Roles:** `pet_parent`.
* **Entry Points:** "Book Consultation" CTA from doctor profile or directory.
* **Exit Points:** Confirmed receipt screen, dismiss modal.
* **UI Structure:**
  * Step 1: Calendar date selector (14-day strip) + time slot grid.
  * Step 2: Pet selection (Choose from registered pets) + consultation format picker (Video, Audio, Chat).
  * Step 3: Clinical intake form (Describe symptoms, duration, current medications, urgency).
  * Step 4: Price summary, cancellation policy disclosure, and "Confirm & Pay" button.
* **API Dependencies:** `GET /api/v1/vets/:id/schedule`, `POST /api/v1/appointments`.
* **Related Requirements:** `FR-BOOK-001`.

---

### Screen `SCR-PRES-001`: Create Digital Prescription Screen
* **File Path:** `mobile/app/consult/[id]/prescription.tsx`
* **Purpose:** Authoritative form for consulting veterinarians to issue a structured digital prescription upon consultation completion.
* **Allowed Roles:** Authenticated Consulting Veterinarian (`isVet = true`, `appointment.vet_id = vetProfile.id`).
* **Precondition:** Appointment status must be `completed`.
* **Entry Points:** Post-consultation alert CTA ("Create Prescription"), Appointments Hub completed card CTA.
* **UI Structure:**
  * Header: Title, subtitle, back/cancel navigation.
  * Consultation Context Banner: Patient snapshot (name, species, breed), consultation date, doctor name, completed status badge.
  * Clinical Assessment Section: Primary Diagnosis (required text input), Clinical Notes & Advice (multiline text area), Refills Allowed (integer input).
  * Medication Regimen Section: Heading with drug counter, "Add Drug" button, dynamic `MedicationItemRow` list with Edit and Remove actions, empty placeholder card.
  * Regulatory Disclaimer: Controlled substances (Schedules II–V) exclusion statement.
  * Action Bar: "Issue Digital Prescription" primary button (with loading spinner and double-submission protection).
  * Modal: `MedicationFormModal` for inputting drug name, dosage/strength, frequency, duration, and instructions.
* **API / Database Dependencies:** `public.create_prescription` RPC, `public.prescriptions`, `public.prescription_items`.
* **Related Requirements:** `FR-PRES-001`.

---

### Screen `SCR-PRES-002`: Digital Prescription Detail Screen
* **File Path:** `mobile/app/prescriptions/[id].tsx`
* **Purpose:** Display structured digital prescription, clinical medication table, doctor credentials, and official PDF export.
* **Allowed Roles:** Authoring Vet, Pet Parent of prescribed pet, Administrator.
* **Entry Points:** Completed appointment card ("View Prescription"), Pet Passport prescriptions section, prescription creation completion alert.
* **UI Structure:**
  * Top Bar: Back button, active status badge.
  * Header: RX icon, official digital RX badge, prescription reference ID, issuance date.
  * PDF Export Card: Document description and "Export PDF" button (invoking `expo-print` and `expo-sharing`).
  * Profile Snapshot Grid: Patient card (name, species, breed, age, weight) and Prescribing Doctor card (name, specialty, country/flag, verified badge).
  * Clinical Assessment Card: Primary diagnosis, clinical notes, refills authorized count.
  * Medication Regimen List: Structured `MedicationItemRow` components displaying dosage, schedule, duration, instructions.
  * Digital Authorization Card: Electronically signed representation, doctor verification timestamp, legal regulatory disclaimer.
* **API / Database Dependencies:** `public.prescriptions`, `public.prescription_items`, `expo-print`, `expo-sharing`.
* **Related Requirements:** `FR-PRES-002`.

---

### Screen `SCR-AI-001`: 24/7 AI Triage Chatbot Screen
* **File Path:** `mobile/app/ai/chat.tsx`
* **Purpose:** Natural language symptom checker for routine questions and emergency detection.
* **Allowed Roles:** All users.
* **Entry Points:** Home emergency banner, Care Hub AI assistant button.
* **UI Structure:**
  * Disclaimer Banner: "AI Assistant provides educational triage, not a veterinary medical diagnosis."
  * Messages List: Bubble conversation history with streamed markdown formatting.
  * Quick Suggestions Chips: "Dog ate chocolate", "Cat vomiting yellow foam", "Puppy vaccine schedule".
  * Emergency Alert Banner (Renders dynamically on red-flag detection):
    * Warning: "CRITICAL: Symptoms indicate a possible veterinary emergency."
    * Buttons: "Call Emergency Vet Now" (tel: dialer) and "Connect to Video Specialist".
  * Bottom Composer: Text input and send button.
* **API Dependencies:** `POST /api/v1/ai/triage-chat` (SSE Streaming).
* **Related Requirements:** `FR-AI-001`.

---

## 7. Clinical Messaging Module

### Screen `SCR-TAB-004`: Messages Inbox Screen
* **File Path:** `mobile/app/(tabs)/messages.tsx`
* **Purpose:** Central inbox displaying all active 1-to-1 clinical conversations with veterinarians or pet parents, featuring counterpart info, patient context, latest message snippet, relative timestamp, and unread badges.
* **Allowed Roles:** Authenticated Pet Parents and Veterinarians.
* **Entry Points:** Messages tab in bottom tab navigation (`app/(tabs)/_layout.tsx`).
* **Exit Points:** `SCR-MSG-001` (`/messages/[id]`), `/vets` directory (via empty state CTA for pet parents), `/(tabs)/appointments` (for veterinarians).
* **UI Structure:**
  * Header: Title "Messages", descriptive subtitle, total unread badge pill, pull-to-refresh control.
  * Conversation List: `FlatList` of `ConversationCard` components sorted by latest activity (`last_message_at DESC`).
  * Conversation Card: Counterpart name & avatar/initials, role pill (`Vet` / `Pet Parent`), clinical patient tag (`Pet Name • Species`), truncated last message preview, relative timestamp, and unread count badge.
  * Empty State: Role-aware empty placeholder with friendly icon and targeted action button (Pet parent: "Browse Vets"; Vet: "View Appointments").
  * Loading / Error States: Activity indicator while fetching, inline `ErrorCard` with "Try Again" retry button.
* **API / Database Dependencies:** `public.get_user_conversations` RPC, `public.get_unread_message_count` RPC.
* **Related Requirements:** `FR-MSG-001`.

---

### Screen `SCR-MSG-001`: Clinical Message Thread Screen
* **File Path:** `mobile/app/messages/[id].tsx`
* **Purpose:** Dedicated 1-to-1 clinical messaging view between pet parent and consulting veterinarian with real-time Supabase message synchronization and clinical appointment context.
* **Allowed Roles:** Authenticated participants of the conversation.
* **Entry Points:** `SCR-TAB-004` (conversation tap), `AppointmentCard` ("Chat" button).
* **Exit Points:** Back navigation button (returns to previous screen or `/messages`).
* **UI Structure:**
  * Header Bar: Back button, counterpart name, clinical role subtitle, and appointment context label.
  * Appointment Context Banner: Top banner showing pet name, species, consultation date/time, and status pill badge.
  * Message Thread: Chronological `FlatList` of `MessageBubble` items with automatic scroll-to-bottom.
  * Message Bubble: Visually distinct alignment and styling (Current user: primary lime brand bubble, right-aligned; Counterpart: neutral dark card bubble, left-aligned), formatted timestamp, and sent status indicator.
  * Message Composer: Auto-expanding multiline text input, character counter display when approaching 4,000-character limit, send button with pending mutation spinner, and empty/whitespace rejection.
  * Realtime Delivery: Supabase Realtime channel subscription (`postgres_changes` on `direct_messages`), optimistic caching, message deduplication, and automatic `mark_conversation_read` dispatch.
  * States: Initial loading spinner, empty conversation welcome state ("No messages yet. Send a message to start the consultation follow-up."), unauthorized conversation error view.
* **API / Database Dependencies:** `public.send_direct_message` RPC, `public.mark_conversation_read` RPC, `public.direct_messages` table, Supabase Realtime channel.
* **Related Requirements:** `FR-MSG-001`.

