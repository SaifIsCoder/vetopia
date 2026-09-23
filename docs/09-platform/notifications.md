# Notification Architecture — Vetopia Mobile MVP

This document specifies the push and in-app notification infrastructure, lifecycle triggers, payload schemas, deep link resolution, and retry strategies for the **Vetopia Mobile MVP**.

---

## 1. Notification Delivery Pipeline

```
Backend Event (DB / API)
        │
        ▼
Express Notification Service (Batch Worker)
        │
        ▼ (HTTPS)
Expo Push Notification Gateway (Exponent Server SDK)
        │
        ├──────────────────────┬──────────────────────┐
        ▼                      ▼                      ▼
  Apple APNs             Google FCM            In-App Database
  (iOS Devices)          (Android Devices)     (notifications table)
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               ▼
                    Native Notification Banner
                               │
                    (User Taps Notification)
                               ▼
                   Universal Deep Link Handler
                               │
                    Target Application Screen
```

---

## 2. Notification Triggers & Payloads

| Notification Event | Trigger Condition | Target Recipient | Channel / Priority | Deep Link Route |
| :--- | :--- | :--- | :--- | :--- |
| **`APPT_CONFIRMED`** | Appointment booked | Pet Parent & Vet | Push + In-App (High) | `vetopia://appointments/:id` |
| **`APPT_REMINDER_15M`**| 15 mins before call | Pet Parent & Vet | Push + In-App (Critical)| `vetopia://consult/:id` |
| **`DOCTOR_JOINED`** | Doctor in call room | Pet Parent | Push (Critical Alert)| `vetopia://consult/:id` |
| **`NEW_MESSAGE`** | New DM in thread | Message Recipient | Push + In-App (Normal)| `vetopia://messages/:id` |
| **`PRESCRIPTION_READY`**| Vet issues e-script | Pet Parent | Push + In-App (High) | `vetopia://prescriptions/:id` |
| **`APPT_CANCELLED`** | Participant cancels | Counterpart | Push + In-App (High) | `vetopia://appointments/:id` |

---

## 3. Standard Notification Payload Schema

```json
{
  "to": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "sound": "default",
  "title": "Consultation Starting in 15 Minutes",
  "body": "Dr. Sarah Mitchell is preparing for Buddy's consultation.",
  "data": {
    "notificationId": "8f3e1b72-019a-4c28-9d41-e734c56890ab",
    "kind": "APPT_REMINDER_15M",
    "deepLink": "vetopia://consult/b2c954e1-2a6d-472e-8591-9e79b940026a",
    "appointmentId": "b2c954e1-2a6d-472e-8591-9e79b940026a"
  },
  "priority": "high",
  "channelId": "consultations"
}
```

---

## 4. Android Notification Channels

Vetopia Mobile registers two distinct notification channels on Android (`notifee` or `expo-notifications`):
1. **`consultations` (High/Urgent Priority):** Bypasses Do Not Disturb (with permission), enables vibration pattern and high-priority heads-up banner for incoming calls and 15-minute appointment countdowns.
2. **`messages_general` (Normal Priority):** Standard notification sound and notification center delivery for chat messages and general updates.
