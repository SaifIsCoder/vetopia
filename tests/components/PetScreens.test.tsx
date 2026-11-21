import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import AddPetScreen from '../../app/pets/add';
import PetPassportScreen from '../../app/pets/[id]';
import CareScreen from '../../app/(tabs)/care';

// Mock expo-router
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
    replace: mockReplace,
  }),
  useLocalSearchParams: () => ({
    id: 'pet-123',
  }),
}));

// Mock usePets hooks
const mockMutateAsync = jest.fn();
const mockCreateVacAsync = jest.fn();
const mockDeleteVacAsync = jest.fn();

const mockPassportData = {
  pet: {
    id: 'pet-123',
    name: 'Luna',
    species: 'Dog',
    breed: 'Golden Retriever',
    age: '2 years',
    sex: 'female',
    weight_kg: 24.5,
    color: 'Golden',
    bio: 'Energetic and friendly.',
    photo_url: null,
  },
  vaccinations: [
    {
      id: 'vac-1',
      pet_id: 'pet-123',
      vaccine_name: 'Rabies 3-Year',
      administered_at: '2026-10-24',
      next_due_at: '2029-10-24',
      batch_number: 'LOT-9921',
      administered_by: 'Metro Pet Hospital',
      notes: 'No adverse reactions',
    },
  ],
  prescriptions: [],
  consultations: [
    {
      id: 'apt-c1',
      vet_id: 'vet-1',
      pet_id: 'pet-123',
      status: 'completed',
      starts_at: '2026-10-15T10:00:00Z',
      symptoms: 'Mild sneezing and eye discharge',
      vet: {
        id: 'vet-1',
        name: 'Dr. Marco Rossi',
        specialty: 'Internal Medicine',
      },
    },
  ],
  isOffline: false,
  cachedAt: null as string | null,
};

