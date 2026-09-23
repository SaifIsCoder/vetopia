# Vetopia Mobile MVP — Technical & Product Documentation

Welcome to the **Vetopia Mobile MVP** engineering documentation. This documentation repository serves as the definitive source of truth and implementation guide for software engineers, product architects, and AI coding agents building the native mobile application for **Vetopia (The Pets Club)**.

---

## 1. What Vetopia Mobile Is

**Vetopia Mobile** is a specialized veterinary telemedicine and pet care application built with **React Native (Expo)**, backed by a dedicated **Node.js / Express.js REST API**, and powered by **Supabase PostgreSQL & Storage**.

The mobile application translates the core healthcare and clinical consultation workflows of the Vetopia desktop platform into an optimized mobile experience focused on:
* **Instant & Scheduled Telemedicine:** End-to-end video, audio, and text consultations between licensed veterinarians and pet parents.
* **Pet Health Passport:** Complete clinical history, vaccination records, biometric records, and prescription archives accessible on mobile devices.
* **1-to-1 Clinical Messaging:** Secure asynchronous messaging between pet parents and consulting veterinarians.
* **24/7 AI Veterinary Triage:** Safe symptom assessment and red-flag emergency triage powered by Google Gemini 2.5 Flash.

---

## 2. MVP Scope (Minimum Viable Product)

The MVP is strictly scoped to eleven core functional modules:

1. **MVP-01: Authentication & Authorization:** Multi-role authentication (`pet_parent`, `vet`), biometric unlock, session persistence, and role validation.
2. **MVP-02: Pet Management & Passport:** Digital registration, health snapshots, vaccination history, and medical records for household pets.
3. **MVP-03: Vet Discovery:** Searchable directory of licensed practitioners with language, specialty, rating, and availability filters.
4. **MVP-04: Appointments & Scheduling:** Real-time slot reservation, appointment lifecycle management (`scheduled`, `completed`, `cancelled`), and reminders.
5. **MVP-05: Telemedicine (WebRTC):** Live consultation room, waiting room, device controls (camera, microphone, speaker, flip), and connection handling.
6. **MVP-06: Prescriptions:** Vet prescription creation (medication, dosage, duration, instructions) and pet parent pharmacy fulfillment view.
7. **MVP-07: 1-to-1 Clinical Messaging:** Asynchronous text messaging between pet parent and doctor with appointment context.
8. **MVP-08: Push & In-App Notifications:** Real-time reminders for bookings, consultations, incoming messages, and prescriptions.
9. **MVP-09: Basic AI Assistant:** 24/7 AI symptom triage with non-diagnostic clinical safety boundaries.
10. **MVP-10: Profile & Settings:** User profile management, communication preferences, and security settings.
11. **MVP-11: Admin Operations Support:** Web-backed administrative endpoints for vet credential approval and audit logging.

---

## 3. Explicitly Excluded from MVP

The following modules exist on the desktop website or in future roadmaps, but are **explicitly excluded** from the Mobile MVP:
* **Community Social Network:** Feed, posts, likes, comments, bookmarks, following graph, and explore grid.
* **Pet Rescue & Adoption:** Shelter listings, pet adoption profiles, adoption applications.
* **E-Commerce Marketplace:** Product catalog, shopping cart, checkout, seller stores, orders, and promo codes.
* **Advanced AI Features:** AI adoption matchmaking quiz, AI smart care product recommendations.
* **Ecosystem Registrations:** Dairy herd onboarding, poultry farm flock management, veterinary clinic/hospital registration.
* **Content & Extras:** Blogs, community events, meetup tickets, and multi-tier membership sales.

All future features are cataloged in [`mobile/docs/12-roadmap/future-phases.md`](./12-roadmap/future-phases.md).

---

## 4. Documentation Structure

```text
mobile/docs/
├── README.md                                  # Entry point & guide (this file)
│
├── 01-product/
│   ├── PRD.md                                 # Product Requirements Document
│   └── SRS.md                                 # Software Requirements Specification (Functional IDs)
│
├── 02-users/
│   ├── roles-rbac.md                          # Role-Based Access Control matrix
│   └── user-flows.md                          # End-to-end user journeys & sequence diagrams
│
├── 03-architecture/
│   ├── information-architecture.md            # App sitemap & content hierarchy
│   ├── mobile-architecture.md                 # React Native & Expo technical architecture
│   └── navigation.md                          # Expo Router navigation tree & modal specs
│
├── 04-ui/
│   ├── screen-specifications.md               # Detailed specs for every MVP screen
│   └── design-system.md                       # Colors, typography, spacing, atomic components
│
├── 05-database/
│   ├── database-design.md                     # Schema definitions, tables, columns, indexes
│   ├── erd.md                                 # Entity Relationship Diagram (Mermaid)
│   └── rls-security.md                        # Supabase Row Level Security policies
│
├── 06-backend/
│   ├── backend-architecture.md                # Node.js/Express layered architecture
│   ├── api-specification.md                   # Complete REST API contracts
│   └── authentication-security.md             # JWT tokens, refresh rotation, and password security
│
├── 07-realtime/
│   ├── messaging.md                           # 1-to-1 messaging architecture
│   └── telemedicine-webrtc.md                 # WebRTC signaling, media, and room state
│
├── 08-ai/
│   └── ai-assistant.md                        # Clinical triage chatbot & safety guardrails
│
├── 09-platform/
│   ├── storage.md                             # S3/Supabase storage buckets & file policies
│   ├── notifications.md                       # APNs/FCM push notification payloads & triggers
│   └── deployment.md                          # EAS build, CI/CD pipeline, and store deployment
│
├── 10-testing/
│   └── testing-strategy.md                    # Unit, integration, E2E, and WebRTC testing
│
├── 11-traceability/
│   └── requirements-matrix.md                 # Traceability: Requirement → Screen → API → DB → Test
│
└── 12-roadmap/
    └── future-phases.md                       # Scope and architecture readiness for Phases 2–5
```

