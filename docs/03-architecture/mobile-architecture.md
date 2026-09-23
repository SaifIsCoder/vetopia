# Mobile Technical Architecture — Vetopia Mobile MVP

## 1. Technical Stack

| Architectural Layer | Technology Selected | Version / Package | Rationale |
| :--- | :--- | :--- | :--- |
| **Core Framework** | React Native + Expo | SDK 52+ / React 18.3+ | Native cross-platform performance, standard native module ecosystem, EAS build pipelines |
| **Language** | TypeScript | 5.4+ (Strict Mode) | Strong type-safety across shared API contracts and database models |
| **Navigation & Routing** | Expo Router | v4+ | File-based routing, deep linking, native stack performance, modal ergonomics |
| **UI Component System** | Vanilla React Native StyleSheet + NativeWind | Tailwind v3.4 | Consistent styling adhering to Vetopia OKLCH extracted design tokens |
| **Server State Caching** | TanStack React Query | v5.50+ | Automatic caching, stale-while-revalidate, query invalidation, retry backoff |
| **Client State Store** | Zustand | v4.5+ | Minimalist, boilerplate-free state management for auth, user settings, and call status |
| **Secure Key Storage** | `expo-secure-store` | Latest | Hardware-backed iOS Keychain and Android KeyStore for JWT tokens |
| **Fast Local Storage** | `react-native-mmkv` | Latest | High-speed synchronous key-value storage for pet passport offline caching |
| **WebRTC & Managed RTC** | LiveKit React Native SDK (`@livekit/react-native`) | Latest | Managed WebRTC SFU, hardware video decoders, adaptive bitrate, mobile network reconnection |
| **Image Handling** | `expo-image` | Latest | Native memory/disk LRU caching, progressive image rendering, WebP decoding |
| **List Virtualization** | `@shopify/flash-list` | Latest | 60fps virtualization for long doctor directories, messages, and passports |
| **Realtime Gateway** | `@supabase/supabase-js` | v2.45+ | WebSocket channel subscriptions for appointment events and 1-to-1 P2P messaging |

---

## 2. Layered Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                   PRESENTATION LAYER                        │
│   Expo Router Screens · Atomic UI Components · Modals       │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    STATE & HOOKS LAYER                      │
│   TanStack Query (Server) · Zustand (Client) · Custom Hooks │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    SERVICE & API LAYER                      │
│   Axios Interceptor · Supabase Realtime · Storage Client    │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
┌──────────────▼──────────────┐ ┌─────────────▼───────────────┐
│     NATIVE HARDWARE LAYER   │ │     LOCAL STORAGE LAYER     │
│ Camera · Microphone · WebRTC│ │ expo-secure-store · MMKV    │
│ Push Notifications (APNs/FCM)│ │ Offline Health Passport Cache│
└─────────────────────────────┘ └─────────────────────────────┘
```

---

## 3. Communication Protocols

1. **REST APIs (HTTPS / JSON):**
   * Express.js backend serves structured business logic, doctor availability queries, appointment booking transactions, and e-prescriptions over TLS 1.3.
2. **WebSocket Channels (WSS):**
   * Supabase Realtime manages WebRTC call signals (`public.call_signals`) and 1-to-1 direct messaging events (`public.direct_messages`) with sub-second message dispatch.
3. **Managed WebRTC Video & Audio (SRTP / UDP via LiveKit SFU):**
   * Live consultation audio and video streams route through secure LiveKit Cloud SFU nodes with backend-issued short-lived JWT room tokens (`POST /api/v1/telemedicine/token`). Media streams never touch the Express API or Supabase database.
4. **Push Notifications (APNs / FCM):**
   * Triggered by backend webhooks via the Expo Push API for background notifications when app is closed.

---

## 4. Offline Capabilities & Fault Tolerance

* **Pet Passport Snapshot:** Whenever the user views their pet's health passport, the data is automatically serialized to `react-native-mmkv`. In zero-connectivity scenarios, the screen seamlessly reads from this local cache, displaying an "Offline Mode" chip.
* **Network Status Monitor:** Application listens to `@react-native-community/netinfo`. If connectivity drops during a live WebRTC consultation, an overlay banner alerts the user while `RTCPeerConnection` attempts automatic ICE reconnection.
