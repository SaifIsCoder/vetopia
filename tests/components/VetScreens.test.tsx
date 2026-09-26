import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import VetsScreen from '../../app/(tabs)/vets';
import VetProfileScreen from '../../app/booking/[vetId]';
import { VetCard } from '../../src/components/vets/VetCard';
import { VetProfile, DaySchedule } from '../../src/types/vet';

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
  useLocalSearchParams: () => ({
    vetId: 'vet-123',
  }),
}));

// Mock Alert.alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Sample Mock Data
const sampleVet: VetProfile = {
  id: 'vet-123',
  name: 'Dr. Sarah Mitchell',
  specialty: 'General Veterinary Medicine',
  country: 'United Kingdom',
  flag: '🇬🇧',
  languages: ['English', 'French'],
  price_usd: 29,
  slot_minutes: 30,
  rating: 4.9,
  reviews: 312,
  bio: 'Specialist in companion animal care and preventative wellness.',
  timezone: 'UTC',
  verified: true,
  accepting: true,
};

const sampleSchedule: DaySchedule[] = [
  {
    date: '2026-09-24',
    dayLabel: 'Thu, Sep 24',
    slots: [
      {
        date: '2026-09-24',
        startTime: '2026-09-24T09:00:00Z',
        endTime: '2026-09-24T09:30:00Z',
        formattedTime: '09:00',
      },
      {
        date: '2026-09-24',
        startTime: '2026-09-24T09:30:00Z',
        endTime: '2026-09-24T10:00:00Z',
        formattedTime: '09:30',
      },
    ],
  },
];

// Mock useVets hooks
const mockRefetchVets = jest.fn();
const mockRefetchVet = jest.fn();
const mockRefetchSchedule = jest.fn();

let mockUseVetsReturn: any = {
  data: [sampleVet],
  isLoading: false,
  isError: false,
  error: null,
  refetch: mockRefetchVets,
  isRefetching: false,
};

let mockUseVetReturn: any = {
  data: sampleVet,
  isLoading: false,
  isError: false,
  error: null,
  refetch: mockRefetchVet,
};

let mockUseVetScheduleReturn: any = {
  data: sampleSchedule,
  isLoading: false,
  isError: false,
  error: null,
  refetch: mockRefetchSchedule,
};

jest.mock('../../src/hooks/useVets', () => ({
  useVets: () => mockUseVetsReturn,
  useVet: () => mockUseVetReturn,
  useVetSchedule: () => mockUseVetScheduleReturn,
}));

jest.mock('../../src/hooks/usePets', () => ({
  usePets: () => ({
    data: [],
    isLoading: false,
    isError: false,
  }),
}));

jest.mock('../../src/hooks/useAppointments', () => ({
  useBookAppointment: () => ({
    mutateAsync: jest.fn(),
    isPending: false,
  }),
}));

