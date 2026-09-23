# Future Phases & Product Roadmap

> **Status:** POST-MVP ROADMAP SPECIFICATION  
> **Document Reference:** `DOC-ROADMAP-001`  
> **Target Audience:** Product Managers, System Architects, Future Engineering Teams  
> **Critical Constraint:** Features detailed in this document are **strictly excluded** from the Mobile MVP. This document exists exclusively to ensure the MVP architectural foundation does not make irreversible design decisions that obstruct future evolution.

---

## 1. Architectural Forward-Compatibility Principles

The Vetopia Mobile MVP architecture (modular Expo Router, 6-layer Express backend, Supabase PostgreSQL with RLS, and strict entity separation) is specifically constructed with expansion hooks to prevent costly rewrites during later phases.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MVP CORE ARCHITECTURE                           │
│  (Auth & RBAC, Pet Profiles, Vet Directory, Telemedicine, Rx, Direct Chat)│
└──────────────┬──────────────────────────┬──────────────────────────────┘
               │                          │
               ▼                          ▼
┌──────────────────────────────┐ ┌───────────────────────────────────────┐
│     PHASE 2 EXPANSION        │ │          PHASE 3 EXPANSION            │
│  • Community Social Feed     │ │  • E-Commerce Marketplace             │
│  • Shelter & Pet Adoption    │ │  • Cart, Checkout, Stripe / Escrow    │
│  • Follows, Likes, Comments  │ │  • Seller Onboarding & Logistics      │
└──────────────┬───────────────┘ └───────────────────┬───────────────────┘
               │                                     │
               ▼                                     ▼
