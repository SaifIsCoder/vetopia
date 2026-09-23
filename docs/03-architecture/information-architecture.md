# Information Architecture (IA) — Vetopia Mobile MVP

## 1. Information Architecture Principles
* **Clinical Focus First:** Direct, friction-free access to veterinary consultation booking and live call rooms takes highest priority.
* **Pet-Centric Organization:** All appointments, prescriptions, health metrics, and medical notes are hierarchically anchored to specific registered pets.
* **Separation of Real-Time vs Asynchronous Channels:** Live video consultations (`Telemedicine`) and asynchronous follow-ups (`Messaging`) maintain distinct entry points to avoid user confusion.
* **No Clutter / Phase Isolation:** Excludes all non-MVP desktop modules (social feeds, adoption rescue lists, marketplace catalogs, farm registrations).

---

## 2. Complete MVP Information Hierarchy

```text
Vetopia Mobile App Root
│
├── 0. Auth & Onboarding Flow
│   ├── Welcome & Value Proposition Splash
│   ├── Login (Email/Password, Biometric Unlock, Google OAuth)
│   ├── Register (Name, Email, Password, Role Picker)
│   ├── Password Reset (Email Request & OTP Validation)
│   └── Onboarding (Role Confirmation, Profile Info, Pet Quick-Intake)
│
├── 1. Primary Navigation (5 Bottom Tabs)
│   │
│   ├── Tab 1: Home (Care Portal)
│   │   ├── Active Consultation Quick-Action (When call ready)
│   │   ├── 24/7 Emergency Triage Banner (Direct to AI or Emergency Hotline)
│   │   ├── My Pets Quick-Strip (Avatar chips with health status dots)
│   │   ├── Upcoming Consultations Card (Date, doctor, join button)
│   │   └── Available Vets Carousel (Ready in < 15 mins)
│   │
│   ├── Tab 2: Find a Vet (Clinical Discovery)
│   │   ├── Search Bar (Doctor name, clinic name, keyword)
│   │   ├── Filter Pills (Specialty, Language, Country, Price Range)
│   │   ├── Doctor Card List (Rating, review count, price, next slot, flag)
│   │   └── Doctor Profile Sub-Screen
│   │       ├── Bio & Clinical Credentials
│   │       ├── Verified License Status
│   │       ├── Languages & Specialties
│   │       ├── Weekly Availability Calendar
│   │       └── Reviews List
│   │
│   ├── Tab 3: Appointments (Scheduling Hub)
│   │   ├── Tab Selector: "Upcoming" vs "Past & History"
│   │   ├── Upcoming Appointments List
│   │   │   ├── Appointment Card (Doctor, pet, slot time, format badge)
│   │   │   ├── Action: Join Room (Enabled 15m before start)
│   │   │   └── Action: Cancel / Reschedule
│   │   └── Past Appointments List
│   │       ├── Completed Consultation Records
│   │       ├── Action: View Issued Prescription
│   │       └── Action: View Doctor Clinical Notes
│   │
│   ├── Tab 4: Messages (1-to-1 Clinical Inbox)
│   │   ├── Inbox Thread List (Doctor/Parent avatar, last message snippet, timestamp)
│   │   ├── Unread Message Counter Badges
│   │   └── Message Thread View
│   │       ├── Attached Appointment Context Header
│   │       ├── Chronological Message Bubbles
│   │       ├── Real-Time Delivery & Read Status
│   │       └── Text Message Composer
│   │
│   └── Tab 5: Care & Profile (Personal & Pet Hub)
│       ├── User Profile Header (Avatar, name, email, role badge)
│       ├── My Pets Section
│       │   ├── Registered Pet Cards (Photo, species, breed, age, weight)
│       │   ├── Action: Add New Pet
│       │   └── Pet Health Passport Screen
│       │       ├── Biometrics & Identification
│       │       ├── Vaccination History & Reminders
│       │       ├── Known Allergies & Chronic Conditions
│       │       └── Attached Prescriptions
│       ├── My Prescriptions Archive
│       ├── 24/7 AI Veterinary Assistant Entry
│       ├── Vet Provider Dashboard (Visible only if Role = 'vet')
│       │   ├── Manage Availability Windows
│       │   ├── Consultation Pricing & Slot Duration
│       │   └── Patient Intake Queue
│       └── Account Settings (Notifications, Language, Currency, Security, Sign Out)
│
└── 2. Dedicated Modal Flows
    ├── Telemedicine Room (Full-Screen WebRTC Modal)
    │   ├── Waiting Room State
    │   ├── Active Call State (Remote Video, Local PiP, Controls)
    │   └── Post-Call Summary & Doctor Prescription Drawer
    ├── Multi-Step Booking Modal
    │   ├── Step 1: Select Date & Available Slot
    │   ├── Step 2: Select Pet & Enter Symptoms
    │   └── Step 3: Payment Confirmation & Receipt
    └── AI Symptom Triage Modal (Chat Interface with Emergency Banner)
```
