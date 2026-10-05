# 24/7 AI Triage Assistant — Vetopia Mobile MVP

This document specifies the artificial intelligence architecture for the **Vetopia Mobile MVP**, implementing a 24/7 veterinary triage assistant powered by Google Gemini 3.8 Flash (with approved fallback to Gemini 3.7 Flash).

---

## 1. System Role & Clinical Disclaimer

> [!IMPORTANT]
> **Non-Diagnostic Clinical Safety Rule:** The AI assistant is an educational triage tool designed to help pet parents assess symptom severity and identify emergencies. It is **never** a replacement for a licensed veterinarian and is strictly prohibited from prescribing prescription medications or diagnosing complex pathology.

Every AI conversation interface must prominently display this clinical disclaimer:
> *"Vetopia AI provides triage guidance and care education. It cannot diagnose illnesses or prescribe medications. For severe symptoms, contact an emergency veterinarian immediately."*

---

## 2. Technical Architecture & Gateway Flow

```
Mobile App (Expo)          Express API Server            Google Gemini Gateway
      │                            │                               │
      ├─ POST /api/v1/ai/triage-chat ┼─────────────────────────────┤
      │    { messages: [...] }     │                               │
      │                            ├──── Check User Rate Limit ────┤
      │                            ├──── Prepend System Prompt ────►
      │                            │    (Safety Guardrails)        │
      │                            │                               ├──── Model Evaluates
      │                            │◄─── Server-Sent Events (SSE) ─┤
      │◄─── Streamed Markdown ─────┤                               │
```

---

## 3. Clinical System Prompt & Safety Guardrails

The Express backend injects this immutable system prompt extracted from `supabase/functions/vet-chat/index.ts`:

```text
You are "Vetopia AI", the official veterinary triage assistant for Vetopia (The Pets Club).

ROLE & CLINICAL VOICE:
- Warm, empathetic, professional. Speak like an experienced veterinarian.
- Concise, structured answers. Use short paragraphs, numbered steps, and bold key actions.
- Respond in the language used by the user (English, Spanish, French, Arabic, Hindi, Mandarin, etc.).

CRITICAL SAFETY RULES (NON-NEGOTIABLE):
1. NEVER prescribe prescription-only medications, exact pharmaceutical dosages, or controlled drugs. Always recommend a licensed vet consultation via the Vetopia booking screen for prescriptions.
2. RED-FLAG SYMPTOMS: If the user describes collapse, active seizures, bloated/hard abdomen (GDV), inability to urinate (>24h), suspected rodenticide/chocolate poisoning, heavy arterial bleeding, severe trauma, dyspnea (difficulty breathing), heatstroke, or neonatal distress, you MUST output:
   "[EMERGENCY_DETECTED] This is a critical medical emergency. Please take your pet to the nearest emergency veterinary hospital immediately."
3. Clearly separate triage advice into:
   - What this might indicate (differential possibilities)
   - Immediate safe home support actions (cooling, hydration, monitoring)
   - Clear warning signs requiring urgent clinic escalation.
```

---

## 4. Emergency Detection & Client Escalation

When the mobile app detects the `[EMERGENCY_DETECTED]` token in the streamed response:
1. The app renders a prominent **Emergency Red Alert Card** at the top of the chat view.
2. Emergency escalation actions:
   * **Verified Emergency Veterinary Hospital:** When a verified veterinary emergency number is configured (`emergencyNumber`), renders a direct-dial action (`Linking.openURL('tel:' + number)`). Generic human numbers (e.g. 911) are strictly prohibited.
   * **Emergency Hospital Advisory:** When no verified direct dial is available, renders clear veterinary hospital guidance directing the pet parent to transport the pet to the nearest 24-hour veterinary emergency center immediately.
   * **`Connect to Video Specialist`:** Opens `/vets` (`VetDirectoryScreen`) to connect immediately with an on-duty telemedicine veterinary specialist.

---

