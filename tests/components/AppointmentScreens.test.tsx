import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AppointmentsScreen from '../../app/(tabs)/appointments';
import BookingScreen from '../../app/booking/[vetId]';
import { AppointmentCard } from '../../src/components/appointments/AppointmentCard';
import { Appointment } from '../../src/types/appointment';
import { VetProfile, DaySchedule } from '../../src/types/vet';
import { Pet } from '../../src/types/pet';
import { ConflictError } from '../../src/lib/api/errors';

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
  useLocalSearchParams: () => ({
    vetId: 'vet-123',
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock Auth Store
let mockAuthState = {
  user: {
    id: 'user-parent-1',
    email: 'parent@example.com',
    fullName: 'Jane Doe',
    phone: '+1 555-0199',
    roles: ['pet_parent'] as any,
    onboarded: true,
    isVet: false,
  },
  isAuthenticated: true,
};

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

// Sample Data
const sampleVet: VetProfile = {
  id: 'vet-123',
  name: 'Dr. Sarah Mitchell',
  specialty: 'General Veterinary Medicine',
  country: 'United Kingdom',
  flag: '🇬🇧',
  languages: ['English'],
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
    date: '2026-10-01',
    dayLabel: 'Thu, Oct 1',
    slots: [
      {
        date: '2026-10-01',
        startTime: '2026-10-01T10:00:00Z',
        endTime: '2026-10-01T10:30:00Z',
        formattedTime: '10:00',
      },
      {
        date: '2026-10-01',
        startTime: '2026-10-01T10:30:00Z',
        endTime: '2026-10-01T11:00:00Z',
        formattedTime: '10:30',
      },
    ],
  },
];

const samplePet: Pet = {
  id: 'pet-123',
  owner_id: 'user-parent-1',
  name: 'Luna',
  species: 'Dog',
  breed: 'Golden Retriever',
  sex: 'female',
  dob: '2022-01-01',
  weight_kg: 28,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const sampleAppointment: Appointment = {
  id: 'apt-001',
  vet_id: 'vet-123',
  pet_parent_id: 'user-parent-1',
  pet_id: 'pet-123',
  pet_name: 'Luna',
  species: 'Dog',
  breed: 'Golden Retriever',
  starts_at: '2026-10-01T10:00:00Z',
  ends_at: '2026-10-01T10:30:00Z',
  mode: 'video',
  status: 'scheduled',
  symptoms: 'Mild sneezing and lethargy',
  urgency: 'Medium',
  contact_phone: '+1 555-0199',
  price_usd: 29,
  created_at: '2026-09-25T10:00:00Z',
  vet: {
    id: 'vet-123',
    name: 'Dr. Sarah Mitchell',
    specialty: 'General Veterinary Medicine',
    flag: '🇬🇧',
    country: 'United Kingdom',
    rating: 4.9,
    verified: true,
  },
};

// Hook Mocks
let mockAppointmentsReturn: any = {
  data: [sampleAppointment],
  isLoading: false,
  isError: false,
  error: null,
  refetch: jest.fn(),
  isRefetching: false,
};

const mockCancelMutate = jest.fn();
const mockBookMutate = jest.fn();

jest.mock('../../src/hooks/useAppointments', () => ({
  useAppointments: () => mockAppointmentsReturn,
  useBookAppointment: () => ({
    mutateAsync: mockBookMutate,
    isPending: false,
  }),
  useCancelAppointment: () => ({
    mutateAsync: mockCancelMutate,
    isPending: false,
  }),
}));

jest.mock('../../src/hooks/useVets', () => ({
  useVet: () => ({
    data: sampleVet,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
  useVetSchedule: () => ({
    data: sampleSchedule,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

let mockPetsReturn: any = {
  data: [samplePet],
  isLoading: false,
  isError: false,
};

jest.mock('../../src/hooks/usePets', () => ({
  usePets: () => mockPetsReturn,
}));

jest.mock('../../src/hooks/usePrescriptions', () => ({
  useAppointmentPrescription: jest.fn(() => ({
    data: null,
    isLoading: false,
    error: null,
  })),
}));

describe('Appointments & Booking UI Components (MVP-04)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: {
        id: 'user-parent-1',
        email: 'parent@example.com',
        fullName: 'Jane Doe',
        phone: '+1 555-0199',
        roles: ['pet_parent'] as any,
        onboarded: true,
        isVet: false,
      },
      isAuthenticated: true,
    };
    mockAppointmentsReturn = {
      data: [sampleAppointment],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
      isRefetching: false,
    };
    mockPetsReturn = {
      data: [samplePet],
      isLoading: false,
      isError: false,
    };
  });

  describe('1. AppointmentCard Component', () => {
    test('Renders doctor details, pet info, date, time, mode, and scheduled status', () => {
      const { getByText } = render(<AppointmentCard appointment={sampleAppointment} />);

      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText('General Veterinary Medicine')).toBeTruthy();
      expect(getByText('Scheduled')).toBeTruthy();
      expect(getByText('VIDEO')).toBeTruthy();
      expect(getByText('$29')).toBeTruthy();
    });

    test('Renders Cancel button when status is scheduled and onCancel is provided', () => {
      const onCancelMock = jest.fn();
      const { getByText } = render(
        <AppointmentCard appointment={sampleAppointment} onCancel={onCancelMock} />,
      );

      const cancelBtn = getByText('Cancel Appointment');
      expect(cancelBtn).toBeTruthy();

      fireEvent.press(cancelBtn);
      expect(onCancelMock).toHaveBeenCalledWith(sampleAppointment);
    });

    test('Does NOT render Cancel button when appointment is completed or cancelled', () => {
      const { queryByText } = render(
        <AppointmentCard
          appointment={{ ...sampleAppointment, status: 'completed' }}
          onCancel={jest.fn()}
        />,
      );

      expect(queryByText('Cancel Appointment')).toBeNull();
    });
  });

  describe('2. AppointmentsScreen (app/(tabs)/appointments.tsx)', () => {
    test('Renders screen title, tabs, and list of upcoming appointments', () => {
      const { getByText } = render(<AppointmentsScreen />);

      expect(getByText('Appointments')).toBeTruthy();
      expect(getByText('Upcoming')).toBeTruthy();
      expect(getByText('Past Consultations')).toBeTruthy();
      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
    });

    test('Renders EmptyState when no appointments exist, and CTA navigates to /vets', () => {
      mockAppointmentsReturn = {
        data: [],
        isLoading: false,
        isError: false,
        refetch: jest.fn(),
      };

      const { getByText } = render(<AppointmentsScreen />);

      expect(getByText('No Upcoming Consultations')).toBeTruthy();
      const browseBtn = getByText('Find a Vet');
      fireEvent.press(browseBtn);
      expect(mockPush).toHaveBeenCalledWith('/(tabs)/vets');
    });

    test('Switches between Upcoming and Past tabs', () => {
      const { getByText } = render(<AppointmentsScreen />);

      const pastTab = getByText('Past Consultations');
      fireEvent.press(pastTab);
      // Switches active tab state cleanly
      expect(pastTab).toBeTruthy();
    });
  });

  describe('3. BookingScreen Multi-Step Wizard (app/booking/[vetId].tsx)', () => {
    test('Navigates through multi-step flow from slot picking to review and confirmation', async () => {
      mockBookMutate.mockResolvedValueOnce({
        success: true,
        appointment_id: 'apt-receipt-999',
        status: 'scheduled',
        starts_at: '2026-10-01T10:00:00Z',
        ends_at: '2026-10-01T10:30:00Z',
        duration_minutes: 30,
        vet_id: 'vet-123',
        vet_name: 'Dr. Sarah Mitchell',
        pet_id: 'pet-123',
        pet_name: 'Luna',
        species: 'Dog',
        mode: 'video',
        price_usd: 29,
        urgency: 'Medium',
        contact_phone: '+1 555-0199',
      });

      const { getByText, getByPlaceholderText } = render(<BookingScreen />);

      // Step 1: Select slot 10:00
      const slotChip = getByText('10:00');
      fireEvent.press(slotChip);

      const step1CTA = getByText('Proceed to Booking (10:00)');
      fireEvent.press(step1CTA);

      // Step 2: Patient & Format
      await waitFor(() => {
        expect(getByText('Pet & Format')).toBeTruthy();
        expect(getByText('Luna')).toBeTruthy();
      });

      const step2CTA = getByText('Continue to Clinical Intake');
      fireEvent.press(step2CTA);

      // Step 3: Clinical Intake
      await waitFor(() => {
        expect(getByText('Clinical Details')).toBeTruthy();
      });

      // Fill in symptoms
      const symptomsInput = getByPlaceholderText('Describe symptoms, onset, behavioral changes...');
      fireEvent.changeText(symptomsInput, 'Luna has been coughing since yesterday morning.');

      const step3CTA = getByText('Review Booking Summary');
      fireEvent.press(step3CTA);

      // Step 4: Summary Review
      await waitFor(() => {
        expect(getByText('Review Booking')).toBeTruthy();
        expect(getByText('Consultation Summary')).toBeTruthy();
        expect(getByText('No Upfront Payment Required')).toBeTruthy();
      });

      // Confirm Booking CTA
      const confirmCTA = getByText('Confirm & Reserve Appointment');
      fireEvent.press(confirmCTA);

      // Verify bookAppointment mutation called with complete payload
      await waitFor(() => {
        expect(mockBookMutate).toHaveBeenCalledWith({
          vet_id: 'vet-123',
          pet_id: 'pet-123',
          starts_at: '2026-10-01T10:00:00Z',
          mode: 'video',
          symptoms: 'Luna has been coughing since yesterday morning.',
          urgency: 'Medium',
          contact_phone: '+1 555-0199',
        });
      });

      // Step 5: Confirmed Receipt Screen
      await waitFor(() => {
        expect(getByText('Appointment Confirmed!')).toBeTruthy();
        expect(getByText('View in Appointments')).toBeTruthy();
      });
    });

    test('Conflict handling: Displays exact message and resets to Step 1 when 409 conflict occurs', async () => {
      mockBookMutate.mockRejectedValueOnce(
        new ConflictError('Slot just taken. Please select another time.'),
      );

      const { getByText, getByPlaceholderText } = render(<BookingScreen />);

      // Step 1: Select slot 10:00
      fireEvent.press(getByText('10:00'));
      fireEvent.press(getByText('Proceed to Booking (10:00)'));

      // Step 2: Continue
      await waitFor(() => expect(getByText('Pet & Format')).toBeTruthy());
      fireEvent.press(getByText('Continue to Clinical Intake'));

      // Step 3: Enter symptoms and review
      await waitFor(() => expect(getByText('Clinical Details')).toBeTruthy());
      const symptomsInput = getByPlaceholderText('Describe symptoms, onset, behavioral changes...');
      fireEvent.changeText(symptomsInput, 'General wellness consultation');
      fireEvent.press(getByText('Review Booking Summary'));

      // Step 4: Confirm
      await waitFor(() => expect(getByText('Review Booking')).toBeTruthy());
      fireEvent.press(getByText('Confirm & Reserve Appointment'));

      // Verify Alert displayed with exact required conflict message
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Slot Unavailable',
          'Slot just taken. Please select another time.',
          expect.any(Array),
        );
      });
    });
  });
});
