# Authentication & Security Architecture — Vetopia Mobile MVP

This document specifies the end-to-end authentication lifecycle, cryptographic token design, secure mobile client storage, and attack prevention strategies for **Vetopia Mobile**.

---

## 1. Authentication Lifecycle Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User as Mobile App User
    participant App as Expo Client
    participant SecureStore as expo-secure-store
    participant API as Express Auth Gateway
    participant Supabase as Supabase Auth / PostgreSQL

    Note over User, Supabase: Step 1: Initial Login
    User->>App: Enter Email & Password
    App->>API: POST /api/v1/auth/login
    API->>Supabase: Verify Credentials (argon2 / bcrypt)
    Supabase-->>API: Valid User Profile & Roles
    API->>API: Generate Access Token (15m expiry, RS256/HS256)
    API->>API: Generate Refresh Token (30d expiry, UUIDv4)
    API-->>App: Return { accessToken, refreshToken, user }
    App->>SecureStore: Securely write tokens to Keychain / KeyStore

    Note over User, Supabase: Step 2: Authenticated API Requests
    App->>API: GET /api/v1/appointments (Header: Bearer <accessToken>)
    API->>API: Verify Signature & Extract { userId, roles }
    API->>Supabase: Execute query under authenticated user context
    Supabase-->>API: Return Protected Records
    API-->>App: 200 OK with Data

    Note over User, Supabase: Step 3: Automated Token Rotation
    App->>API: Request with Expired Access Token
    API-->>App: 401 Unauthorized (Token Expired)
    App->>SecureStore: Read refreshToken
    App->>API: POST /api/v1/auth/refresh { refreshToken }
    API->>API: Verify & Invalidate Old Refresh Token (Rotation)
    API->>API: Issue New Access Token & New Refresh Token
    API-->>App: 200 OK { accessToken, refreshToken }
    App->>SecureStore: Overwrite with New Tokens
    App->>API: Re-execute Original Pending Request
```

---

## 2. Cryptographic Token Design

### 2.1 Access Token (JWT)
* **Format:** Signed JSON Web Token (`HMAC-SHA256` or `RS256`).
* **Lifetime:** 15 minutes.
* **Payload Claims:**
  ```json
  {
    "sub": "b2c954e1-2a6d-472e-8591-9e79b940026a",
    "email": "sarah.jenkins@example.com",
    "roles": ["pet_parent"],
    "aud": "vetopia-mobile-app",
    "iss": "https://api.vetopia.com",
    "iat": 1758547200,
    "exp": 1758548100
  }
  ```

### 2.2 Refresh Token
* **Format:** Cryptographically secure 256-bit random string (UUID v4 or opaque token).
* **Lifetime:** 30 days rolling.
* **Rotation Policy:** Single-use token rotation. When a refresh token is exchanged, it is immediately invalidated in the database, and a new refresh token is issued.
* **Replay Attack Detection:** If a previously used refresh token is submitted, the system flags a breach and immediately revokes all active refresh tokens for that user account.

---

## 3. Secure Storage on React Native

* **Implementation:** `expo-secure-store`
* **iOS Backend:** Apple Keychain Services (Encrypted with hardware AES-256 keys tied to device passcode).
* **Android Backend:** Android KeyStore Provider with Keyguard / Biometric authorization.
* **Storage Invariant:** Tokens must **never** be written to `AsyncStorage`, Redux state persisted to disk, or plaintext files.

---

## 4. Threat Modeling & Mitigation

| Threat Vector | Severity | Mitigation Strategy |
| :--- | :---: | :--- |
| **Credential Stuffing** | High | IP-based rate limiting (5 attempts per 15 min via Redis); Zod schema sanitization. |
| **Token Theft / Man-in-the-Middle** | Critical | Enforce TLS 1.3 HTTPS; native SSL certificate pinning; short 15-minute access token lifespan. |
| **Device Compromise / Jailbreak** | High | Biometric re-authentication prompt on sensitive flows (e.g. initiating payment or editing medical records). |
| **Cross-Tenant Data Exposure** | Critical | Dual-layer protection: Express RBAC middleware checks + Supabase Row Level Security (RLS) on PostgreSQL. |
| **Unauthorized Telemedicine Entry**| Critical | WebRTC signaling channels require appointment participant validation (`is_appointment_participant`). |
