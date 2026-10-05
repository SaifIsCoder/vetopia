/**
 * AI Assistant & Triage Domain Types (MVP-09)
 * Vetopia Mobile
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  isEmergency?: boolean;
  redFlags?: string[];
}

export interface PetClinicalContext {
  id: string;
  name: string;
  species: string;
  breed?: string | null;
  age?: string | null;
  weight_kg?: number | null;
  allergies?: string[] | null;
  conditions?: string[] | null;
}

export interface TriageChatRequest {
  messages: {
    role: 'user' | 'assistant';
    content: string;
  }[];
  petId?: string;
  petContext?: PetClinicalContext;
}

export interface TriageStreamEvent {
  text?: string;
  isEmergency?: boolean;
  redFlags?: string[];
  error?: string;
  done?: boolean;
}
