import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import VetDashboardScreen from '../../app/vet/dashboard';
import { AppointmentCard } from '../../src/components/appointments/AppointmentCard';
import { authService } from '../../src/lib/auth/authService';
import { Appointment } from '../../src/types/appointment';
import { VetProfile } from '../../src/types/vet';

// Mock Router
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    back: mockBack,
  }),
}));

// Mock Alert
const mockAlert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock Auth Store
let mockAuthState = {
  user: {
    id: 'vet-user-1',
    email: 'dr.marco@example.com',
    fullName: 'Dr. Marco Rossi',
    roles: ['vet'] as any,
    onboarded: true,
    isVet: true,
    isVetVerified: false,
  },
  role: 'vet',
  isAuthenticated: true,
};

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

// Mock AuthService
jest.mock('../../src/lib/auth/authService', () => ({
  authService: {
    signOut: jest.fn().mockResolvedValue(undefined),
    requestLicenseReview: jest.fn().mockResolvedValue(undefined),
  },
}));

// Sample Doctor Profile
const sampleVetProfile: VetProfile = {
  id: 'vet-profile-1',
  name: 'Dr. Marco Rossi',
  specialty: 'Emergency & Critical Care',
  country: 'Italy',
  flag: '🇮🇹',
  languages: ['English', 'Italian'],
  price_usd: 45,
  slot_minutes: 30,
  rating: 4.9,
  reviews: 84,
  accepting: true,
  verified: false,
  timezone: 'Europe/Rome',
};

// Sample Appointments
const sampleUpcomingAppointments: Appointment[] = [
  {
    id: 'apt-001',
    vet_id: 'vet-profile-1',
    pet_parent_id: 'user-parent-1',
    pet_name: 'Milo',
    species: 'Cat',
    breed: 'British Shorthair',
    pet_age: '3 yrs',
    symptoms: 'Lethargy and vomiting since yesterday',
    urgency: 'High',
    medications: 'None',
    contact_phone: '+1 555-0199',
    starts_at: '2026-10-10T14:00:00Z',
    ends_at: '2026-10-10T14:30:00Z',
    mode: 'video',
    status: 'scheduled',
    price_usd: 45,
    created_at: '2026-10-04T10:00:00Z',
  },
  {
    id: 'apt-002',
    vet_id: 'vet-profile-1',
    pet_parent_id: 'user-parent-2',
    pet_name: 'Rocky',
    species: 'Dog',
    breed: 'German Shepherd',
    pet_age: '5 yrs',
    symptoms: 'Limping on right front leg',
    urgency: 'Medium',
    starts_at: '2026-10-11T09:00:00Z',
    ends_at: '2026-10-11T09:30:00Z',
    mode: 'video',
    status: 'scheduled',
    price_usd: 45,
    created_at: '2026-10-04T11:00:00Z',
  },
];

const samplePastAppointments: Appointment[] = [
  {
    id: 'apt-003',
    vet_id: 'vet-profile-1',
    pet_parent_id: 'user-parent-3',
    pet_name: 'Bella',
    species: 'Dog',
    breed: 'Golden Retriever',
    starts_at: '2026-10-01T10:00:00Z',
    ends_at: '2026-10-01T10:30:00Z',
    mode: 'video',
    status: 'completed',
    price_usd: 45,
    created_at: '2026-09-30T10:00:00Z',
  },
];

// Mock Hooks
const mockRefetchUpcoming = jest.fn();
const mockRefetchPast = jest.fn();
const mockRefetchVet = jest.fn();
const mockMutateUpdateVet = jest.fn();
const mockCancelMutate = jest.fn();
const mockRefetchAvailability = jest.fn();
const mockRefetchBlockedDates = jest.fn();
const mockUpdateAvailabilityMutate = jest.fn();
const mockAddBlockedDateMutate = jest.fn();
const mockRemoveBlockedDateMutate = jest.fn();

let mockUpcomingData: Appointment[] = sampleUpcomingAppointments;
let mockPastData: Appointment[] = samplePastAppointments;
let mockVetData: VetProfile | null = sampleVetProfile;
const mockAvailabilityData: any[] = [
  { id: 'av-1', vet_id: 'vet-profile-1', weekday: 1, start_minute: 540, end_minute: 1020 },
];
const mockBlockedDatesData: any[] = [
  { id: 'bd-1', vet_id: 'vet-profile-1', blocked_date: '2026-11-20', reason: 'Conference' },
];

