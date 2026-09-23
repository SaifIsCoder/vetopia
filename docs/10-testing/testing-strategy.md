# Testing Strategy & Quality Assurance — Vetopia Mobile MVP

This document specifies the comprehensive testing strategy for the **Vetopia Mobile MVP**, establishing automated test suites, physical device matrices, and regression plans.

---

## 1. Multi-Tier Testing Pyramid

```
                       ┌─────────────────────────┐
                       │     E2E Testing (10%)   │  Maestro / Detox
                       ├─────────────────────────┤
                       │  Integration Tests (25%)│  Supertest + Express + DB
                       ├─────────────────────────┤
                       │  Component Tests (25%)  │  React Native Testing Library
                       ├─────────────────────────┤
                       │    Unit Tests (40%)     │  Jest + TypeScript
                       └─────────────────────────┘
```

---

## 2. Testing Specifications by Module

### 2.1 Unit Testing (Jest)
* **Doctor Slot Generation (`buildSlots`):**
  * Test correct generation of 30-minute intervals from recurring windows (e.g. 09:00 to 17:00 = 16 slots).
  * Test that slots occurring in the past or within 15 minutes of present time are excluded.
  * Test that slots matching booked appointment records are filtered out.
  * Test weekday boundary crossings (e.g., Sunday = 0, Saturday = 6).
* **AI Clinical Triage Guardrails:**
  * Test that emergency symptom inputs trigger `[EMERGENCY_DETECTED]`.
  * Test that medication dosage questions trigger non-prescribing disclaimers.

### 2.2 Component & Interaction Testing (RNTL)
* `BookingModal`: Verifies step progression, required field validation (pet selection, symptoms description), and submit disabling while loading.
* `DoctorCard`: Asserts correct rendering of specialty badge, localized price formatting, and nationality flag.
* `CallControls`: Asserts that tapping mic icon toggles mute state and dispatches event.

### 2.3 Integration & API Testing (Supertest)
* Test authenticated routes reject unauthenticated requests with `401 Unauthorized`.
* Test `POST /api/v1/appointments` returns `409 Conflict` when duplicate slot is submitted.
* Test `POST /api/v1/prescriptions` rejects submissions from users lacking the `vet` role.

### 2.4 Database & RLS Policy Testing
* **Test Case DB-RLS-01:** Assert that User B cannot `SELECT` from `appointments` where `pet_parent_id = User A` and `vet_id != User B`.
* **Test Case DB-RLS-02:** Assert that non-participants cannot insert into `call_signals`.
* **Test Case DB-RLS-03:** Assert that `prescriptions` cannot be altered after insertion (`UPDATE` blocked).

---

## 3. Critical End-to-End Test Scenarios (Maestro)

### Scenario E2E-01: Full Consultation Booking Loop
1. Launch app -> Log in as `sarah.jenkins@example.com`.
2. Tap "Find a Vet" tab -> Search "Dr. Sarah Mitchell".
3. Tap "Book Consult" -> Select tomorrow 10:00 AM slot.
4. Select pet "Buddy" -> Enter symptoms "Mild eye discharge" -> Tap Confirm.
5. Verify Confirmed Receipt Screen renders with Booking ID.
6. Verify appointment appears in "Upcoming Appointments" tab.

### Scenario E2E-02: Live WebRTC Telemedicine Call
1. Doctor logs in on Device A; Parent logs in on Device B.
2. At appointment time, both devices open consultation room (`/consult/:id`).
3. Doctor taps "Start Video Call".
4. Assert Parent device receives incoming call prompt.
5. Parent taps "Accept".
6. Assert both devices transition `callState` to `'connected'`.
7. Assert audio/video streams active.
8. Doctor taps "End Call" -> Assert call ends cleanly.
9. Assert Doctor is redirected to "Issue Prescription" form.

---

## 4. Physical Device Verification Matrix

| Platform | Device Model | OS Version | Test Focus |
| :--- | :--- | :--- | :--- |
| **iOS** | iPhone SE (3rd Gen) | iOS 16 | Small screen layout (4.7"), compact keyboard behavior |
| **iOS** | iPhone 15 Pro | iOS 17 / 18 | Dynamic Island, Face ID biometrics, 120Hz ProMotion |
| **Android** | Google Pixel 7 | Android 14 | Stock Android, CameraX integration, standard push notifications |
| **Android** | Samsung Galaxy S23 | Android 14 (OneUI) | Hardware audio routing, split-screen mode |
| **Android** | Xiaomi Redmi Note 12 | Android 13 | Low/mid-tier processor performance, FlashList 60fps scrolling |
