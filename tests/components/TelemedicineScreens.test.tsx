import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { CallControls } from '../../src/components/telemedicine/CallControls';
import { WaitingRoomView } from '../../src/components/telemedicine/WaitingRoomView';
import { ActiveCallView } from '../../src/components/telemedicine/ActiveCallView';
import ConsultRoomScreen from '../../app/consult/[id]';
import { Appointment } from '../../src/types/appointment';

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
    id: 'appt-tele-123',
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
  role: 'pet_parent',
  isAuthenticated: true,
};

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

// Sample Appointment
const sampleAppointment: Appointment = {
  id: 'appt-tele-123',
  pet_id: 'pet-123',
  vet_id: 'vet-123',
  pet_parent_id: 'user-parent-1',
  starts_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 mins from now
  ends_at: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
  mode: 'video',
  status: 'scheduled',
  urgency: 'Medium',
  symptoms: 'Fever and low appetite',
  pet_name: 'Milo',
  species: 'Dog',
  breed: 'Golden Retriever',
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
let mockAppointmentReturn: any = {
  data: sampleAppointment,
  isLoading: false,
  isError: false,
  error: null,
};

const mockCompleteMutate = jest.fn();

jest.mock('../../src/hooks/useAppointments', () => ({
  useAppointment: () => mockAppointmentReturn,
  useCompleteAppointment: () => ({
    mutateAsync: mockCompleteMutate,
    isPending: false,
  }),
}));

// Mock Telemedicine Service
jest.mock('../../src/lib/telemedicine/telemedicineService', () => ({
  telemedicineService: {
    requestConsultationToken: jest.fn().mockResolvedValue({
      serverUrl: 'wss://vetopia-livekit.cloud',
      token: 'mock-livekit-jwt-token',
      roomName: 'vetopia-consult-appt-tele-123',
      identity: 'user_user-parent-1',
      participantName: 'Jane Doe',
      expiresIn: 3600,
    }),
    checkEligibility: jest.fn((appt: any) => {
      if (appt?.status === 'cancelled') {
        return {
          eligible: false,
          reason: 'cancelled',
          message: 'This appointment has been cancelled.',
        };
      }
      return { eligible: true, message: 'Consultation room is ready.' };
    }),
    completeConsultation: jest.fn().mockResolvedValue(true),
  },
}));

describe('Telemedicine Components & Screen Tests (MVP-05)', () => {
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
      role: 'pet_parent',
      isAuthenticated: true,
    };
    mockAppointmentReturn = {
      data: sampleAppointment,
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  describe('1. CallControls Component', () => {
    test('Renders all controls in video mode and handles interactions', () => {
      const onToggleMic = jest.fn();
      const onToggleVideo = jest.fn();
      const onFlipCamera = jest.fn();
      const onToggleSpeaker = jest.fn();
      const onEndCall = jest.fn();

      const { getByTestId } = render(
        <CallControls
          isMicMuted={false}
          isVideoMuted={false}
          isFrontCamera={true}
          isSpeakerOn={true}
          isVideoMode={true}
          onToggleMic={onToggleMic}
          onToggleVideo={onToggleVideo}
          onFlipCamera={onFlipCamera}
          onToggleSpeaker={onToggleSpeaker}
          onEndCall={onEndCall}
        />,
      );

      // Verify controls are present
      expect(getByTestId('control-mic')).toBeTruthy();
      expect(getByTestId('control-video')).toBeTruthy();
      expect(getByTestId('control-flip')).toBeTruthy();
      expect(getByTestId('control-speaker')).toBeTruthy();
      expect(getByTestId('control-end-call')).toBeTruthy();

      // Trigger button clicks
      fireEvent.press(getByTestId('control-mic'));
      expect(onToggleMic).toHaveBeenCalledTimes(1);

      fireEvent.press(getByTestId('control-video'));
      expect(onToggleVideo).toHaveBeenCalledTimes(1);

      fireEvent.press(getByTestId('control-flip'));
      expect(onFlipCamera).toHaveBeenCalledTimes(1);

      fireEvent.press(getByTestId('control-speaker'));
      expect(onToggleSpeaker).toHaveBeenCalledTimes(1);

      fireEvent.press(getByTestId('control-end-call'));
      expect(onEndCall).toHaveBeenCalledTimes(1);
    });

    test('In audio-only mode, hides video and flip camera buttons', () => {
      const { getByTestId, queryByTestId } = render(
        <CallControls
          isMicMuted={false}
          isVideoMuted={true}
          isFrontCamera={true}
          isSpeakerOn={true}
          isVideoMode={false} // Audio mode
          onToggleMic={jest.fn()}
          onToggleVideo={jest.fn()}
          onFlipCamera={jest.fn()}
          onToggleSpeaker={jest.fn()}
          onEndCall={jest.fn()}
        />,
      );

      expect(getByTestId('control-mic')).toBeTruthy();
      expect(getByTestId('control-speaker')).toBeTruthy();
      expect(getByTestId('control-end-call')).toBeTruthy();
      expect(queryByTestId('control-video')).toBeNull();
      expect(queryByTestId('control-flip')).toBeNull();
    });
  });

  describe('2. WaitingRoomView Component (FR-TELE-001)', () => {
    test('Renders doctor details, pet info, and parent waiting banner', () => {
      const { getByText } = render(
        <WaitingRoomView
          appointment={sampleAppointment}
          isVet={false}
          isMicMuted={false}
          isVideoMuted={false}
          isFrontCamera={true}
          isSpeakerOn={true}
          hasPermissions={true}
          permissionError={null}
          onToggleMic={jest.fn()}
          onToggleVideo={jest.fn()}
          onFlipCamera={jest.fn()}
          onToggleSpeaker={jest.fn()}
          onEnterConsultation={jest.fn()}
          onExit={jest.fn()}
          onRetryPermissions={jest.fn()}
        />,
      );

      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText(/General Veterinary Medicine/)).toBeTruthy();
      expect(getByText('Milo')).toBeTruthy();
      expect(getByText('Waiting for Doctor to admit you...')).toBeTruthy();
      expect(getByText('Enter Consultation Room')).toBeTruthy();
    });

    test('Renders vet waiting banner when viewing as veterinarian', () => {
      const { getByText } = render(
        <WaitingRoomView
          appointment={sampleAppointment}
          isVet={true}
          isMicMuted={false}
          isVideoMuted={false}
          isFrontCamera={true}
          isSpeakerOn={true}
          hasPermissions={true}
          permissionError={null}
          onToggleMic={jest.fn()}
          onToggleVideo={jest.fn()}
          onFlipCamera={jest.fn()}
          onToggleSpeaker={jest.fn()}
          onEnterConsultation={jest.fn()}
          onExit={jest.fn()}
          onRetryPermissions={jest.fn()}
        />,
      );

      expect(getByText('Patient is in the Waiting Room')).toBeTruthy();
    });

    test('Displays permission warning when permissions are denied', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <WaitingRoomView
          appointment={sampleAppointment}
          isVet={false}
          isMicMuted={false}
          isVideoMuted={false}
          isFrontCamera={true}
          isSpeakerOn={true}
          hasPermissions={false}
          permissionError="Camera & Microphone access is required."
          onToggleMic={jest.fn()}
          onToggleVideo={jest.fn()}
          onFlipCamera={jest.fn()}
          onToggleSpeaker={jest.fn()}
          onEnterConsultation={jest.fn()}
          onExit={jest.fn()}
          onRetryPermissions={onRetry}
        />,
      );

      expect(getByText('Camera & Microphone access is required.')).toBeTruthy();
      const grantBtn = getByText('Request Permissions Again');
      fireEvent.press(grantBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    test('Triggering Enter Consultation CTA calls onEnterConsultation', () => {
      const onEnter = jest.fn();
      const { getByText } = render(
        <WaitingRoomView
          appointment={sampleAppointment}
          isVet={false}
          isMicMuted={false}
          isVideoMuted={false}
          isFrontCamera={true}
          isSpeakerOn={true}
          hasPermissions={true}
          permissionError={null}
          onToggleMic={jest.fn()}
          onToggleVideo={jest.fn()}
          onFlipCamera={jest.fn()}
          onToggleSpeaker={jest.fn()}
          onEnterConsultation={onEnter}
          onExit={jest.fn()}
          onRetryPermissions={jest.fn()}
        />,
      );

      fireEvent.press(getByText('Enter Consultation Room'));
      expect(onEnter).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. ActiveCallView Component (FR-TELE-002)', () => {
    test('Renders active call header, participants, duration, and encrypted badge', () => {
      const { getAllByText, getByText } = render(
        <ActiveCallView
          appointment={sampleAppointment}
          isVet={false}
          participantName="Jane Doe"
          remoteParticipantName="Dr. Sarah Mitchell"
          isMicMuted={false}
          isVideoMuted={false}
          isFrontCamera={true}
          isSpeakerOn={true}
          isReconnecting={false}
          reconnectSeconds={0}
          onToggleMic={jest.fn()}
          onToggleVideo={jest.fn()}
          onFlipCamera={jest.fn()}
          onToggleSpeaker={jest.fn()}
          onEndCall={jest.fn()}
          onRetryConnection={jest.fn()}
        />,
      );

      expect(getAllByText('Dr. Sarah Mitchell').length).toBeGreaterThan(0);
      expect(getByText('Patient: Milo')).toBeTruthy();
      expect(getByText('Encrypted')).toBeTruthy();
      expect(getByText('You (Front)')).toBeTruthy();
    });

    test('Displays reconnecting banner with 20s recovery indicator during network drops', () => {
      const onRetry = jest.fn();
      const { getByText } = render(
        <ActiveCallView
          appointment={sampleAppointment}
          isVet={false}
          participantName="Jane Doe"
          remoteParticipantName="Dr. Sarah Mitchell"
          isMicMuted={false}
          isVideoMuted={false}
          isFrontCamera={true}
          isSpeakerOn={true}
          isReconnecting={true}
          reconnectSeconds={20}
          onToggleMic={jest.fn()}
          onToggleVideo={jest.fn()}
          onFlipCamera={jest.fn()}
          onToggleSpeaker={jest.fn()}
          onEndCall={jest.fn()}
          onRetryConnection={onRetry}
        />,
      );

      expect(getByText('Connection unstable. Reconnecting... (20s)')).toBeTruthy();
      const retryBtn = getByText('Connection lost. Tap to reconnect now.');
      expect(retryBtn).toBeTruthy();
      fireEvent.press(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. ConsultRoomScreen Full Flow (FR-TELE-001, FR-TELE-002, FR-TELE-003)', () => {
    test('Renders empty/ineligible state when appointment is cancelled', () => {
      mockAppointmentReturn = {
        data: { ...sampleAppointment, status: 'cancelled' },
        isLoading: false,
        isError: false,
        error: null,
      };

      const { getByText } = render(<ConsultRoomScreen />);

      expect(getByText('Consultation Unavailable')).toBeTruthy();
      expect(getByText('Return to Appointments')).toBeTruthy();

      fireEvent.press(getByText('Return to Appointments'));
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/appointments');
    });

    test('Waiting room exit navigates back to appointments list', async () => {
      const { getByText } = render(<ConsultRoomScreen />);

      await waitFor(() => {
        expect(getByText('← Back')).toBeTruthy();
      });

      fireEvent.press(getByText('← Back'));
      expect(mockReplace).toHaveBeenCalledWith('/(tabs)/appointments');
    });

    test('Pet Parent end consultation flow: presents Leave Consultation alert without completing appointment', async () => {
      const { getByText, getByTestId } = render(<ConsultRoomScreen />);

      // Enter Consultation Room
      await waitFor(() => {
        expect(getByText('Enter Consultation Room')).toBeTruthy();
      });
      fireEvent.press(getByText('Enter Consultation Room'));

      // Wait for ActiveCallView to mount and tap End Call control
      await waitFor(() => {
        expect(getByTestId('control-end-call')).toBeTruthy();
      });

      fireEvent.press(getByTestId('control-end-call'));

      expect(Alert.alert).toHaveBeenCalledWith(
        'Leave Consultation Room',
        'Are you sure you want to leave the consultation room? You can re-enter while the appointment window is active.',
        expect.any(Array),
      );

      // Verify completeAppointment was NOT called
      expect(mockCompleteMutate).not.toHaveBeenCalled();
    });

    test('Veterinarian end consultation flow: presents End Consultation Visit and completion option', async () => {
      // Switch auth state to Vet
      mockAuthState = {
        user: {
          id: 'user-vet-1',
          email: 'vet@example.com',
          fullName: 'Dr. Sarah Mitchell',
          phone: '+1 555-0100',
          roles: ['vet'] as any,
          onboarded: true,
          isVet: true,
        },
        role: 'vet',
        isAuthenticated: true,
      };

      const { getByText, getByTestId } = render(<ConsultRoomScreen />);

      // Enter Consultation Room
      await waitFor(() => {
        expect(getByText('Enter Consultation Room')).toBeTruthy();
      });
      fireEvent.press(getByText('Enter Consultation Room'));

      // Wait for ActiveCallView and tap End Call control
      await waitFor(() => {
        expect(getByTestId('control-end-call')).toBeTruthy();
      });

      fireEvent.press(getByTestId('control-end-call'));

      // Check Alert options for Doctor
      expect(Alert.alert).toHaveBeenCalledWith(
        'End Consultation Visit',
        'Are you sure you want to conclude this consultation? This will mark the appointment as completed.',
        expect.any(Array),
      );
    });
  });
});
