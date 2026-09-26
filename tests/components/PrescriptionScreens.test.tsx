import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import CreatePrescriptionScreen from '../../app/consult/[id]/prescription';
import PrescriptionDetailScreen from '../../app/prescriptions/[id]';
import { MedicationFormModal } from '../../src/components/prescriptions/MedicationFormModal';
import { MedicationItemRow } from '../../src/components/prescriptions/MedicationItemRow';
import { PrescriptionCard } from '../../src/components/prescriptions/PrescriptionCard';
import { Prescription } from '../../src/types/prescription';
import * as pdfModule from '../../src/lib/prescriptions/prescriptionPdf';

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
    id: 'apt-001',
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

// Mock Auth Store
let mockAuthState = {
  user: {
    id: 'user-vet-1',
    email: 'dr.smith@example.com',
    fullName: 'Dr. Sarah Mitchell',
    phone: '+44 7700 900077',
    roles: ['vet'] as any,
    onboarded: true,
    isVet: true,
  },
  role: 'vet',
  isAuthenticated: true,
};

jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => mockAuthState,
}));

// Sample data
const sampleCompletedAppointment = {
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
  status: 'completed',
  price_usd: 29,
  vet: {
    id: 'vet-123',
    name: 'Dr. Sarah Mitchell',
    specialty: 'General Veterinary Medicine',
  },
};

const samplePrescription: Prescription = {
  id: 'rx-001',
  appointment_id: 'apt-001',
  vet_id: 'vet-123',
  pet_id: 'pet-123',
  diagnosis: 'Canine Atopic Dermatitis',
  notes: 'Administer oral tablets with morning food.',
  refills_allowed: 1,
  status: 'active',
  created_at: '2026-10-01T10:35:00Z',
  items: [
    {
      id: 'item-1',
      prescription_id: 'rx-001',
      medication_name: 'Apoquel (Oclacitinib)',
      dosage: '16mg',
      frequency: 'Twice daily',
      duration: '30 days',
      special_instructions: 'Give with food',
    },
  ],
  vet: {
    id: 'vet-123',
    name: 'Dr. Sarah Mitchell',
    specialty: 'General Veterinary Medicine',
    country: 'United Kingdom',
    flag: '🇬🇧',
    verified: true,
  },
  pet: {
    id: 'pet-123',
    name: 'Luna',
    species: 'Canine',
    breed: 'Golden Retriever',
    age: '3 years',
    weight_kg: 28.5,
  },
};

// Hook Mocks
let mockAppointmentReturn: any = {
  data: sampleCompletedAppointment,
  isLoading: false,
  isError: false,
};

let mockExistingPrescriptionReturn: any = {
  data: null,
  isLoading: false,
  isError: false,
};

let mockPrescriptionDetailReturn: any = {
  data: samplePrescription,
  isLoading: false,
  isError: false,
  refetch: jest.fn(),
};

const mockCreatePrescriptionMutate = jest.fn();

jest.mock('../../src/hooks/useAppointments', () => ({
  useAppointment: () => mockAppointmentReturn,
}));

jest.mock('../../src/hooks/usePrescriptions', () => ({
  useAppointmentPrescription: () => mockExistingPrescriptionReturn,
  usePrescription: () => mockPrescriptionDetailReturn,
  useCreatePrescription: () => ({
    mutateAsync: mockCreatePrescriptionMutate,
    isPending: false,
  }),
}));

// Mock PDF export
jest.spyOn(pdfModule, 'exportPrescriptionPdf').mockResolvedValue(undefined as any);