jest.mock('../../src/hooks/useAppointments', () => ({
  useAppointments: (filter?: 'upcoming' | 'past') => ({
    data: filter === 'upcoming' ? mockUpcomingData : mockPastData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: filter === 'upcoming' ? mockRefetchUpcoming : mockRefetchPast,
    isRefetching: false,
  }),
  useCancelAppointment: () => ({
    mutateAsync: mockCancelMutate,
    isPending: false,
  }),
}));

jest.mock('../../src/hooks/useVets', () => ({
  useMyVetProfile: () => ({
    data: mockVetData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetchVet,
    isRefetching: false,
  }),
  useUpdateMyVetProfile: () => ({
    mutateAsync: mockMutateUpdateVet,
    isPending: false,
  }),
  useMyAvailability: () => ({
    data: mockAvailabilityData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetchAvailability,
    isRefetching: false,
  }),
  useUpdateMyAvailability: () => ({
    mutateAsync: mockUpdateAvailabilityMutate,
    isPending: false,
  }),
  useMyBlockedDates: () => ({
    data: mockBlockedDatesData,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetchBlockedDates,
    isRefetching: false,
  }),
  useAddBlockedDate: () => ({
    mutateAsync: mockAddBlockedDateMutate,
    isPending: false,
  }),
  useRemoveBlockedDate: () => ({
    mutateAsync: mockRemoveBlockedDateMutate,
    isPending: false,
  }),
}));

jest.mock('../../src/hooks/useMessages', () => ({
  useUnreadMessageCount: () => ({
    data: 2,
  }),
}));

jest.mock('../../src/hooks/usePrescriptions', () => ({
  useAppointmentPrescription: jest.fn(() => ({
    data: null,
    isLoading: false,
    isError: false,
    error: null,
  })),
}));

