/**
 * Clinical Messaging Domain Types — Vetopia Mobile MVP-07
 * Specification: mobile/docs/07-realtime/messaging.md & docs/05-database/database-design.md
 */

export type ConversationKind = 'general' | 'marketplace' | 'adoption';
export type ParticipantSide = 'member' | 'vet' | 'buyer' | 'seller' | 'adopter' | 'rehomer';

export interface Conversation {
  id: string;
  kind: ConversationKind;
  subject: string;
  appointment_id?: string | null;
  open_to_join: boolean;
  created_by: string;
  created_at: string;
  last_message_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  side: ParticipantSide;
  last_read_at: string;
  created_at: string;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  /** Client-side optimistic dispatch status */
  status?: 'sending' | 'sent' | 'failed';
}

export interface ConversationCounterpart {
  user_id: string;
  name: string;
  avatar_url?: string | null;
  role: 'vet' | 'pet_parent';
  specialty?: string | null;
}

export interface ConversationAppointmentContext {
  id: string;
  starts_at: string;
  status: string;
  mode: 'video' | 'audio' | 'chat';
  pet_name: string;
  vet_name: string;
}

export interface ConversationSummary {
  id: string;
  subject: string;
  appointment_id?: string | null;
  created_at: string;
  last_message_at: string;
  unread_count: number;
  last_message?: {
    id: string;
    body: string;
    sender_id: string;
    created_at: string;
  } | null;
  counterpart?: ConversationCounterpart | null;
  appointment?: ConversationAppointmentContext | null;
}

export interface SendMessageDTO {
  conversation_id: string;
  body: string;
}

export interface CreateAppointmentConversationResponse {
  id: string;
  appointment_id: string;
  subject: string;
  created_at: string;
  last_message_at: string;
  is_new: boolean;
}