describe('Digital Prescriptions UI Components (MVP-06 / Phase 7)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState = {
      user: {
        id: 'user-vet-1',
        email: 'dr.smith@example.com',
        fullName: 'Dr. Sarah Mitchell',
        phone: '+44 7700 900077',
        roles: ['vet'] as any,
        onboarded: true,
        isVet: true,
      },
      role: 'vet',
      isAuthenticated: true,
    };
    mockAppointmentReturn = {
      data: sampleCompletedAppointment,
      isLoading: false,
      isError: false,
    };
    mockExistingPrescriptionReturn = {
      data: null,
      isLoading: false,
      isError: false,
    };
    mockPrescriptionDetailReturn = {
      data: samplePrescription,
      isLoading: false,
      isError: false,
      refetch: jest.fn(),
    };
  });

  // ==========================================
  // 1. MedicationItemRow Component
  // ==========================================
  describe('1. MedicationItemRow Component', () => {
    test('Renders medication name, dosage, frequency, and duration', () => {
      const { getByText } = render(
        <MedicationItemRow
          item={{
            medication_name: 'Amoxicillin',
            dosage: '250mg',
            frequency: 'Twice daily',
            duration: '10 days',
            special_instructions: 'Give with meals',
          }}
          index={0}
        />,
      );

      expect(getByText('Amoxicillin')).toBeTruthy();
      expect(getByText('250mg')).toBeTruthy();
      expect(getByText('Twice daily')).toBeTruthy();
      expect(getByText('10 days')).toBeTruthy();
      expect(getByText('Note: Give with meals')).toBeTruthy();
    });

    test('Calls onRemove when remove button is pressed', () => {
      const onRemoveMock = jest.fn();
      const { getByTestId } = render(
        <MedicationItemRow
          item={{
            medication_name: 'Amoxicillin',
            dosage: '250mg',
            frequency: 'Twice daily',
            duration: '10 days',
          }}
          index={0}
          isEditable={true}
          onRemove={onRemoveMock}
        />,
      );

      const removeBtn = getByTestId('remove-medication-0');
      fireEvent.press(removeBtn);
      expect(onRemoveMock).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 2. MedicationFormModal Component
  // ==========================================
  describe('2. MedicationFormModal Component', () => {
    test('Validates inputs and calls onSave when all required fields are provided', () => {
      const onSaveMock = jest.fn();
      const onCloseMock = jest.fn();

      const { getByPlaceholderText, getByText } = render(
        <MedicationFormModal visible={true} onClose={onCloseMock} onSave={onSaveMock} />,
      );

      // Attempt to submit empty form
      fireEvent.press(getByText('Add Drug'));
      expect(getByText('Medication name is required.')).toBeTruthy();

      // Fill in fields
      fireEvent.changeText(
        getByPlaceholderText('e.g. Amoxicillin / Clavulanate, Carprofen'),
        'Carprofen',
      );
      fireEvent.changeText(getByPlaceholderText('e.g. 250mg, 1 tablet, 5ml'), '75mg tablet');
      fireEvent.changeText(
        getByPlaceholderText('e.g. Twice daily (every 12 hours), Once daily with food'),
        'Once daily with food',
      );
      fireEvent.changeText(getByPlaceholderText('e.g. 7 days, 14 days, 1 month'), '14 days');

      fireEvent.press(getByText('Add Drug'));

      expect(onSaveMock).toHaveBeenCalledWith({
        medication_name: 'Carprofen',
        dosage: '75mg tablet',
        frequency: 'Once daily with food',
        duration: '14 days',
        special_instructions: undefined,
      });
      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  // ==========================================
  // 3. PrescriptionCard Component
  // ==========================================
  describe('3. PrescriptionCard Component', () => {
    test('Renders diagnosis, date, veterinarian, and medication count badge', () => {
      const { getByText } = render(<PrescriptionCard prescription={samplePrescription} />);

      expect(getByText('Canine Atopic Dermatitis')).toBeTruthy();
      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText('1 Medication')).toBeTruthy();
      expect(getByText('1 Refill')).toBeTruthy();
    });

    test('Navigates to prescription details screen when pressed', () => {
      const { getByRole } = render(<PrescriptionCard prescription={samplePrescription} />);

      const cardBtn = getByRole('button');
      fireEvent.press(cardBtn);

      expect(mockPush).toHaveBeenCalledWith('/prescriptions/rx-001');
    });
  });

  // ==========================================
  // 4. CreatePrescriptionScreen (app/consult/[id]/prescription.tsx)
  // ==========================================
  describe('4. CreatePrescriptionScreen', () => {
    test('Renders consultation context (patient, doctor, completed badge)', () => {
      const { getByText } = render(<CreatePrescriptionScreen />);

      expect(getByText('Create Prescription')).toBeTruthy();
      expect(getByText('Patient: Luna (Dog)')).toBeTruthy();
      expect(getByText('Dr. Sarah Mitchell')).toBeTruthy();
      expect(getByText('COMPLETED')).toBeTruthy();
    });

    test('Restricts access to pet parents with Access Restricted state', () => {
      mockAuthState = {
        ...mockAuthState,
        user: { ...mockAuthState.user, isVet: false, roles: ['pet_parent'] as any },
        role: 'pet_parent',
      };

      const { getByText } = render(<CreatePrescriptionScreen />);
      expect(getByText('Access Restricted')).toBeTruthy();
      expect(
        getByText('Only licensed veterinarians may create and issue digital prescriptions.'),
      ).toBeTruthy();
    });

    test('Prevents creation if appointment status is not completed', () => {
      mockAppointmentReturn = {
        data: { ...sampleCompletedAppointment, status: 'scheduled' },
        isLoading: false,
        isError: false,
      };

      const { getByText } = render(<CreatePrescriptionScreen />);
      expect(getByText('Appointment Incomplete')).toBeTruthy();
      expect(
        getByText(/Prescriptions can only be issued for completed consultations/),
      ).toBeTruthy();
    });

    test('Shows Prescription Already Issued if appointment already has a prescription', () => {
      mockExistingPrescriptionReturn = {
        data: samplePrescription,
        isLoading: false,
        isError: false,
      };

      const { getByText } = render(<CreatePrescriptionScreen />);
      expect(getByText('Prescription Already Issued')).toBeTruthy();
    });

    test('Validates diagnosis and medication requirements on submit', async () => {
      const { getByText } = render(<CreatePrescriptionScreen />);

      const submitBtn = getByText('Issue Digital Prescription');
      fireEvent.press(submitBtn);

      await waitFor(() => {
        expect(getByText('Diagnosis is required.')).toBeTruthy();
        expect(getByText('At least one medication is required.')).toBeTruthy();
      });

      expect(mockCreatePrescriptionMutate).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 5. PrescriptionDetailScreen (app/prescriptions/[id].tsx)
  // ==========================================
  describe('5. PrescriptionDetailScreen', () => {
    test('Renders structured prescription view, patient details, and medication items', () => {
      const { getByText, getAllByText } = render(<PrescriptionDetailScreen />);

      expect(getByText('Digital Prescription')).toBeTruthy();
      expect(getByText('Luna')).toBeTruthy();
      expect(getAllByText('Dr. Sarah Mitchell').length).toBeGreaterThanOrEqual(1);
      expect(getByText('Canine Atopic Dermatitis')).toBeTruthy();
      expect(getByText('Apoquel (Oclacitinib)')).toBeTruthy();
      expect(getByText('16mg')).toBeTruthy();
      expect(
        getByText(/Controlled substances \(Schedules II–V\) cannot be prescribed/),
      ).toBeTruthy();
    });

    test('Calls exportPrescriptionPdf when Export PDF button is pressed', async () => {
      const { getByText } = render(<PrescriptionDetailScreen />);

      const exportBtn = getByText('Export PDF');
      fireEvent.press(exportBtn);

      await waitFor(() => {
        expect(pdfModule.exportPrescriptionPdf).toHaveBeenCalledWith(samplePrescription);
      });
    });

    test('Renders EmptyState when prescription is unavailable or unauthorized', () => {
      mockPrescriptionDetailReturn = {
        data: null,
        isLoading: false,
        isError: true,
        error: new Error('Permission denied to access this prescription.'),
        refetch: jest.fn(),
      };

      const { getByText } = render(<PrescriptionDetailScreen />);

      expect(getByText('Prescription Unavailable')).toBeTruthy();
      expect(getByText('Permission denied to access this prescription.')).toBeTruthy();
    });
  });
});
