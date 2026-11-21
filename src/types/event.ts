/**
 * Community Event Type Definitions (M4)
 *
 * Mirrors the `public.events` table created in migration
 * 20261025120000_m4_community_blogs_events.sql. Authoring is restricted at the
 * database (RLS) layer to verified veterinarians and administrators; drafts and
 * cancelled events are hidden from the public via RLS.
 */

export type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

export type EventType = 'virtual' | 'in_person';

export type EventCategory =
  | 'Webinar'
  | 'Vaccination Clinic'
  | 'Adoption Fair'
  | 'Breed Meetup'
  | 'Training Workshop'
  | string;

export interface EventOrganizer {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface CommunityEvent {
  id: string;
  slug: string;
  title: string;
  description: string;
  cover_image: string | null;
  category: EventCategory;
  event_type: EventType;
  location_or_url: string;
  start_time: string;
  end_time: string;
  organizer_id: string;
  organizer_name: string;
  status: EventStatus;
  created_at: string;
  updated_at: string;
  organizer?: EventOrganizer;
  is_vet_verified?: boolean;
}

export interface CreateEventDTO {
  slug?: string;
  title: string;
  description: string;
  cover_image?: string | null;
  category: EventCategory;
  event_type: EventType;
  location_or_url: string;
  start_time: string;
  end_time: string;
  organizer_name: string;
  status?: EventStatus;
}

export interface UpdateEventDTO {
  slug?: string;
  title?: string;
  description?: string;
  cover_image?: string | null;
  category?: EventCategory;
  event_type?: EventType;
  location_or_url?: string;
  start_time?: string;
  end_time?: string;
  organizer_name?: string;
  status?: EventStatus;
}

export interface EventListResponse {
  events: CommunityEvent[];
  hasMore: boolean;
  nextCursor?: string;
}
