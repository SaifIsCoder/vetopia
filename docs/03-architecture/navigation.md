# Navigation Architecture — Vetopia Mobile MVP

## 1. Expo Router File-Based Routing Structure

```text
mobile/app/
├── _layout.tsx                        # Root Stack (Auth Gatekeeper, Theme, Providers)
│
├── (auth)/                            # Unauthenticated Stack
│   ├── _layout.tsx                    # Stack with slide transitions
│   ├── welcome.tsx                    # Welcome & brand value proposition
│   ├── login.tsx                      # Login with email/password & biometrics
│   ├── register.tsx                   # Role-based account registration
│   ├── forgot-password.tsx            # Password recovery flow
│   └── onboarding.tsx                 # Post-signup role & pet intake wizard
│
├── (tabs)/                            # Authenticated 5-Destination Tab Navigator
│   ├── _layout.tsx                    # Bottom Tab Bar configuration
│   ├── index.tsx                      # Tab 1: Home (Care Portal & Quick Actions)
│   ├── vets.tsx                       # Tab 2: Find a Vet (Doctor Directory & Filters)
│   ├── appointments.tsx               # Tab 3: Appointments (Upcoming & Past Tabs)
│   ├── messages.tsx                   # Tab 4: Messages (1-to-1 Clinical Inbox)
│   └── care.tsx                       # Tab 5: Care (Pet Passport, Scripts, Profile)
│
├── consult/                           # Full-Screen Consultation Stack
│   ├── _layout.tsx                    # Full-screen modal configuration
│   └── [id].tsx                       # WebRTC Telemedicine Room (Live Video/Audio/Chat)
│
├── booking/                           # Scheduling Workflow Stack
│   ├── _layout.tsx                    # Slide-up modal presentation
│   └── [vetId].tsx                    # Multi-step booking wizard (Slot -> Pet -> Pay)
│
├── messages/                          # Direct Messaging Sub-Stack
│   └── [id].tsx                       # Individual 1-to-1 conversation thread
│
├── pets/                              # Pet Management Sub-Stack
│   ├── add.tsx                        # Pet registration form
│   ├── [id].tsx                       # Pet health passport detail & history
│   └── edit-[id].tsx                  # Edit pet clinical details
│
├── prescriptions/                     # Digital Prescriptions Sub-Stack
│   └── [id].tsx                       # Structured prescription view & PDF export
│
├── ai/                                # AI Clinical Assistance
│   └── chat.tsx                       # 24/7 AI Triage Chatbot Modal
│
├── vet/                               # Veterinarian Provider Dashboard
│   ├── dashboard.tsx                  # Availability window editor & appointment queue
│   └── edit-schedule.tsx              # Recurring hours editor
│
└── settings/                          # User & Account Preferences
    ├── profile.tsx                    # Personal info & avatar upload
    ├── security.tsx                   # Biometric toggle & password change
    └── notifications.tsx              # Push notification toggles
```

---

## 2. Bottom Tab Specification

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                               SCREEN CONTENT                            │
│                                                                         │
├─────────────┬─────────────┬─────────────┬─────────────┬─────────────────┤
│    [ ⌂ ]    │    [ ⚕ ]    │    [ 📅 ]    │    [ 💬 ]   │      [ 🐾 ]     │
│    Home     │  Find Vet   │Appointments │  Messages   │      Care       │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────────┘
```

1. **Tab 1: Home (`index.tsx`)**
   * **Title:** Home
   * **Icon:** `home` (Lucide React Native)
   * **Header:** Custom brand logo (`The Pets Club / Vetopia`), active telemed indicator, search icon.
2. **Tab 2: Find a Vet (`vets.tsx`)**
   * **Title:** Find a Vet
   * **Icon:** `stethoscope` (Lucide React Native)
   * **Header:** Search bar with inline filter trigger button.
3. **Tab 3: Appointments (`appointments.tsx`)**
   * **Title:** Appointments
   * **Icon:** `calendar` (Lucide React Native)
   * **Header:** Segmented control: `Upcoming` (with count badge) and `Past`.
4. **Tab 4: Messages (`messages.tsx`)**
   * **Title:** Messages
   * **Icon:** `message-circle` (Lucide React Native)
   * **Badge:** Real-time unread messages count.
5. **Tab 5: Care (`care.tsx`)**
   * **Title:** Care
   * **Icon:** `paw-print` (Lucide React Native)
   * **Sub-Navigation Target:** Houses Pet Passports, Prescriptions, AI Assistant entry, and Account Settings.

---

## 3. Deep Linking Schema

The application registers the URL scheme `vetopia://` and handles universal links under `https://app.vetopia.com`:

| URL Pattern | Destination Screen | Parameters Passed |
| :--- | :--- | :--- |
| `vetopia://consult/:id` | `app/consult/[id].tsx` | `id`: Appointment UUID (Joins live call) |
| `vetopia://booking/:vetId` | `app/booking/[vetId].tsx` | `vetId`: Veterinarian UUID |
| `vetopia://messages/:id` | `app/messages/[id].tsx` | `id`: Conversation UUID |
| `vetopia://prescriptions/:id`| `app/prescriptions/[id].tsx` | `id`: Prescription UUID |
| `vetopia://pets/:id` | `app/pets/[id].tsx` | `id`: Pet UUID (Opens health passport) |
| `vetopia://ai/chat` | `app/ai/chat.tsx` | Opens 24/7 symptom checker |

---

## 4. Protected Route & Auth Gatekeeper

In `app/_layout.tsx`, an authentication guard listens to `useAuthStore`:
1. If `user == null` and current route is not within `(auth)`, automatically replace navigation stack with `app/(auth)/welcome.tsx`.
2. If `user != null` and user attempts to access `(auth)` screens, automatically redirect to `app/(tabs)/index.tsx`.
3. If `user != null` but `profile.onboarded == false`, redirect to `app/(auth)/onboarding.tsx`.
4. If a route requires the `vet` role (e.g., `app/vet/*`), verify `roles.includes('vet')`; otherwise redirect to home with an access alert.