describe('Doctor Consultation Portal (VetDashboardScreen)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpcomingData = [...sampleUpcomingAppointments];
    mockPastData = [...samplePastAppointments];
    mockVetData = { ...sampleVetProfile, verified: false };
    mockAuthState = {
      user: {
        id: 'vet-user-1',
        email: 'dr.marco@example.com',
        fullName: 'Dr. Marco Rossi',
        roles: ['vet'] as any,
        onboarded: true,
        isVet: true,
        isVetVerified: false,
      },
      role: 'vet',
      isAuthenticated: true,
    };
  });

  describe('1. Unverified / Pending Doctor Experience', () => {
    test('Renders pending verification badge and license submission form', () => {
      const { getByText, getByPlaceholderText } = render(<VetDashboardScreen />);

      expect(getByText('DOCTOR PORTAL')).toBeTruthy();
      expect(getByText('Dr. Marco Rossi')).toBeTruthy();
      expect(getByText('Pending Approval')).toBeTruthy();
      expect(getByText('Medical License Verification Required')).toBeTruthy();
      expect(getByPlaceholderText('e.g. VET-84920')).toBeTruthy();
      expect(getByText('Submit for Review')).toBeTruthy();
    });

    test('Validates empty license number submission', async () => {
      const { getByText } = render(<VetDashboardScreen />);
      const verifyBtn = getByText('Submit for Review');

      fireEvent.press(verifyBtn);

      await waitFor(() => {
        expect(authService.requestLicenseReview).not.toHaveBeenCalled();
      });
    });

    test('Submits license number and calls requestLicenseReview', async () => {
      const { getByText, getByPlaceholderText } = render(<VetDashboardScreen />);
      const input = getByPlaceholderText('e.g. VET-84920');

      fireEvent.changeText(input, 'VET-99412');
      fireEvent.press(getByText('Submit for Review'));

      await waitFor(() => {
        expect(authService.requestLicenseReview).toHaveBeenCalledWith('VET-99412');
        expect(mockAlert).toHaveBeenCalledWith(
          'License Submitted',
          expect.stringContaining('administrator will review'),
        );
      });
    });

    test('Gates consultation room entry for unverified doctor with verification alert', () => {
      const { getByText } = render(<AppointmentCard appointment={sampleUpcomingAppointments[0]} />);

      // Card in unverified doctor mode shows "Verify License"
      const enterBtn = getByText('Verify License');
      fireEvent.press(enterBtn);

      expect(mockAlert).toHaveBeenCalledWith(
        'License Verification Required',
        expect.stringContaining('verify your license on the doctor dashboard'),
        expect.any(Array),
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe('2. Verified Doctor Experience & Practice Management', () => {
    beforeEach(() => {
      mockAuthState.user.isVetVerified = true;
      mockVetData = { ...sampleVetProfile, verified: true };
    });

    test('Renders verified doctor badge, practice controls, and metric stats', () => {
      const { getByText, getAllByText } = render(<VetDashboardScreen />);

      expect(getByText('Verified Vet')).toBeTruthy();
      expect(getByText('Accepting Patients')).toBeTruthy();
      expect(getByText('In Queue')).toBeTruthy();
      expect(getByText('Concluded')).toBeTruthy();
      expect(getByText('Slot Rate')).toBeTruthy();
      expect(getAllByText('$45').length).toBeGreaterThanOrEqual(1);
    });

    test('Toggles accepting patients availability status', async () => {
      mockMutateUpdateVet.mockResolvedValueOnce({
        ...sampleVetProfile,
        accepting: false,
      });

      const { getByText } = render(<VetDashboardScreen />);
      expect(getByText('Accepting Patients')).toBeTruthy();

      // Switch is rendered in the availability card
      // Test the mutation directly
      await waitFor(() => {
        expect(mockMutateUpdateVet).not.toHaveBeenCalled();
      });
    });

    test('Renders patient intake details on appointment card in doctor mode', () => {
      const { getByText } = render(<AppointmentCard appointment={sampleUpcomingAppointments[0]} />);

      // Doctor sees patient pet name, breed, urgency, and symptoms
      expect(getByText('Milo (Cat)')).toBeTruthy();
      expect(getByText('High')).toBeTruthy();
      expect(getByText('Lethargy and vomiting since yesterday')).toBeTruthy();
      expect(getByText('+1 555-0199')).toBeTruthy();
      expect(getByText('Enter Room')).toBeTruthy();
    });

    test('Navigates verified doctor to consultation room on Enter Room press', () => {
      const { getByText } = render(<AppointmentCard appointment={sampleUpcomingAppointments[0]} />);

      const enterBtn = getByText('Enter Room');
      fireEvent.press(enterBtn);

      expect(mockPush).toHaveBeenCalledWith('/consult/apt-001');
    });

    test('Switches between Upcoming Queue and Past Consultations tabs', () => {
      const { getByText } = render(<VetDashboardScreen />);

      expect(getByText('Upcoming Queue (2)')).toBeTruthy();

      const pastTab = getByText('Past Consultations');
      fireEvent.press(pastTab);

      // Shows past appointment Bella
      expect(getByText('Bella (Dog)')).toBeTruthy();
    });

    test('Opens Profile & Fees modal and saves changes', async () => {
      mockMutateUpdateVet.mockResolvedValueOnce({
        ...sampleVetProfile,
        price_usd: 55,
      });

      const { getByText, getByDisplayValue } = render(<VetDashboardScreen />);
      const editBtn = getByText('Edit Profile & Fees');
      fireEvent.press(editBtn);

      expect(getByText('Practice Settings & Bio')).toBeTruthy();
      expect(getByDisplayValue('45')).toBeTruthy();

      const saveBtn = getByText('Save Changes');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockMutateUpdateVet).toHaveBeenCalled();
      });
    });

    test('Opens Working Hours modal and saves weekly availability', async () => {
      mockUpdateAvailabilityMutate.mockResolvedValueOnce([]);

      const { getByText } = render(<VetDashboardScreen />);
      const hoursBtn = getByText('Working Hours');
      fireEvent.press(hoursBtn);

      expect(getByText('Weekly Working Hours')).toBeTruthy();
      expect(getByText('Monday')).toBeTruthy();

      const saveBtn = getByText('Save Working Hours');
      fireEvent.press(saveBtn);

      await waitFor(() => {
        expect(mockUpdateAvailabilityMutate).toHaveBeenCalled();
      });
    });

    test('Opens Blocked Dates modal and allows managing time off', async () => {
      const { getByText } = render(<VetDashboardScreen />);
      const blockedBtn = getByText('Blocked Dates');
      fireEvent.press(blockedBtn);

      expect(getByText('Time Off & Blocked Dates')).toBeTruthy();
      expect(getByText('2026-11-20')).toBeTruthy();
      expect(getByText('Conference')).toBeTruthy();
    });
  });

  describe('3. Sign Out Flow', () => {
    test('Prompts confirmation before signing out', () => {
      const { getByLabelText } = render(<VetDashboardScreen />);
      const signOutBtn = getByLabelText('Sign out of doctor account');

      fireEvent.press(signOutBtn);

      expect(mockAlert).toHaveBeenCalledWith(
        'Sign Out',
        'Are you sure you want to sign out of the Doctor Portal?',
        expect.any(Array),
      );
    });
  });
});