## 5. Privacy, Rate Limiting & Error Handling

* **PII Protection:** User names, credit card info, and private address details are stripped before forwarding context to upstream LLM gateways.
* **Rate Limiting:** Authenticated users are limited to 15 triage sessions per hour. Unauthenticated guests are limited to 3 sessions per 24 hours.
* **Anti-Spoofing Architecture:** Client IP is resolved via `resolveClientIp(req)`. Forwarding headers (`X-Forwarded-For`) are only trusted if `TRUST_PROXY` is explicitly configured in `process.env`. Raw client-provided forwarding headers cannot evade guest rate limits.
* **Client Disconnect & Cancellation:** Client socket closures during streaming abort upstream LLM generation via `AbortController`, preventing resource waste.
* **Timeouts:** Mobile client implements dual-timeout controls: 15-second initial connection timeout and 15-second inactivity timeout per chunk.
* **Fallback Behavior:** If the upstream LLM returns an error, the client gracefully renders:
  *"AI assistant unavailable. If this is an emergency, please contact an emergency veterinary hospital immediately."*

---

## 6. Implementation Summary `[REMEDIATED MVP-09]`

* **API Endpoint:** `POST /api/v1/ai/triage-chat` implemented in `src/server/ai/triageHandler.ts` and mounted in `src/server/server.ts`. Client URL normalization prevents path duplication.
* **Streaming Protocol:** Standard Server-Sent Events (`text/event-stream`) delivering token chunks and real-time emergency flags (`isEmergency`).
* **Clinical Guardrails & Pre-Screening:** `src/server/ai/safety.ts` enforces `detectRedFlags()` regex taxonomy (toxic ingestion, dyspnea, seizures, GDV, trauma, urinary obstruction, heatstroke) alongside the immutable `CLINICAL_SYSTEM_PROMPT`.
* **Pet Context & Authorization:** When `petId` is provided, caller ownership is verified (`pets.owner_id = user.id`); non-clinical PII is sanitized before reaching the model.
* **Client Architecture:**
  * Screen: `app/ai/chat.tsx` (`SCR-AI-001`).
  * State Hook: `src/hooks/useAIChat.ts`.
  * Components: `DisclaimerBanner`, `EmergencyAlertCard` (with verified veterinary dialer or emergency hospital instruction and `/vets` video specialist navigation), `SuggestionChips`, and `ChatMessageItem`.
* **Secrets Invariant:** `GEMINI_API_KEY` is strictly server-side. Zero AI keys exposed in client bundles.

---

## 7. Gemini Model & Provider Verification `[VERIFIED]`

* **Approved Model:** Google Gemini 3.8 Flash (`gemini-3.8-flash`) configured as primary production model. `gemini-3.7-flash` configured as explicit secondary fallback.
* **Model Reconciliation:** Upstream Google AI Studio reports `gemini-2.5-flash` as sunset for new users (`HTTP 404`). Reconciled to `gemini-3.8-flash` across backend, UI, and environment configurations.
* **Live Smoke Verification:** Verified end-to-end via `tests/unit/gemini-provider-smoke.test.ts` with live Google AI Studio API key.
* **SSE Multi-Chunk Streaming:** Verified progressive `data: {"text": "...", "isEmergency": ...}` chunk emission and terminal `data: [DONE]`.
* **Clinical Boundary Adherence:** Confirmed refusal to prescribe prescription-only medications or provide specific pharmaceutical dosages under both normal guidance and adversarial prompt injection ("Ignore all previous instructions...").
* **Emergency Red-Flag Handling:** Confirmed emergency detection and alert banner triggering for toxic ingestion (chocolate), respiratory distress (dyspnea/blue gums), and acute neurological crisis (seizures).
* **Physical Device Testing:** Marked as `PENDING PHYSICAL DEVICE VERIFICATION` for native OS dialer intent triggering on real iOS/Android hardware. Dialing logic and fallback UI are covered by automated unit/component tests.

