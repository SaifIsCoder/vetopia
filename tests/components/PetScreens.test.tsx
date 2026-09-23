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
    data: {
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
    isLoading: false,
    error: null,
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
