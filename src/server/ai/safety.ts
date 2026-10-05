/**
 * AI Clinical Safety & Red-Flag Triage Guardrails (MVP-09)
 * Vetopia Mobile
 */

import { PetClinicalContext } from '../../types/ai';

export const CLINICAL_SYSTEM_PROMPT = `You are "Vetopia AI", the official veterinary triage assistant for Vetopia (The Pets Club).

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
4. You are an educational triage assistant, NOT a substitute for an in-person physical examination. State uncertainty clearly when physical inspection is needed.`;

export interface RedFlagRule {
  category: string;
  pattern: RegExp;
  reason: string;
}

export const RED_FLAG_RULES: RedFlagRule[] = [
  {
    category: 'toxic_ingestion',
    pattern:
      /\b(chocolate|dark chocolate|cocoa|rodenticide|rat poison|antifreeze|xylitol|lily|lilies|grape|raisin|ibuprofen|tylenol|acetaminophen|advil)\b/i,
    reason: 'Suspected acute toxicity or poisoning ingestion.',
  },
  {
    category: 'respiratory_distress',
    pattern:
      /\b(difficulty breathing|can't breathe|cannot breathe|struggling to breathe|dyspnea|gasping|choking|blue gums|cyanosis|shallow breathing|labored breathing)\b/i,
    reason: 'Acute respiratory distress or airway compromise.',
  },
  {
    category: 'neurological_crisis',
    pattern:
      /\b(seizure|seizures|convulsing|convulsion|shaking uncontrollably|tremoring|tremors|collapse|collapsed|unresponsive|unconscious|fainted|loss of consciousness)\b/i,
    reason: 'Acute neurological seizure, tremoring, or physical collapse.',
  },
  {
    category: 'gastric_torsion_gdv',
    pattern:
      /\b(bloat|bloated|hard stomach|distended abdomen|retching|dry heaving|swollen belly|gastric torsion|gdv)\b/i,
    reason:
      'Suspected Gastric Dilatation-Volvulus (GDV / Bloat), requiring immediate surgical decompression.',
  },
  {
    category: 'severe_trauma_hemorrhage',
    pattern:
      /\b(hit by car|hit by a car|bleeding heavily|arterial bleeding|gushing blood|profuse bleeding|fracture|broken bone|compound fracture|gunshot)\b/i,
    reason: 'Severe blunt trauma, fracture, or active arterial hemorrhage.',
  },
  {
    category: 'urinary_obstruction',
    pattern:
      /\b(can't pee|cannot pee|unable to urinate|no urine|straining to pee|blocked cat|urinary blockage)\b/i,
    reason: 'Potential urethral obstruction / blocked urinary tract.',
  },
  {
    category: 'heatstroke',
    pattern:
      /\b(heatstroke|heat stroke|overheated in car|hot car|collapsed in sun|hyperthermia)\b/i,
    reason: 'Severe thermal hyperthermia / acute heatstroke.',
  },
];

/**
 * Deterministic multi-layer red flag detector
 * Runs client/server defense-in-depth prior to and during LLM evaluation
 */
export function detectRedFlags(text: string): { isEmergency: boolean; redFlags: string[] } {
  if (!text || typeof text !== 'string') {
    return { isEmergency: false, redFlags: [] };
  }

  const redFlags: string[] = [];

  for (const rule of RED_FLAG_RULES) {
    if (rule.pattern.test(text)) {
      redFlags.push(`${rule.category}: ${rule.reason}`);
    }
  }

  // Also check for the explicit model-generated emergency token
  const hasEmergencyToken = text.includes('[EMERGENCY_DETECTED]');

  return {
    isEmergency: redFlags.length > 0 || hasEmergencyToken,
    redFlags,
  };
}

/**
 * Sanitizes pet context to strictly prevent leaking non-clinical PII
 */
export function sanitizePetContext(pet: any): PetClinicalContext | undefined {
  if (!pet || typeof pet !== 'object') {
    return undefined;
  }

  return {
    id: String(pet.id || ''),
    name: String(pet.name || 'Pet').slice(0, 50),
    species: String(pet.species || 'Unknown').slice(0, 30),
    breed: pet.breed ? String(pet.breed).slice(0, 50) : null,
    age: pet.age ? String(pet.age).slice(0, 20) : null,
    weight_kg: typeof pet.weight_kg === 'number' ? pet.weight_kg : null,
    allergies: Array.isArray(pet.allergies)
      ? pet.allergies.map((a: any) => String(a).slice(0, 50))
      : [],
    conditions: Array.isArray(pet.conditions)
      ? pet.conditions.map((c: any) => String(c).slice(0, 50))
      : [],
  };
}
