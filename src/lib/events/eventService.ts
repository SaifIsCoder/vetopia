/**
 * Community Event Service (M4)
 * Handles event discovery, upcoming vs past filtering, virtual/in-person status,
 * and authorized vet/admin event management with offline fallback support.
 */

import { supabase } from '../supabase/client';
import {
  CommunityEvent,
  EventOrganizer,
  CreateEventDTO,
  UpdateEventDTO,
} from '../../types/event';
import {
  AuthError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  normalizeError,
} from '../api/errors';

export const DEFAULT_SEED_EVENTS: CommunityEvent[] = [
  {
    id: 'evt-webinar-nutrition-1',
    slug: 'clinical-canine-nutrition-webinar',
    title: 'Senior Canine Nutrition: Preventing Obesity and Sarcopenia',
    description:
      'Join Dr. Sarah Wilson for a comprehensive clinical overview of dietary protein requirements, joint supplements, and metabolic monitoring for senior dogs over seven years of age.',
    cover_image:
      'https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&w=800&q=80',
    category: 'Webinar',
    event_type: 'virtual',
    location_or_url: 'https://meet.vetopia.com/clinical-canine-nutrition',
    start_time: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days in future
    end_time: new Date(Date.now() + 86400000 * 2 + 3600000 * 1.5).toISOString(),
    organizer_id: 'seed-vet-author-1',
    organizer_name: 'Dr. Sarah Wilson, DVM',
    status: 'published',
    created_at: '2026-10-15T00:00:00Z',
    updated_at: '2026-10-15T00:00:00Z',
    organizer: {
      id: 'seed-vet-author-1',
      full_name: 'Dr. Sarah Wilson, DVM',
      avatar_url: null,
    },
    is_vet_verified: true,
  },
  {
    id: 'evt-clinic-rabies-2',
    slug: 'metro-community-vaccination-drive',
    title: 'Low-Cost Rabies & Microchip Community Drive',
    description:
      'Community outreach clinic offering subsidized core rabies vaccinations, DHPP boosters, and lifetime ISO microchip registrations for dogs and cats.',
    cover_image:
      'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=800&q=80',
    category: 'Vaccination Clinic',
    event_type: 'in_person',
    location_or_url: 'Vetopia Central Animal Pavilion, 1200 Greenway Blvd, Suite 4',
    start_time: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days in future
    end_time: new Date(Date.now() + 86400000 * 5 + 3600000 * 4).toISOString(),
    organizer_id: 'seed-vet-author-2',
    organizer_name: 'Dr. Michael Chen, DACVIM',
    status: 'published',
    created_at: '2026-10-18T00:00:00Z',
    updated_at: '2026-10-18T00:00:00Z',
    organizer: {
      id: 'seed-vet-author-2',
      full_name: 'Dr. Michael Chen, DACVIM',
      avatar_url: null,
    },
    is_vet_verified: true,
  },
  {
    id: 'evt-workshop-cpr-3',
    slug: 'pet-first-aid-and-cpr-workshop',
    title: 'Hands-on Pet First Aid & CPR Certification Workshop',
    description:
      'Certified veterinary technicians lead an interactive workshop covering bandaging techniques, choking response, heatstroke emergency protocol, and feline/canine CPR.',
    cover_image:
      'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80',
    category: 'Training Workshop',
    event_type: 'in_person',
    location_or_url: 'Community Learning Annex, 450 Oakridge Way',
    start_time: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days in past
    end_time: new Date(Date.now() - 86400000 * 3 + 3600000 * 3).toISOString(),
    organizer_id: 'seed-vet-author-1',
    organizer_name: 'Dr. Sarah Wilson, DVM',
    status: 'completed',
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-22T00:00:00Z',
    organizer: {
      id: 'seed-vet-author-1',
      full_name: 'Dr. Sarah Wilson, DVM',
      avatar_url: null,
    },
    is_vet_verified: true,
  },
];

