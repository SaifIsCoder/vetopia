# Entity Relationship Diagram (ERD) — Vetopia Mobile MVP

This diagram illustrates the relational database model for the **Vetopia Mobile MVP**, showing primary keys, foreign keys, cardinality, and relationships across users, pets, clinical appointments, prescriptions, messaging, and notifications.

```mermaid
erDiagram
    USERS ||--|| PROFILES : "has identity (1:1)"
    USERS ||--o{ USER_ROLES : "assigned roles (1:N)"
    USERS ||--o{ PETS : "owns pets (1:N)"
    USERS ||--o| VET_PROFILES : "doctor account (1:1)"
    USERS ||--o{ APPOINTMENTS : "books consults as parent (1:N)"
    USERS ||--o{ DIRECT_MESSAGES : "sends messages (1:N)"
    USERS ||--o{ CONVERSATION_PARTICIPANTS : "participates in (1:N)"
    USERS ||--o{ NOTIFICATIONS : "receives alerts (1:N)"
    USERS ||--o{ DEVICE_TOKENS : "registers devices (1:N)"

    VET_PROFILES ||--o{ VET_AVAILABILITY : "defines weekly hours (1:N)"
    VET_PROFILES ||--o{ APPOINTMENTS : "conducts consults as vet (1:N)"
    VET_PROFILES ||--o{ PRESCRIPTIONS : "issues e-scripts (1:N)"

    PETS ||--o{ APPOINTMENTS : "patient in consult (1:N)"
    PETS ||--o{ PRESCRIPTIONS : "prescribed for (1:N)"

    APPOINTMENTS ||--o{ CALL_SIGNALS : "WebRTC signals (1:N)"
    APPOINTMENTS ||--o{ MESSAGES : "in-call chat messages (1:N)"
    APPOINTMENTS ||--o| PRESCRIPTIONS : "consult outcome (1:1)"

    PRESCRIPTIONS ||--|{ PRESCRIPTION_ITEMS : "contains medications (1:N)"

    CONVERSATIONS ||--|{ CONVERSATION_PARTICIPANTS : "has members (1:N)"
    CONVERSATIONS ||--o{ DIRECT_MESSAGES : "contains messages (1:N)"

    USERS {
        uuid id PK
        string email
        timestamp created_at
    }

    PROFILES {
        uuid id PK, FK
        string full_name
        string username UK
        string phone
        string avatar_url
        string bio
        string location
        boolean onboarded
        timestamp updated_at
    }

    USER_ROLES {
        uuid id PK
        uuid user_id FK
        enum role "pet_parent, vet, admin"
    }

    VET_PROFILES {
        uuid id PK
        uuid user_id FK, UK
        string name
        string specialty
        string country
        string[] languages
        numeric price_usd
        int slot_minutes
        numeric rating
        boolean verified
        boolean accepting
    }

    VET_AVAILABILITY {
        uuid id PK
        uuid vet_id FK
        int weekday "0=Sun, 6=Sat"
        int start_minute "0-1440"
        int end_minute "0-1440"
    }

    PETS {
        uuid id PK
        uuid owner_id FK
        string name
        string species
        string breed
        string age
        string sex
        numeric weight_kg
        string bio
        string photo_url
        timestamp created_at
    }

    APPOINTMENTS {
        uuid id PK
        uuid vet_id FK
        uuid pet_parent_id FK
        uuid pet_id FK
        timestamp starts_at
        timestamp ends_at
        string mode "video, audio, chat"
        string status "scheduled, completed, cancelled"
        string symptoms
        string urgency
        numeric price_usd
    }

    CALL_SIGNALS {
        uuid id PK
        uuid appointment_id FK
        uuid sender_id FK
        string kind "offer, answer, ice, hangup"
        jsonb payload
        timestamp created_at
    }

    MESSAGES {
        uuid id PK
        uuid appointment_id FK
        uuid sender_id FK
        text body
        timestamp created_at
    }

    PRESCRIPTIONS {
        uuid id PK
        uuid appointment_id FK
        uuid vet_id FK
        uuid pet_id FK
        text diagnosis
        text notes
        string status "active, completed, cancelled"
        timestamp created_at
    }

    PRESCRIPTION_ITEMS {
        uuid id PK
        uuid prescription_id FK
        string medication_name
        string dosage
        string frequency
        int duration_days
        string instructions
        int refills_allowed
    }

    CONVERSATIONS {
        uuid id PK
        enum kind "general, appointment"
        string subject
        uuid created_by FK
        timestamp last_message_at
    }

    CONVERSATION_PARTICIPANTS {
        uuid id PK
        uuid conversation_id FK
        uuid user_id FK
        enum side "member, vet, parent"
        timestamp last_read_at
    }

    DIRECT_MESSAGES {
        uuid id PK
        uuid conversation_id FK
        uuid sender_id FK
        text body
        timestamp created_at
    }

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        string title
        string body
        string kind
        jsonb data
        boolean read
        timestamp created_at
    }

    DEVICE_TOKENS {
        uuid id PK
        uuid user_id FK
        string token
        string platform "ios, android"
        timestamp updated_at
    }
```
