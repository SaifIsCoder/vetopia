# Product Requirements Document (PRD) — Vetopia Mobile MVP

## 1. Product Vision
Vetopia Mobile delivers veterinary clinical care, real-time telemedicine, and pet health tracking to pet parents globally. By translating Vetopia's web-based clinical features into a dedicated mobile experience, Vetopia Mobile ensures pet owners can access certified veterinary doctors in their native language within minutes, manage their pets' digital medical records offline, and access 24/7 symptom triage anytime, anywhere.

---

## 2. Problem Statement
* **High Emergency & Triage Anxiety:** Pet owners facing sudden pet distress or abnormal symptoms lack immediate, trustworthy clinical guidance, often resorting to unverified forum advice or costly emergency clinic visits.
* **Geographical & Language Barriers:** Expatriates, international travelers, and non-native speakers struggle to find local veterinary doctors who speak their primary language.
* **Fragmented Medical History:** Pet vaccination dates, allergy notes, prescription history, and prior consultation records are scattered across paper cards, email PDFs, and clinic software, making emergency consults difficult.
* **Inconvenient Scheduling:** Booking veterinary visits often requires phone calls during clinic hours, resulting in delayed care for non-emergency conditions.

---

## 3. Target Users & User Personas

### Persona 1: The Worried Pet Parent (Primary Consumer)
* **Name:** Sarah Jenkins (Dog & Cat Parent)
* **Demographics:** Age 31, Urban apartment, tech-savvy smartphone user.
* **Key Needs:**
  * Instant reassurance when her French Bulldog exhibits respiratory distress at night.
  * Easy digital scheduling without phone calls.
  * Access to a verified vet who speaks English and understands specific breed traits.
  * Centralized digital passport for both her dog and rescue cat with vaccination reminders.
* **Mobile Frustrations:** Desktop websites are clunky to navigate while holding a distressed pet; needs one-tap calling and instant mobile notifications.

### Persona 2: The Consulting Veterinarian (Primary Provider)
* **Name:** Dr. Marco Rossi (Licensed Veterinary Specialist)
* **Demographics:** Age 42, Board-certified Emergency & Critical Care practitioner.
* **Key Needs:**
  * Ability to conduct video consultations from a tablet or mobile device outside clinic hours.
  * Clear clinical intake notes (species, age, symptoms, photos) prior to call connection.
  * Streamlined digital prescription generation immediately following a consult.
  * Control over weekly availability windows and slot pricing.
* **Mobile Frustrations:** Needs reliable WebRTC video without software downloads; needs instant call ringing alerts on his phone.

---

## 4. MVP Goals & Value Proposition

| Goal | Description | Metric |
| :--- | :--- | :--- |
| **Instant Clinical Access** | Connect pet parents to a verified vet in under 5 minutes or via scheduled slots | Time to consultation start < 5 mins (instant) |
| **Digital Health Passport** | 100% of registered pets have digital medical records accessible offline | Pet records cached on local device storage |
| **Frictionless Telemedicine** | Seamless peer-to-peer video/audio calls with zero plugin downloads | Call completion rate > 92% |
| **Clinical Prescription Loop** | Legally compliant digital prescription delivery directly after consult | Script issued within 3 mins of call end |

---

## 5. Scope Boundary Matrix

### [CONFIRMED] Active MVP Scope
* **Authentication & Profiles:** Email/password registration, Google OAuth, session management, biometric login, role attachment (`pet_parent`, `vet`), and profile editing.
* **Pet Management:** Register multiple pets, specify species/breed/age/weight/allergies, upload pet photos, view pet passport.
* **Vet Discovery:** Search and filter verified doctors by specialty, language (11 languages supported), consultation fee, and rating.
* **Appointments:** Slot booking system based on doctors' recurring weekly availability windows, appointment status tracking (`scheduled`, `completed`, `cancelled`).
* **Telemedicine (WebRTC):** Waiting room, peer-to-peer audio/video call, hardware toggles (mic, camera, speaker, camera flip), network reconnection, and call completion.
* **Prescriptions:** Doctor creates structured e-prescriptions (drug name, dosage, frequency, duration, notes); pet parent views and downloads them.
* **1-to-1 Clinical Messaging:** Direct text messaging between pet parent and doctor with appointment context, unread counters, and delivery status.
* **Basic AI Assistant:** 24/7 symptom checker and emergency red-flag triage chatbot powered by Google Gemini 2.5 Flash.
* **Notifications:** Push and in-app alerts for appointment confirmations, 15-minute reminders, incoming calls, messages, and new prescriptions.
* **Admin Support Endpoints:** Backend web endpoints for vet license verification, doctor onboarding approval, and system monitoring.

### [FUTURE] Explicitly Excluded Modules (Phase 2+)
* Community social feed, posts, comments, likes, saves, and following graph.
* Animal shelter rescue listings, pet adoption profiles, and adoption applications.
* E-commerce marketplace, product catalog, cart, checkout, and merchant store management.
* Advanced AI matchmaking quiz and automated product care recommendation engine.
* Agricultural registrations (dairy herd management, commercial poultry flocks).
* Commercial clinic registrations, blogs, events, and paid VIP membership subscriptions.

---

## 6. Constraints, Assumptions & Risks

### Constraints
* **Regulatory Compliance (Telemedicine):** VCPR (Veterinarian-Client-Patient Relationship) laws vary by jurisdiction. Digital prescriptions must clearly state jurisdictional validity and exclude controlled substances.
* **Hardware Camera/Mic Access:** Native OS permissions for camera, microphone, and push notifications must be gracefully requested and handled.
* **No Media on Server:** Video/audio media streams must never touch Supabase or the Express API server; all audio/video is strictly peer-to-peer WebRTC.

### Key Decisions & Architectural Approvals
* `[CONFIRMED]` The existing website uses Supabase PostgreSQL with 5 app roles: `pet_parent`, `vet`, `shelter`, `seller`, `admin`. Mobile MVP will strictly utilize `pet_parent` and `vet`.
* `[APPROVED FOR MVP]` Schema additions (`prescriptions`, `prescription_items`, `notifications`, `device_tokens`, and `pet_id` foreign key on `appointments`) are approved for MVP database migration.
* `[APPROVED / RESOLVED]` **Telemedicine RTC Provider:** LiveKit Cloud Managed RTC SFU selected for MVP (`@livekit/react-native` + backend token generation), replacing self-managed Coturn to guarantee mobile connection stability and zero media routing on application servers.
* `[APPROVED / RESOLVED]` **Upfront Consultation Payments:** Verified against the existing web codebase (`src/routes/booking.tsx`), Vetopia does not gate appointment confirmation behind upfront payment. The booking records `price_usd` and confirms immediately. Upfront payment gateways (Stripe/Apple Pay) are deferred to Phase 3.


---

## 7. Success Criteria & KPIs

1. **User Activation:** Over 70% of registered pet parents add at least one pet profile during onboarding.
2. **Consultation Success:** 90%+ of scheduled appointments transition to `completed` without dropped calls.
3. **Prescription Delivery:** 100% of prescriptions written by vets are immediately viewable by the pet parent.
4. **App Store Stability:** Crash-free sessions > 99.2% on both iOS and Android.