┌──────────────────────────────┐ ┌───────────────────────────────────────┐
│     PHASE 4 EXPANSION        │ │          PHASE 5 EXPANSION            │
│  • Predictive AI Diagnostics │ │  • Agro & Commercial Livestock (Dairy)│
│  • Vet Matchmaking Engine    │ │  • Events, Webinars, Community Blogs  │
│  • Automated Diet Planners   │ │  • Multi-Tenant Clinic Practice Mgmt  │
└──────────────────────────────┘ └───────────────────────────────────────┘
```

### 1.1 Architectural Guarantees Required in MVP
1. **User Role Extensibility:** The `users.role` enum (`pet_parent`, `vet`, `admin`) will expand to include `shelter`, `seller`, `commercial_farmer`, and `clinic_admin`. The MVP RBAC engine (`roles-rbac.md`) uses role validation middleware that accepts array-based permissions (`requireRole(['pet_parent', 'shelter'])`).
2. **Tab Bar Modularization:** The 5-tab MVP structure (`Home`, `Find Vet`, `Appointments`, `Messages`, `Care`) will evolve via dynamic role-based navigation or an expandable grid/drawer without restructuring the navigation root.
3. **Database Polymorphism:** Schema foreign keys (e.g., `media_attachments`, `notifications`, `reviews`) utilize standard polymorphic patterns (`entity_type` + `entity_id`) or distinct relation tables to prevent schema locking.
4. **Decoupled Messaging:** MVP messaging operates on generic `conversations` and `conversation_participants`. It can scale seamlessly from doctor-parent consultation threads to buyer-seller marketplace chats and adoption applicant inquiries.

---

## 2. Phase 2 — Community & Adoption Ecosystem

### 2.1 Community Social Network
* **Scope:** Peer-to-peer engagement, knowledge sharing, pet influencer content, and social Q&A.
* **Key Capabilities:**
  * **Algorithmic & Chronological Feeds:** "Following", "Trending", and "Nearby" community feeds.
  * **Rich Media Posts:** Multi-photo carousels, short-form pet health videos, and rich markdown text.
  * **Social Interactions:** Likes, comments with nested replies, bookmarks/saves, and native share sheets.
  * **Follow Graph:** Bidirectional relationships between pet parents and verified veterinarians.
  * **Pet Social Profiles:** Option to link posts directly to specific pets registered in the parent's account.
* **MVP Architectural Hook:** Storage bucket `user-media` is already configured with image compression and CDN caching. Profile tables support public usernames and avatar URLs.

### 2.2 Pet Adoption & Rescue Workflow
* **Scope:** Connecting verified shelters, foster parents, and rescue organizations with prospective pet adopters.
* **Key Capabilities:**
  * **Adoption Listings Directory:** Searchable index filtering by species, breed, age, temperament, vaccinated status, and shelter location.
  * **Adoption Application Pipeline:** Digital questionnaire submission, background verification, household suitability checks, and home-visit scheduling.
  * **Shelter Management Portal:** Dedicated mobile/web dashboard for shelters to intake animals, update medical status, and approve adoption applications.
  * **Direct Inquiries:** Adoption-specific messaging threads linking shelter coordinators directly to applicants.
* **MVP Architectural Hook:** The `pets` table contains core biological traits (`species`, `breed`, `dob`, `vaccinations`). Future migrations will add `is_adoptable: boolean`, `shelter_id: UUID`, and `adoption_status: enum`.

---

## 3. Phase 3 — E-Commerce Marketplace & Supplies

### 3.1 Pet Supplies, Food & OTC Medications
* **Scope:** Curated retail marketplace for veterinary diets, prescription medications, toys, supplements, and grooming supplies.
* **Key Capabilities:**
  * **Product Catalog & Search:** Categories, brand filtering, stock tracking, and user ratings/reviews.
  * **Verified Seller Ecosystem:** Third-party vendor onboarding, inventory sync, and store profiles.
  * **Shopping Cart & Checkout:** Unified cart supporting multi-vendor orders, tax calculation, and coupon codes.
  * **Payment Integration:** Stripe / Apple Pay / Google Pay / local regional payment gateways with escrow payout capabilities.
  * **Order Fulfillment & Tracking:** Order lifecycle (`pending`, `packed`, `shipped`, `delivered`), carrier webhook integration, and push notifications.
* **MVP Architectural Hook:** The MVP `prescriptions` module generates verified digital Rx records (`prescription_items`). In Phase 3, this integrates with the marketplace to unlock "1-Click Refill" for verified prescription medications.

---

## 4. Phase 4 — Advanced AI Diagnostics & Matchmaking

### 4.1 Intelligent Clinical Decision Support & Matchmaking
* **Scope:** Transitioning from MVP non-diagnostic general advice (`08-ai/ai-assistant.md`) to deep clinical intelligence and personalized care engines.
* **Key Capabilities:**
  * **Smart Vet Matchmaking:** AI-driven provider recommendation based on pet breed predispositions, reported symptoms, vet specialization, historical outcomes, and real-time calendar availability.
  * **Computer Vision Triage:** Multimodal image classification to evaluate dermatological lesions, ocular discharge, dental calculus, and wound healing stages with automated vet escalation.
  * **Personalized Preventive Health Plans:** Dynamic life-stage nutrition, exercise, and vaccination schedules calculated from pet biometric logs and historical health records.
  * **Clinical Voice Scribe:** Real-time speech-to-text during WebRTC telemedicine consultations to automatically draft clinical notes and structured prescription drafts for veterinarian sign-off.
* **MVP Architectural Hook:** AI API service (`POST /api/v1/ai/triage`) passes structured pet context (`species`, `age`, `allergies`, `conditions`). Moving to multimodal vision and matchmaking requires updating backend model endpoints without altering client UI contracts.

---

## 5. Phase 5 — Commercial Agro-Livestock & Enterprise Ecosystem

### 5.1 Commercial Livestock Management (Dairy & Poultry)
* **Scope:** Expanding Vetopia from domestic companion animals (dogs, cats) to enterprise agricultural management (cattle herds, dairy operations, poultry farms).
* **Key Capabilities:**
  * **Herd & Flock Batch Tracking:** Group-based health records, batch vaccinations, milk yield logging, and egg production analytics.
  * **Farm Emergency Tele-Triage:** Specialized farm-call scheduling, on-site route dispatching, and bulk medication distribution.
  * **Government & Disease Compliance:** Quarantine reporting, regional outbreak alert maps, and herd certification documentation.
* **MVP Architectural Hook:** The existing `pets` schema can generalize into an `animals` entity or link via `group_id` foreign keys without disrupting domestic pet relationships.

### 5.2 Enterprise Clinic Practice Management
* **Scope:** Multi-vet clinics, physical hospital check-ins, staff scheduling, and front-desk reception portals.
* **Key Capabilities:**
  * **Multi-Provider Calendars:** Shared clinic appointment boards, room allocations, and walk-in queue management.
  * **In-Clinic POS & Hardware:** Barcode scanning for medications, receipt printers, and lab diagnostic equipment integrations.
  * **Staff RBAC:** Receptionist, veterinary technician, resident vet, and clinic director permission levels.

### 5.3 Educational & Community Events
* **Scope:** Live webinars, veterinary seminars, dog training workshops, and community adoption drives.
* **Key Capabilities:**
  * **Event Discovery & Ticketing:** In-app ticket purchase, QR-code entry check-in, and calendar sync.
  * **Interactive Webinars:** Live broadcast integration with Q&A moderation.
  * **Educational Publishing:** Editorial health blogs authored by verified veterinarians with bookmarking and sharing.

---

## 6. Migration & Compatibility Strategy

To ensure seamless upgrades from MVP to subsequent phases without breaking deployed mobile clients:

| MVP Component | Expansion Path | Compatibility Assurance |
| :--- | :--- | :--- |
| **Auth Tokens** | Add tenant/organization claims | JWT claims include optional `org_id` and array-based `roles`. |
| **API Endpoints** | Major versioning (`/api/v2/...`) | Deprecated endpoints maintain backward compatibility for 180 days. |
| **Database Migrations** | Non-destructive schema alters | New tables created; existing tables only accept nullable or default-valued columns. |
| **Mobile State** | Modular Zustand slices | New features plug in independent stores without mutating core auth/appointment stores. |
| **Push Notifications**| Dynamic payload router | Push notifications use standard `type` discriminator with fallback to in-app notification center. |

---

## 7. Strategic Milestone Roadmap

```
2026 Q3               2026 Q4               2027 Q1               2027 Q2               2027 Q3+
  │                     │                     │                     │                     │
  ▼                     ▼                     ▼                     ▼                     ▼
┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│  MOBILE MVP  │ ───► │   PHASE 2    │ ───► │   PHASE 3    │ ───► │   PHASE 4    │ ───► │   PHASE 5    │
│  (Care Core) │      │ (Community & │      │ (Marketplace │      │ (Advanced AI │      │ (Agro Herd & │
│              │      │  Adoption)   │      │  & Supplies) │      │  & Vision)   │      │  Enterprise) │
└──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘      └──────────────┘
```

> **Review Rule:** Engineering teams must refer back to this document prior to any significant database refactoring or architecture alterations in the MVP codebase. Under no circumstances should MVP deadlines be compromised by premature implementation of Phase 2–5 features.
