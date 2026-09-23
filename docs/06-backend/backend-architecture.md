# Backend Architecture — Vetopia Mobile MVP

This document specifies the Node.js + Express.js backend architecture supporting the **Vetopia Mobile MVP**. It establishes a modular, decoupled API server that orchestrates business logic, database transactions, external third-party services, and notification delivery.

---

## 1. Request Lifecycle Pipeline

Every request from the React Native mobile application traverses a 6-tier pipeline before reaching PostgreSQL:

```
Mobile App (Expo)
       │
       ▼ (HTTPS / TLS 1.3)
┌─────────────────────────────────────────────────────────────┐
│ 1. Express Router (/api/v1/*)                               │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Middleware Pipeline                                      │
│    • Rate Limiting (express-rate-limit + Redis)             │
│    • Helmet (HTTP Security Headers)                         │
│    • CORS & Body Parser                                     │
│    • Authentication Middleware (JWT Validation)             │
│    • Authorization Middleware (RBAC Role Checks)            │
│    • Validation Middleware (Zod DTO Schemas)                │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Controller Layer (HTTP Interface)                        │
│    • Parses req.params, req.query, req.body                 │
│    • Extracts authenticated user context (req.user)         │
│    • Invokes appropriate service method                     │
│    • Formats HTTP status code and standard JSON response    │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Service Layer (Business Domain Logic)                    │
│    • Slot collision calculation & appointment verification  │
│    • Prescription validation & PDF generation               │
│    • AI Gemini triage streaming orchestration               │
│    • Dispatches background push notifications               │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Repository Layer (Data Access Layer)                     │
│    • Parameterized SQL queries via pg connection pool       │
│    • Supabase client integration for Realtime & Storage     │
└──────────────────────────────┬──────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Persistence & External Services                          │
│    • Supabase PostgreSQL Database (Row Level Security)      │
│    • Redis Cache (Doctor slots, Rate limit counters)        │
│    • External APIs (Google Gemini AI, Expo Push API)        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Directory Structure & Module Responsibilities

```text
server/
├── src/
│   ├── config/
│   │   ├── env.ts                    # Zod-validated environment variables
│   │   ├── database.ts               # PostgreSQL connection pool pool configuration
│   │   └── redis.ts                  # Redis client for caching & rate limiting
│   │
│   ├── middleware/
│   │   ├── auth.middleware.ts        # Verifies Bearer JWT, injects req.user
│   │   ├── rbac.middleware.ts        # Enforces 'pet_parent', 'vet', 'admin' roles
│   │   ├── validate.middleware.ts    # Enforces Zod schema on body/query/params
│   │   ├── rateLimit.middleware.ts   # Per-IP rate limiting
│   │   └── error.middleware.ts       # Global error handler (converts to standard JSON)
│   │
│   ├── controllers/
│   │   ├── auth.controller.ts        # Register, login, refresh, logout
│   │   ├── vets.controller.ts        # Directory search, profile, slots
│   │   ├── appointments.controller.ts# Booking, list, cancel, complete
│   │   ├── pets.controller.ts        # Pet CRUD, health passport
│   │   ├── prescriptions.controller.ts# Issue script, get script, download PDF
│   │   ├── messages.controller.ts    # Threads, direct message history
│   │   └── ai.controller.ts          # Gemini 2.5 Flash streaming triage
│   │
│   ├── services/
│   │   ├── auth.service.ts           # Password hashing, token generation
│   │   ├── appointment.service.ts    # Slot generation, conflict prevention
│   │   ├── prescription.service.ts   # Prescription rules, PDF compilation
│   │   ├── notification.service.ts   # Expo Push API batch sender
│   │   └── ai.service.ts             # Google Gemini AI streaming gateway
│   │
│   ├── repositories/
│   │   ├── user.repository.ts
│   │   ├── vet.repository.ts
│   │   ├── appointment.repository.ts
│   │   ├── pet.repository.ts
│   │   └── prescription.repository.ts
│   │
│   ├── types/
│   │   └── express.d.ts              # Extends Express Request with user identity
│   │
│   ├── utils/
│   │   ├── logger.ts                 # Structured Pino logger
│   │   └── response.ts               # Standard API JSON format wrapper
│   │
│   └── app.ts                        # Express server entry point
```

---

## 3. Standard API Response Structure

All Express REST API endpoints return consistent JSON wrappers:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 48
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "SLOT_ALREADY_BOOKED",
    "message": "The selected time slot has just been reserved by another patient.",
    "details": [
      { "field": "starts_at", "issue": "Conflict with existing appointment" }
    ]
  }
}
```

---

## 4. Rate Limiting Strategy

Rate limiting is enforced at the Express gateway using Redis counters:
1. **Public Auth Endpoints (`/api/v1/auth/*`):** Max 5 attempts per 15 minutes per IP address. Prevents credential stuffing.
2. **AI Triage Endpoint (`/api/v1/ai/*`):** Max 15 requests per hour per authenticated user. Prevents LLM quota exhaustion.
3. **General Authenticated APIs:** Max 300 requests per minute per authenticated user ID.
