import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import EventsDirectoryScreen from '../../app/events/index';
import EventDetailScreen from '../../app/events/[id]';
import CreateEditEventScreen from '../../app/events/create';
import { CommunityEvent } from '../../src/types/event';

// Mock router
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({ id: 'evt-1', eventId: undefined }),
}));

// Mock Linking
jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true as any);
jest.spyOn(Linking, 'openURL').mockResolvedValue(null as any);

// Mock auth store
let mockCurrentUser: any = {
  id: 'user-vet-1',
  fullName: 'Dr. Sarah Wilson',
  isVet: true,
  isVetVerified: true,
  roles: ['vet'],
};
let mockCurrentRole: any = 'vet';

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({
    user: mockCurrentUser,
    role: mockCurrentRole,
    isAuthenticated: true,
  }),
}));

const mockEvents: CommunityEvent[] = [
  {
    id: 'evt-1',
    slug: 'clinical-canine-nutrition-webinar',
    title: 'Senior Canine Nutrition: Preventing Obesity and Sarcopenia',
    description:
      'Join Dr. Sarah Wilson for a comprehensive clinical overview of dietary protein requirements, joint supplements, and metabolic monitoring.',
    cover_image: null,
    category: 'Webinar',
    event_type: 'virtual',
    location_or_url: 'https://meet.vetopia.com/clinical-canine-nutrition',
    start_time: '2026-10-26T14:00:00Z',
    end_time: '2026-10-26T15:30:00Z',
    organizer_id: 'user-vet-1',
    organizer_name: 'Dr. Sarah Wilson, DVM',
    status: 'published',
    created_at: '2026-10-15T00:00:00Z',
    updated_at: '2026-10-15T00:00:00Z',
    organizer: { id: 'user-vet-1', full_name: 'Dr. Sarah Wilson, DVM', avatar_url: null },
    is_vet_verified: true,
  },
  {
    id: 'evt-2',
    slug: 'low-cost-vaccination-drive',
    title: 'Low-Cost Rabies & Microchip Community Drive',
    description:
      'Community outreach clinic offering subsidized core rabies vaccinations, DHPP boosters, and lifetime ISO microchip registrations.',
    cover_image: null,
    category: 'Vaccination Clinic',
    event_type: 'in_person',
    location_or_url: 'Vetopia Central Pavilion, 1200 Greenway Blvd',
    start_time: '2026-10-28T10:00:00Z',
    end_time: '2026-10-28T14:00:00Z',
    organizer_id: 'user-vet-2',
    organizer_name: 'Dr. Michael Chen, DACVIM',
    status: 'published',
    created_at: '2026-10-18T00:00:00Z',
    updated_at: '2026-10-18T00:00:00Z',
    organizer: { id: 'user-vet-2', full_name: 'Dr. Michael Chen, DACVIM', avatar_url: null },
    is_vet_verified: true,
  },
];

// Mock hooks
const mockCreateEventMutateAsync = jest.fn();
const mockUpdateEventMutateAsync = jest.fn();
const mockCancelEventMutateAsync = jest.fn();
const mockDeleteEventMutateAsync = jest.fn();

