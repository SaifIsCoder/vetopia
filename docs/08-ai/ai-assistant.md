# 24/7 AI Triage Assistant — Vetopia Mobile MVP

This document specifies the artificial intelligence architecture for the **Vetopia Mobile MVP**, implementing a basic veterinary triage assistant powered by Google Gemini 2.5 Flash.

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
      ├──── POST /api/v1/ai/triage ┼───────────────────────────────┤
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
2. Two high-priority action buttons are displayed:
   * **`Call Local Emergency Hotline`:** Launches native phone dialer (`Linking.openURL('tel:911')` or local emergency vet clinic).
   * **`Connect to On-Duty Telemedicine Vet`:** Opens `VetDirectoryScreen` filtered by veterinarians with immediate availability.

---

## 5. Privacy, Rate Limiting & Error Handling

* **PII Protection:** User names, credit card info, and private address details are stripped before forwarding context to upstream LLM gateways.
* **Rate Limiting:** Authenticated users are limited to 15 triage sessions per hour. Unauthenticated guests are limited to 3 sessions per 24 hours per device IP.
* **Fallback Behavior:** If the upstream LLM returns a 429 or 504 error, the client gracefully renders:
  *"Our AI assistant is temporarily unavailable. If your pet is experiencing urgent symptoms, please consult a verified veterinarian on our platform or contact an emergency clinic."*