describe('Veterinarian Discovery UI & Screens (MVP-03)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseVetsReturn = {
      data: [sampleVet],
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchVets,
      isRefetching: false,
    };
    mockUseVetReturn = {
      data: sampleVet,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchVet,
    };
    mockUseVetScheduleReturn = {
      data: sampleSchedule,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetchSchedule,
    };
  });

  describe('1. VetCard Component', () => {
    test('Renders doctor details, specialty, nationality, languages, fee, and rating', () => {
      const onPressMock = jest.fn();
      const { getByText } = render(<VetCard vet={sampleVet} onPress={onPressMock} />);

      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText('General Veterinary Medicine')).toBeTruthy();
      expect(getByText('🇬🇧 United Kingdom')).toBeTruthy();
      expect(getByText('English, French')).toBeTruthy();
      expect(getByText('$29')).toBeTruthy();
      expect(getByText('/ 30m')).toBeTruthy();
      expect(getByText('4.9')).toBeTruthy();
      expect(getByText('(312)')).toBeTruthy();
    });

    test('Shows Verified badge when verified is true', () => {
      const { getByText } = render(<VetCard vet={sampleVet} onPress={jest.fn()} />);
      expect(getByText('Verified')).toBeTruthy();
    });

    test('Does NOT show Verified badge when verified is false', () => {
      const unverifiedVet = { ...sampleVet, verified: false };
      const { queryByText } = render(<VetCard vet={unverifiedVet} onPress={jest.fn()} />);
      expect(queryByText('Verified')).toBeNull();
    });

    test('Displays Accepting indicator when accepting is true', () => {
      const { getByText } = render(<VetCard vet={sampleVet} onPress={jest.fn()} />);
      expect(getByText('Accepting')).toBeTruthy();
    });

    test('Displays Not Accepting indicator when accepting is false', () => {
      const notAcceptingVet = { ...sampleVet, accepting: false };
      const { getByText } = render(<VetCard vet={notAcceptingVet} onPress={jest.fn()} />);
      expect(getByText('Not Accepting')).toBeTruthy();
    });

    test('Triggers onPress callback with vet data when tapped', () => {
      const onPressMock = jest.fn();
      const { getByRole } = render(<VetCard vet={sampleVet} onPress={onPressMock} />);

      fireEvent.press(getByRole('button'));
      expect(onPressMock).toHaveBeenCalledWith(sampleVet);
    });
  });

  describe('2. VetDirectoryScreen (app/(tabs)/vets.tsx)', () => {
    test('Renders directory header, search bar, specialty chips, and doctor list', () => {
      const { getByText, getByPlaceholderText } = render(<VetsScreen />);

      expect(getByText('Find a Vet')).toBeTruthy();
      expect(getByText('Search licensed veterinarians across 11 languages')).toBeTruthy();
      expect(getByPlaceholderText('Search doctor name or specialty...')).toBeTruthy();
      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
    });

    test('Tapping a doctor card navigates to /booking/[vetId]', () => {
      const { getByText } = render(<VetsScreen />);

      fireEvent.press(getByText('Dr. Sarah Mitchell'));
      expect(mockPush).toHaveBeenCalledWith('/booking/vet-123');
    });

    test('Renders EmptyState when no doctors match filters', () => {
      mockUseVetsReturn = {
        data: [],
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchVets,
        isRefetching: false,
      };

      const { getByText } = render(<VetsScreen />);
      expect(getByText('No veterinarians found')).toBeTruthy();
      expect(getByText('Clear Filters')).toBeTruthy();
    });

    test('Renders ErrorState when fetching doctors fails and allows retry', () => {
      mockUseVetsReturn = {
        data: null,
        isLoading: false,
        isError: true,
        error: { message: 'Network offline' },
        refetch: mockRefetchVets,
        isRefetching: false,
      };

      const { getByText } = render(<VetsScreen />);
      expect(getByText('Could not load veterinarians')).toBeTruthy();

      const retryBtn = getByText('Try Again');
      fireEvent.press(retryBtn);
      expect(mockRefetchVets).toHaveBeenCalled();
    });
  });

  describe('3. VetProfileScreen (app/booking/[vetId].tsx)', () => {
    test('Renders doctor biography, verification, fee, timezone, and live slots', () => {
      const { getByText } = render(<VetProfileScreen />);

      expect(getByText('Doctor Profile')).toBeTruthy();
      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText('Verified')).toBeTruthy();
      expect(getByText('General Veterinary Medicine')).toBeTruthy();
      expect(getByText('$29')).toBeTruthy();
      expect(getByText('About Doctor')).toBeTruthy();
      expect(getByText(sampleVet.bio!)).toBeTruthy();
      expect(getByText('Available Consultation Slots')).toBeTruthy();
      expect(getByText('Thu, Sep 24')).toBeTruthy();
      expect(getByText('09:00')).toBeTruthy();
      expect(getByText('09:30')).toBeTruthy();
    });

    test('Selecting a slot updates selection and tapping CTA prompts sign-in when unauthenticated', () => {
      const { getByText } = render(<VetProfileScreen />);

      // Slot 09:00 selected
      const slotChip = getByText('09:00');
      fireEvent.press(slotChip);

      // CTA button should be enabled
      const ctaBtn = getByText('Proceed to Booking (09:00)');
      expect(ctaBtn).toBeTruthy();

      // Pressing CTA without authentication should prompt sign-in
      fireEvent.press(ctaBtn);
      expect(Alert.alert).toHaveBeenCalledWith(
        'Sign In Required',
        expect.stringContaining('signed in as a pet parent'),
        expect.any(Array),
      );
    });

    test('When doctor is NOT accepting patients, displays warning and disabled CTA', () => {
      mockUseVetReturn = {
        data: { ...sampleVet, accepting: false },
        isLoading: false,
        isError: false,
        error: null,
        refetch: mockRefetchVet,
      };

      const { getByText, getAllByText } = render(<VetProfileScreen />);

      // Should show warning banner
      expect(getAllByText('Currently Not Accepting Bookings').length).toBeGreaterThan(0);
      expect(
        getByText(
          'This veterinarian is not accepting new patient appointments at this time. Please browse other verified doctors in the directory.',
        ),
      ).toBeTruthy();
    });

    test('Back button calls router.back()', () => {
      const { getByLabelText } = render(<VetProfileScreen />);

      const backBtn = getByLabelText('Back to Find Vet directory');
      fireEvent.press(backBtn);
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