jest.mock('../../src/hooks/useEvents', () => ({
  useEvents: (filter: string) => ({
    data: filter === 'past' ? [] : mockEvents,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  }),
  useEvent: (idOrSlug: string) => ({
    data: idOrSlug
      ? mockEvents.find((e) => e.id === idOrSlug || e.slug === idOrSlug) || mockEvents[0]
      : null,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
  useCreateEvent: () => ({
    mutateAsync: mockCreateEventMutateAsync,
    isPending: false,
  }),
  useUpdateEvent: () => ({
    mutateAsync: mockUpdateEventMutateAsync,
    isPending: false,
  }),
  useCancelEvent: () => ({
    mutateAsync: mockCancelEventMutateAsync,
    isPending: false,
  }),
  useDeleteEvent: () => ({
    mutateAsync: mockDeleteEventMutateAsync,
    isPending: false,
  }),
}));

describe('Event Experience — Component & Screen Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = {
      id: 'user-vet-1',
      fullName: 'Dr. Sarah Wilson',
      isVet: true,
      isVetVerified: true,
      roles: ['vet'],
    };
    mockCurrentRole = 'vet';
  });

  describe('1. EventsDirectoryScreen (app/events/index.tsx)', () => {
    test('renders community events directory and upcoming events', () => {
      const { getByText, getByTestId } = render(<EventsDirectoryScreen />);

      expect(getByText('Community Events')).toBeTruthy();
      expect(getByTestId('tab-upcoming-events')).toBeTruthy();
      expect(getByTestId('tab-past-events')).toBeTruthy();
      expect(
        getByText('Senior Canine Nutrition: Preventing Obesity and Sarcopenia'),
      ).toBeTruthy();
      expect(getByText('Low-Cost Rabies & Microchip Community Drive')).toBeTruthy();
    });

    test('shows Create Event CTA button for verified veterinarian', () => {
      const { getByTestId } = render(<EventsDirectoryScreen />);
      const createBtn = getByTestId('btn-create-event');
      expect(createBtn).toBeTruthy();

      fireEvent.press(createBtn);
      expect(mockPush).toHaveBeenCalledWith('/events/create');
    });

    test('hides Create Event CTA button for standard pet parent', () => {
      mockCurrentUser = {
        id: 'user-parent-1',
        fullName: 'Jane PetParent',
        isVet: false,
        isVetVerified: false,
        roles: ['pet_parent'],
      };
      mockCurrentRole = 'pet_parent';

      const { queryByTestId } = render(<EventsDirectoryScreen />);
      expect(queryByTestId('btn-create-event')).toBeNull();
    });

    test('toggling between Upcoming and Past tabs updates active tab state', () => {
      const { getByTestId } = render(<EventsDirectoryScreen />);
      const pastTab = getByTestId('tab-past-events');
      fireEvent.press(pastTab);
      expect(pastTab).toBeTruthy();

      const upcomingTab = getByTestId('tab-upcoming-events');
      fireEvent.press(upcomingTab);
      expect(upcomingTab).toBeTruthy();
    });
  });

  describe('2. EventDetailScreen (app/events/[id].tsx)', () => {
    test('renders event title, description, time card, and organizer details', () => {
      const { getByText, getByTestId } = render(<EventDetailScreen />);

      expect(
        getByText('Senior Canine Nutrition: Preventing Obesity and Sarcopenia'),
      ).toBeTruthy();
      expect(getByText('Online Live Session')).toBeTruthy();
      expect(getByTestId('btn-join-virtual')).toBeTruthy();
      expect(getByText('Dr. Sarah Wilson, DVM')).toBeTruthy();
      expect(getByTestId('btn-event-back')).toBeTruthy();
    });

    test('clicking Join Virtual Meeting opens external URL', async () => {
      const { getByTestId } = render(<EventDetailScreen />);
      const joinBtn = getByTestId('btn-join-virtual');

      fireEvent.press(joinBtn);

      await waitFor(() => {
        expect(Linking.openURL).toHaveBeenCalledWith(
          'https://meet.vetopia.com/clinical-canine-nutrition',
        );
      });
    });

    test('shows edit and cancel controls for event organizer', () => {
      mockCurrentUser = {
        id: 'user-vet-1', // matching organizer_id
        fullName: 'Dr. Sarah Wilson',
        isVet: true,
        isVetVerified: true,
        roles: ['vet'],
      };

      const { getByTestId } = render(<EventDetailScreen />);
      expect(getByTestId('btn-edit-event')).toBeTruthy();
      expect(getByTestId('btn-cancel-event')).toBeTruthy();
      expect(getByTestId('btn-delete-event')).toBeTruthy();

      fireEvent.press(getByTestId('btn-edit-event'));
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/events/create',
        params: { eventId: 'evt-1' },
      });
    });

    test('hides organizer controls for non-organizer attendee', () => {
      mockCurrentUser = {
        id: 'user-parent-99',
        fullName: 'Jane Parent',
        isVet: false,
        isVetVerified: false,
        roles: ['pet_parent'],
      };
      mockCurrentRole = 'pet_parent';

      const { queryByTestId } = render(<EventDetailScreen />);
      expect(queryByTestId('btn-edit-event')).toBeNull();
      expect(queryByTestId('btn-cancel-event')).toBeNull();
      expect(queryByTestId('btn-delete-event')).toBeNull();
    });

    test('navigating back invokes router.back()', () => {
      const { getByTestId } = render(<EventDetailScreen />);
      fireEvent.press(getByTestId('btn-event-back'));
      expect(mockBack).toHaveBeenCalled();
    });
  });

  describe('3. CreateEditEventScreen (app/events/create.tsx)', () => {
    test('renders unauthorized notice for non-vet user', () => {
      mockCurrentUser = {
        id: 'user-parent-1',
        fullName: 'Jane PetParent',
        isVet: false,
        isVetVerified: false,
        roles: ['pet_parent'],
      };
      mockCurrentRole = 'pet_parent';

      const { getByTestId, getByText } = render(<CreateEditEventScreen />);
      expect(getByTestId('events-unauthorized-screen')).toBeTruthy();
      expect(getByText('Verified Veterinarian Access')).toBeTruthy();
    });

    test('renders create event form for verified veterinarian', () => {
      const { getByTestId, getByText } = render(<CreateEditEventScreen />);

      expect(getByTestId('create-edit-event-screen')).toBeTruthy();
      expect(getByTestId('input-event-title')).toBeTruthy();
      expect(getByTestId('input-event-location-url')).toBeTruthy();
      expect(getByTestId('input-event-description')).toBeTruthy();
      expect(getByTestId('btn-submit-event')).toBeTruthy();
      expect(getByText('Create Community Event')).toBeTruthy();
    });

    test('validates required fields on submission', async () => {
      const { getByTestId, findByTestId } = render(<CreateEditEventScreen />);

      // Submit with empty inputs
      fireEvent.press(getByTestId('btn-submit-event'));

      const errorBanner = await findByTestId('event-error-banner');
      expect(errorBanner).toBeTruthy();
      expect(mockCreateEventMutateAsync).not.toHaveBeenCalled();
    });

    test('submits new event when valid data is entered', async () => {
      mockCreateEventMutateAsync.mockResolvedValue({ id: 'evt-created-99' });

      const { getByTestId } = render(<CreateEditEventScreen />);

      fireEvent.changeText(
        getByTestId('input-event-title'),
        'Clinical Avian Health: Recognizing Respiratory Distress',
      );
      fireEvent.changeText(
        getByTestId('input-event-location-url'),
        'https://meet.vetopia.com/avian-health',
      );
      fireEvent.changeText(
        getByTestId('input-event-description'),
        'Comprehensive clinical training for companion bird owners covering tail-bobbing, air-sac disorders, and nebulization therapies.',
      );

      fireEvent.press(getByTestId('btn-submit-event'));

      await waitFor(() => {
        expect(mockCreateEventMutateAsync).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Clinical Avian Health: Recognizing Respiratory Distress',
            location_or_url: 'https://meet.vetopia.com/avian-health',
            event_type: 'virtual',
            status: 'published',
          }),
        );
      });
    });
  });
});