jest.mock('../../src/hooks/usePets', () => ({
  usePets: jest.fn(() => ({
    data: [
      {
        id: 'pet-123',
        name: 'Luna',
        species: 'Dog',
        breed: 'Golden Retriever',
        age: '2 years',
        weight_kg: 24.5,
      },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  usePet: jest.fn(() => ({
    data: mockPassportData.pet,
    isLoading: false,
    error: null,
  })),
  usePetPassport: jest.fn(() => ({
    data: mockPassportData,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
    isRefetching: false,
  })),
  useCreatePet: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useUpdatePet: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useDeletePet: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useCreateVaccination: () => ({
    mutateAsync: mockCreateVacAsync,
    isPending: false,
  }),
  useDeleteVaccination: () => ({
    mutateAsync: mockDeleteVacAsync,
    isPending: false,
  }),
}));

// Mock usePrescriptions hook
jest.mock('../../src/hooks/usePrescriptions', () => ({
  usePetPrescriptions: jest.fn(() => ({
    data: [],
    isLoading: false,
    error: null,
  })),
}));

// Mock authStore
jest.mock('../../src/store/authStore', () => ({
  useAuthStore: () => ({
    user: { id: 'u1', fullName: 'Sarah Jenkins', email: 'sarah@example.com' },
    isAuthenticated: true,
  }),
}));

// Mock authService
jest.mock('../../src/lib/auth/authService', () => ({
  authService: {
    signOut: jest.fn(),
  },
}));

describe('Pet Management Screen Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('AddPetScreen', () => {
    test('Renders header and form fields', () => {
      const { getByText, getByPlaceholderText } = render(<AddPetScreen />);

      expect(getByText('Register New Pet')).toBeTruthy();
      expect(getByPlaceholderText('e.g. Bella, Milo, Luna')).toBeTruthy();
      expect(getByText('Species *')).toBeTruthy();
      expect(getByText('Dog')).toBeTruthy();
      expect(getByText('Cat')).toBeTruthy();
      expect(getByText('Register Pet')).toBeTruthy();
    });

    test('Validates pet name input', async () => {
      const { getByText, findByText } = render(<AddPetScreen />);

      const saveButton = getByText('Register Pet');
      fireEvent.press(saveButton);

      expect(await findByText('Pet name must be at least 2 characters.')).toBeTruthy();
      expect(mockMutateAsync).not.toHaveBeenCalled();
    });

    test('Submits pet registration with valid name', async () => {
      mockMutateAsync.mockResolvedValueOnce({ id: 'new-pet' });
      const { getByText, getByPlaceholderText } = render(<AddPetScreen />);

      const nameInput = getByPlaceholderText('e.g. Bella, Milo, Luna');
      fireEvent.changeText(nameInput, 'Barnaby');

      const saveButton = getByText('Register Pet');
      fireEvent.press(saveButton);

      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Barnaby',
          species: 'Dog',
        }),
      );
    });
  });

  describe('PetPassportScreen ([id].tsx)', () => {
    test('Renders pet details, species, and biometrics', () => {
      const { getByText } = render(<PetPassportScreen />);

      expect(getByText('Luna')).toBeTruthy();
      expect(getByText('Dog • Golden Retriever')).toBeTruthy();
      expect(getByText('24.5 kg')).toBeTruthy();
      expect(getByText('2 years')).toBeTruthy();
      expect(getByText('Female')).toBeTruthy();
      expect(getByText('Golden')).toBeTruthy();
      expect(getByText('Digital Health Passport')).toBeTruthy();
      expect(getByText('Edit Details')).toBeTruthy();
      expect(getByText('Delete Pet Profile')).toBeTruthy();
    });

    test('Renders vaccination history with status badge and metadata', () => {
      const { getByText } = render(<PetPassportScreen />);

      expect(getByText('Vaccination History')).toBeTruthy();
      expect(getByText('1 Recorded')).toBeTruthy();
      expect(getByText('Rabies 3-Year')).toBeTruthy();
      expect(getByText('Administered on 2026-10-24')).toBeTruthy();
      expect(getByText('Next: 2029-10-24')).toBeTruthy();
      expect(getByText('Clinic/Vet: Metro Pet Hospital')).toBeTruthy();
      expect(getByText('Lot #LOT-9921')).toBeTruthy();
    });

    test('Opens Add Vaccination modal and submits new immunization', async () => {
      mockCreateVacAsync.mockResolvedValueOnce({
        id: 'vac-new',
        pet_id: 'pet-123',
        vaccine_name: 'Bordetella',
        administered_at: '2026-10-24',
      });

      const { getByText, getByPlaceholderText } = render(<PetPassportScreen />);
      const addBtn = getByText('Add Vaccine');
      fireEvent.press(addBtn);

      expect(getByText('Add Vaccination Record')).toBeTruthy();

      const nameInput = getByPlaceholderText('e.g. Rabies 3-Year, DHPP, Bordetella');
      fireEvent.changeText(nameInput, 'Bordetella');

      const saveBtn = getByText('Save Vaccination');
      fireEvent.press(saveBtn);

      expect(mockCreateVacAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          pet_id: 'pet-123',
          vaccine_name: 'Bordetella',
        }),
      );
    });

    test('Renders past consultation records and presented symptoms', () => {
      const { getByText } = render(<PetPassportScreen />);

      expect(getByText('Consultation Records')).toBeTruthy();
      expect(getByText('1 Visits')).toBeTruthy();
      expect(getByText('Dr. Marco Rossi')).toBeTruthy();
      expect(getByText('Mild sneezing and eye discharge')).toBeTruthy();
      expect(getByText('COMPLETED')).toBeTruthy();
    });

    test('Displays offline cache indicator banner when isOffline is true', () => {
      mockPassportData.isOffline = true;
      mockPassportData.cachedAt = '2026-10-24T10:00:00.000Z';

      const { getByText } = render(<PetPassportScreen />);

      expect(getByText('Offline Mode — Cached Health Passport')).toBeTruthy();
      expect(getByText(/Viewing records cached on/)).toBeTruthy();

      // Reset
      mockPassportData.isOffline = false;
      mockPassportData.cachedAt = null;
    });
  });

  describe('CareScreen (My Pets Section)', () => {
    test('Renders My Pets section with registered pet card', () => {
      const { getByText } = render(<CareScreen />);

      expect(getByText('My Pets')).toBeTruthy();
      expect(getByText('Add Pet')).toBeTruthy();
      expect(getByText('Luna')).toBeTruthy();
      expect(getByText('Dog • Golden Retriever')).toBeTruthy();
      expect(getByText('24.5 kg')).toBeTruthy();
    });
  });
});
