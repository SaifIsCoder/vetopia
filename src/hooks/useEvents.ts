/**
 * React Query Hooks for Community Events (M4)
 * Provides cached data fetching, optimistic mutation updates, and error states.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventService } from '../lib/events/eventService';
import {
  CreateEventDTO,
  UpdateEventDTO,
} from '../types/event';

export const EVENT_QUERY_KEYS = {
  all: (filter?: 'upcoming' | 'past' | 'all', category?: string) =>
    ['events', filter || 'upcoming', category || 'all'] as const,
  detail: (idOrSlug: string) => ['event', idOrSlug] as const,
  myEvents: ['my-events'] as const,
};

/**
 * Hook to retrieve events with upcoming/past filtering and category filtering
 */
export function useEvents(
  filter: 'upcoming' | 'past' | 'all' = 'upcoming',
  category?: string,
) {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.all(filter, category),
    queryFn: () => eventService.getEvents(filter, category),
    staleTime: 1000 * 60 * 3, // 3 minutes
  });
}

/**
 * Hook to retrieve single event by UUID or slug
 */
export function useEvent(idOrSlug: string) {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.detail(idOrSlug),
    queryFn: () => eventService.getEventByIdOrSlug(idOrSlug),
    enabled: Boolean(idOrSlug),
  });
}

/**
 * Hook to retrieve events organized by the current user
 */
export function useMyEvents() {
  return useQuery({
    queryKey: EVENT_QUERY_KEYS.myEvents,
    queryFn: () => eventService.getMyEvents(),
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Hook to create a new community event
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEventDTO) => eventService.createEvent(input),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.myEvents });
      if (event.slug) {
        queryClient.setQueryData(EVENT_QUERY_KEYS.detail(event.slug), event);
      }
      queryClient.setQueryData(EVENT_QUERY_KEYS.detail(event.id), event);
    },
  });
}

/**
 * Hook to update an existing event
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      input,
    }: {
      eventId: string;
      input: UpdateEventDTO;
    }) => eventService.updateEvent(eventId, input),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.myEvents });
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.detail(event.id) });
      if (event.slug) {
        queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.detail(event.slug) });
      }
    },
  });
}

/**
 * Hook to cancel an event
 */
export function useCancelEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => eventService.cancelEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.myEvents });
    },
  });
}

/**
 * Hook to delete an event
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: string) => eventService.deleteEvent(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: EVENT_QUERY_KEYS.myEvents });
    },
  });
}