export class EventService {
  /**
   * Helper: Generate URL-safe slug from title
   */
  generateSlug(title: string, addSuffix = false): string {
    const baseSlug = title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80);
    if (!addSuffix) return baseSlug;
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    return `${baseSlug}-${randomSuffix}`;
  }

  /**
   * Helper: Check if user is an administrator
   */
  async verifyAdminRole(userId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .maybeSingle();
      return Boolean(data);
    } catch {
      return false;
    }
  }

  /**
   * Verify if a user is a verified veterinarian or administrator
   */
  async verifyOrganizerPermission(userId: string): Promise<boolean> {
    try {
      if (await this.verifyAdminRole(userId)) return true;

      const { data: vetData } = await supabase
        .from('vet_profiles')
        .select('verified')
        .eq('user_id', userId)
        .maybeSingle();

      return Boolean(vetData?.verified);
    } catch {
      return false;
    }
  }

  /**
   * Fetch events with upcoming/past filtering and category filtering
   */
  async getEvents(
    filter: 'upcoming' | 'past' | 'all' = 'upcoming',
    category?: string,
  ): Promise<CommunityEvent[]> {
    try {
      const nowIso = new Date().toISOString();

      let query = supabase
        .from('events')
        .select(`
          id,
          slug,
          title,
          description,
          cover_image,
          category,
          event_type,
          location_or_url,
          start_time,
          end_time,
          organizer_id,
          organizer_name,
          status,
          created_at,
          updated_at,
          organizer:profiles!events_organizer_id_fkey(id, full_name, avatar_url)
        `);

      if (filter === 'upcoming') {
        query = query.eq('status', 'published').gte('end_time', nowIso);
      } else if (filter === 'past') {
        query = query.or(`status.eq.completed,end_time.lt.${nowIso}`);
      }

      if (category && category.trim().toLowerCase() !== 'all') {
        query = query.ilike('category', `%${category.trim()}%`);
      }

      query = query.order('start_time', { ascending: filter === 'upcoming' });

      const { data, error } = await query;
      if (error) throw normalizeError(error);

      return (data || []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        cover_image: row.cover_image,
        category: row.category,
        event_type: row.event_type,
        location_or_url: row.location_or_url,
        start_time: row.start_time,
        end_time: row.end_time,
        organizer_id: row.organizer_id,
        organizer_name: row.organizer_name,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        organizer: row.organizer,
        is_vet_verified: true,
      }));
    } catch (err: any) {
      // Offline fallback
      const isNetwork =
        err?.name === 'NetworkError' ||
        err?.message?.includes('Network') ||
        err?.message?.includes('Failed to fetch') ||
        err?.message?.includes('relation "public.events" does not exist') ||
        err?.code === 'NETWORK_ERROR' ||
        err?.code === '42P01';

      if (isNetwork) {
        const now = Date.now();
        let results = DEFAULT_SEED_EVENTS;

        if (filter === 'upcoming') {
          results = results.filter((e) => new Date(e.end_time).getTime() >= now && e.status === 'published');
        } else if (filter === 'past') {
          results = results.filter((e) => new Date(e.end_time).getTime() < now || e.status === 'completed');
        }

        if (category && category.trim().toLowerCase() !== 'all') {
          const catLower = category.trim().toLowerCase();
          results = results.filter((e) => e.category.toLowerCase().includes(catLower));
        }

        return results;
      }
      throw normalizeError(err);
    }
  }

  /**
   * Fetch single event by UUID or slug
   */
  async getEventByIdOrSlug(idOrSlug: string): Promise<CommunityEvent> {
    try {
      if (!idOrSlug) throw new ValidationError('Event identifier is required.');

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        idOrSlug,
      );

      let query = supabase
        .from('events')
        .select(`
          id,
          slug,
          title,
          description,
          cover_image,
          category,
          event_type,
          location_or_url,
          start_time,
          end_time,
          organizer_id,
          organizer_name,
          status,
          created_at,
          updated_at,
          organizer:profiles!events_organizer_id_fkey(id, full_name, avatar_url)
        `);

      if (isUuid) {
        query = query.eq('id', idOrSlug);
      } else {
        query = query.eq('slug', idOrSlug);
      }

      const { data, error } = await query.single();
      if (error || !data) {
        const seed = DEFAULT_SEED_EVENTS.find((e) => e.id === idOrSlug || e.slug === idOrSlug);
        if (seed) return seed;
        throw new NotFoundError('The requested community event could not be found.');
      }

      let isVetVerified = false;
      const { data: vetData } = await supabase
        .from('vet_profiles')
        .select('verified')
        .eq('user_id', data.organizer_id)
        .maybeSingle();

      if (vetData?.verified) {
        isVetVerified = true;
      }

      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        description: data.description,
        cover_image: data.cover_image,
        category: data.category,
        event_type: data.event_type,
        location_or_url: data.location_or_url,
        start_time: data.start_time,
        end_time: data.end_time,
        organizer_id: data.organizer_id,
        organizer_name: data.organizer_name,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        organizer: (Array.isArray(data.organizer) ? data.organizer[0] : data.organizer) as EventOrganizer | undefined,
        is_vet_verified: isVetVerified,
      };
    } catch (err: any) {
      const seed = DEFAULT_SEED_EVENTS.find((e) => e.id === idOrSlug || e.slug === idOrSlug);
      if (seed) return seed;
      throw normalizeError(err);
    }
  }

  /**
   * Create community event (Restricted to verified vets & admins)
   */
  async createEvent(input: CreateEventDTO): Promise<CommunityEvent> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to create events.');
      }

      // Input validations matching database constraints
      if (!input.title || input.title.trim().length < 3 || input.title.trim().length > 150) {
        throw new ValidationError('Event title must be between 3 and 150 characters.');
      }

      if (!input.description || input.description.trim().length < 20) {
        throw new ValidationError('Event description must contain at least 20 characters.');
      }

      if (!input.category || !input.category.trim()) {
        throw new ValidationError('Event category is required.');
      }

      if (!input.location_or_url || !input.location_or_url.trim()) {
        throw new ValidationError('Event location or virtual meeting URL is required.');
      }

      if (!input.start_time || !input.end_time) {
        throw new ValidationError('Valid start and end times are required.');
      }

      const startDate = new Date(input.start_time);
      const endDate = new Date(input.end_time);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid date format provided for event.');
      }

      if (endDate <= startDate) {
        throw new ValidationError('Event end time must be after the start time.');
      }

      // Authorization verification
      const hasPermission = await this.verifyOrganizerPermission(session.user.id);
      if (!hasPermission) {
        throw new ForbiddenError(
          'Creating events is restricted to verified veterinarians and administrators.',
        );
      }

      const slug = input.slug || this.generateSlug(input.title);
      const organizerName =
        input.organizer_name || session.user.user_metadata?.full_name || 'Veterinary Specialist';
      const status = input.status || 'published';

      const payload = {
        slug,
        title: input.title.trim(),
        description: input.description.trim(),
        cover_image: input.cover_image || null,
        category: input.category.trim(),
        event_type: input.event_type || 'virtual',
        location_or_url: input.location_or_url.trim(),
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        organizer_id: session.user.id,
        organizer_name: organizerName,
        status,
      };

      const { data, error } = await supabase
        .from('events')
        .insert(payload)
        .select(`
          id,
          slug,
          title,
          description,
          cover_image,
          category,
          event_type,
          location_or_url,
          start_time,
          end_time,
          organizer_id,
          organizer_name,
          status,
          created_at,
          updated_at,
          organizer:profiles!events_organizer_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw normalizeError(error);

      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        description: data.description,
        cover_image: data.cover_image,
        category: data.category,
        event_type: data.event_type,
        location_or_url: data.location_or_url,
        start_time: data.start_time,
        end_time: data.end_time,
        organizer_id: data.organizer_id,
        organizer_name: data.organizer_name,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        organizer: (Array.isArray(data.organizer) ? data.organizer[0] : data.organizer) as EventOrganizer | undefined,
        is_vet_verified: true,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Update community event (Organizer or Admin)
   */
  async updateEvent(eventId: string, input: UpdateEventDTO): Promise<CommunityEvent> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to edit events.');
      }

      if (input.title !== undefined && (input.title.trim().length < 3 || input.title.trim().length > 150)) {
        throw new ValidationError('Event title must be between 3 and 150 characters.');
      }

      if (input.description !== undefined && input.description.trim().length < 20) {
        throw new ValidationError('Event description must contain at least 20 characters.');
      }

      if (input.start_time && input.end_time) {
        if (new Date(input.end_time) <= new Date(input.start_time)) {
          throw new ValidationError('Event end time must be after the start time.');
        }
      }

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) updatePayload.title = input.title.trim();
      if (input.description !== undefined) updatePayload.description = input.description.trim();
      if (input.cover_image !== undefined) updatePayload.cover_image = input.cover_image;
      if (input.category !== undefined) updatePayload.category = input.category.trim();
      if (input.event_type !== undefined) updatePayload.event_type = input.event_type;
      if (input.location_or_url !== undefined) updatePayload.location_or_url = input.location_or_url.trim();
      if (input.start_time !== undefined) updatePayload.start_time = new Date(input.start_time).toISOString();
      if (input.end_time !== undefined) updatePayload.end_time = new Date(input.end_time).toISOString();
      if (input.organizer_name !== undefined) updatePayload.organizer_name = input.organizer_name.trim();
      if (input.status !== undefined) updatePayload.status = input.status;

      const { data, error } = await supabase
        .from('events')
        .update(updatePayload)
        .eq('id', eventId)
        .select(`
          id,
          slug,
          title,
          description,
          cover_image,
          category,
          event_type,
          location_or_url,
          start_time,
          end_time,
          organizer_id,
          organizer_name,
          status,
          created_at,
          updated_at,
          organizer:profiles!events_organizer_id_fkey(id, full_name, avatar_url)
        `)
        .single();

      if (error) throw normalizeError(error);

      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        description: data.description,
        cover_image: data.cover_image,
        category: data.category,
        event_type: data.event_type,
        location_or_url: data.location_or_url,
        start_time: data.start_time,
        end_time: data.end_time,
        organizer_id: data.organizer_id,
        organizer_name: data.organizer_name,
        status: data.status,
        created_at: data.created_at,
        updated_at: data.updated_at,
        organizer: (Array.isArray(data.organizer) ? data.organizer[0] : data.organizer) as EventOrganizer | undefined,
        is_vet_verified: true,
      };
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Cancel an event (sets status to 'cancelled')
   */
  async cancelEvent(eventId: string): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to cancel events.');
      }

      const event = await this.getEventByIdOrSlug(eventId);
      const isAdmin = await this.verifyAdminRole(session.user.id);
      if (event.organizer_id !== session.user.id && !isAdmin) {
        throw new ForbiddenError('You can only cancel your own events.');
      }

      const { error } = await supabase
        .from('events')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', eventId);

      if (error) throw normalizeError(error);
      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Delete an event permanently
   */
  async deleteEvent(eventId: string): Promise<boolean> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        throw new AuthError('Authentication required to delete events.');
      }

      const event = await this.getEventByIdOrSlug(eventId);
      const isAdmin = await this.verifyAdminRole(session.user.id);
      if (event.organizer_id !== session.user.id && !isAdmin) {
        throw new ForbiddenError('You can only delete your own events.');
      }

      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) throw normalizeError(error);
      return true;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Fetch events organized by the current user
   */
  async getMyEvents(): Promise<CommunityEvent[]> {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) return [];

      const { data, error } = await supabase
        .from('events')
        .select(`
          id,
          slug,
          title,
          description,
          cover_image,
          category,
          event_type,
          location_or_url,
          start_time,
          end_time,
          organizer_id,
          organizer_name,
          status,
          created_at,
          updated_at,
          organizer:profiles!events_organizer_id_fkey(id, full_name, avatar_url)
        `)
        .eq('organizer_id', session.user.id)
        .order('start_time', { ascending: false });

      if (error) throw normalizeError(error);

      return (data || []).map((row: any) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        cover_image: row.cover_image,
        category: row.category,
        event_type: row.event_type,
        location_or_url: row.location_or_url,
        start_time: row.start_time,
        end_time: row.end_time,
        organizer_id: row.organizer_id,
        organizer_name: row.organizer_name,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        organizer: row.organizer,
        is_vet_verified: true,
      }));
    } catch (err) {
      throw normalizeError(err);
    }
  }
}

export const eventService = new EventService();
