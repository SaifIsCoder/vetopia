/**
 * Centralized Query Key Factory
 */

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    session: ['auth', 'session'] as const,
  },
  vets: {
    all: ['vets'] as const,
    list: (filters?: Record<string, unknown>) => ['vets', 'list', filters] as const,
    detail: (id: string) => ['vets', 'detail', id] as const,
    schedule: (id: string) => ['vets', 'schedule', id] as const,
  },
  appointments: {
    all: ['appointments'] as const,
    list: (filter?: 'upcoming' | 'past') => ['appointments', 'list', filter] as const,
    detail: (id: string) => ['appointments', 'detail', id] as const,
  },
  pets: {
    all: ['pets'] as const,
    list: ['pets', 'list'] as const,
    detail: (id: string) => ['pets', 'detail', id] as const,
  },
  prescriptions: {
    all: ['prescriptions'] as const,
    list: ['prescriptions', 'list'] as const,
    detail: (id: string) => ['prescriptions', 'detail', id] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: ['conversations', 'list'] as const,
    messages: (id: string) => ['conversations', id, 'messages'] as const,
  },
};