---

## 5. Mandatory Reading Order for Engineers & AI Agents

To ensure complete architectural comprehension prior to code generation, read documents in the following sequence:

```text
README.md
  │
  ▼
01-product/PRD.md ──► 01-product/SRS.md
  │
  ▼
02-users/roles-rbac.md ──► 02-users/user-flows.md
  │
  ▼
03-architecture/information-architecture.md ──► 03-architecture/mobile-architecture.md ──► 03-architecture/navigation.md
  │
  ▼
04-ui/design-system.md ──► 04-ui/screen-specifications.md
  │
  ▼
05-database/database-design.md ──► 05-database/erd.md ──► 05-database/rls-security.md
  │
  ▼
06-backend/backend-architecture.md ──► 06-backend/api-specification.md ──► 06-backend/authentication-security.md
  │
  ▼
07-realtime/telemedicine-webrtc.md ──► 07-realtime/messaging.md
  │
  ▼
08-ai/ai-assistant.md ──► 09-platform/storage.md ──► 09-platform/notifications.md
  │
  ▼
10-testing/testing-strategy.md ──► 11-traceability/requirements-matrix.md ──► 12-roadmap/future-phases.md
```

---

## 6. Source-of-Truth Hierarchy

When evaluating requirements, technical decisions, and UI patterns, follow this precedence:

1. **Active Database Schema & Migrations (`supabase/migrations/*.sql`):** Ground truth for existing relational tables, constraints, and RLS policies.
2. **Existing Website Codebase (`src/`):** Truth for business rules, doctor slot generation logic, currency conversions, and WebRTC signaling protocols.
3. **Mobile MVP Documentation (`mobile/docs/`):** Truth for mobile adaptations, screen designs, REST API endpoints, and mobile UX paradigms.
4. **Assumptions / Inferred Requirements:** Must be explicitly tagged with:
   * `CONFIRMED`: Verified directly in existing database or codebase.
   * `REQUIRED FOR MVP`: Required for the mobile MVP to function, requiring new tables or endpoints.
   * `PROPOSED`: Architectural recommendation based on mobile engineering best practices.
   * `DECISION REQUIRED`: Critical technical fork requiring user/stakeholder approval.

---

## 7. Development & Implementation Rules

1. **NO CODE DURING SPECIFICATION:** No implementation files (`.tsx`, `.ts`, `.js`) may be written until documentation is reviewed and approved.
2. **SEPARATION OF WEBRTC AND MESSAGING:** Real-time video/audio calling and asynchronous messaging must remain completely independent subsystems. Media never routes through Supabase or the REST API.
3. **MANDATORY TRACEABILITY:** Every UI component and backend route must correspond directly to an SRS requirement ID (`FR-***-***`).
4. **OFFLINE RESILIENCE:** Pet passport records and medical summaries must be readable offline.

---

## 8. Architectural Decisions Log & Implementation Readiness

```text
STATUS: READY FOR IMPLEMENTATION
```

All three prerequisite architectural and product decisions have been formally resolved:

| Decision Area | Final Architecture Decision | Resolution Detail |
| :--- | :--- | :--- |
| **1. Telemedicine RTC** | **Managed RTC (LiveKit Cloud SFU)** | Adopt `@livekit/react-native` with backend token generation (`POST /api/v1/telemedicine/token`). Guarantees cellular/Wi-Fi handover resilience, adaptive simulcast, and zero TURN server operational overhead while ensuring media never touches app/database servers. |
| **2. Database Schema** | **Approved Normalized MVP Schema** | Approved database migrations adding `prescriptions`, `prescription_items`, `notifications`, `device_tokens`, and foreign key `pet_id UUID REFERENCES public.pets(id)` to `appointments` (retaining `pet_name` and `species` for web backward compatibility). |
| **3. Consultation Payments** | **No Upfront Payment Gate for MVP** | Verified against the active web codebase (`src/routes/booking.tsx` lines 112–140), Vetopia does not require upfront payment to confirm bookings. The mobile MVP stores `price_usd` for record-keeping and confirms bookings directly. Payment gateway integration (Stripe / Apple Pay) is scheduled for Phase 3. |

