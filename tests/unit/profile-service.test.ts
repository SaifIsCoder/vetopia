/**
 * ProfileService Unit Tests (MVP-10)
 * Vetopia Mobile
 */

import { profileService } from '../../src/lib/profile/profileService';
import { supabase } from '../../src/lib/supabase/client';
import { authService } from '../../src/lib/auth/authService';
import { useAuthStore } from '../../src/store/authStore';
import { queryClient } from '../../src/lib/query/client';
import { ValidationError } from '../../src/lib/api/errors';

jest.mock('../../src/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../src/lib/auth/authService', () => ({
  authService: {
    loadUserProfile: jest.fn(),
  },
}));

jest.mock('../../src/lib/query/client', () => ({
  queryClient: {
    invalidateQueries: jest.fn(),
  },
}));

describe('ProfileService — Unit & Security Verification (MVP-10)', () => {
  const mockUser = {
    id: 'user-123',
    email: 'sarah.jenkins@example.com',
    fullName: 'Sarah Jenkins',
    phone: '+1 555 123 4567',
    avatarUrl: 'https://example.com/avatar.jpg',
    roles: ['pet_parent'] as ('pet_parent' | 'vet' | 'admin')[],
    onboarded: true,
    isVet: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.getState().setUser(mockUser);
  });

  describe('1. Input Validation (FR-PROF-001)', () => {
    test('Throws ValidationError if userId is empty or missing', async () => {
      await expect(profileService.updateProfile('', { fullName: 'New Name' })).rejects.toThrow(
        ValidationError,
      );
      await expect(
        profileService.updateProfile(null as unknown as string, { fullName: 'New Name' }),
      ).rejects.toThrow(ValidationError);
    });

    test('Throws ValidationError if full name is fewer than 2 characters', async () => {
      await expect(profileService.updateProfile('user-123', { fullName: 'A' })).rejects.toThrow(
        ValidationError,
      );
      await expect(profileService.updateProfile('user-123', { fullName: '   ' })).rejects.toThrow(
        ValidationError,
      );
    });

    test('Throws ValidationError if full name exceeds 100 characters', async () => {
      const longName = 'A'.repeat(101);
      await expect(
        profileService.updateProfile('user-123', { fullName: longName }),
      ).rejects.toThrow(ValidationError);
    });

    test('Throws ValidationError for invalid phone number formats', async () => {
      await expect(profileService.updateProfile('user-123', { phone: '123' })).rejects.toThrow(
        ValidationError,
      );
      await expect(
        profileService.updateProfile('user-123', { phone: 'not-a-phone' }),
      ).rejects.toThrow(ValidationError);
      await expect(
        profileService.updateProfile('user-123', { phone: '!!!@@@###$$$' }),
      ).rejects.toThrow(ValidationError);
    });

    test('Accepts valid international and local phone numbers', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (authService.loadUserProfile as jest.Mock).mockResolvedValue({
        ...mockUser,
        phone: '+44 20 7946 0912',
      });

      const updated = await profileService.updateProfile('user-123', {
        phone: '+44 20 7946 0912',
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '+44 20 7946 0912' }),
      );
      expect(updated.phone).toBe('+44 20 7946 0912');
    });

    test('Allows clearing phone number with empty string or null', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (authService.loadUserProfile as jest.Mock).mockResolvedValue({
        ...mockUser,
        phone: null,
      });

      await profileService.updateProfile('user-123', { phone: '' });
      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ phone: null }));
    });

    test('Throws ValidationError if no valid fields are provided for update', async () => {
      await expect(profileService.updateProfile('user-123', {})).rejects.toThrow(ValidationError);
    });
  });

  describe('2. Security & Authorization Enforcement', () => {
    test('Never writes protected fields (roles, id, email) to profiles update', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (authService.loadUserProfile as jest.Mock).mockResolvedValue(mockUser);

      // Attempting to pass protected fields in input cast as any
      const maliciousInput = {
        fullName: 'Dr. Hacker',
        role: 'admin',
        roles: ['admin', 'veterinarian'],
        id: 'different-id',
        email: 'hacked@example.com',
      } as unknown as Record<string, unknown>;

      await profileService.updateProfile('user-123', maliciousInput as any);

      // Verify the payload sent to Supabase update ONLY contains allowed columns
      expect(mockUpdate).toHaveBeenCalledWith({
        full_name: 'Dr. Hacker',
      });
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          role: expect.anything(),
        }),
      );
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          roles: expect.anything(),
        }),
      );
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.anything(),
        }),
      );
      expect(mockUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          email: expect.anything(),
        }),
      );
    });

    test('Handles Supabase database/RLS error correctly', async () => {
      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          error: { message: 'Row level security violation', code: '42501' },
        }),
      });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });

      await expect(
        profileService.updateProfile('user-123', { fullName: 'Sarah Smith' }),
      ).rejects.toThrow();
    });
  });

  describe('3. State & Cache Synchronization', () => {
    test('Synchronizes useAuthStore and invalidates queryClient cache on success', async () => {
      const updatedMock = {
        ...mockUser,
        fullName: 'Sarah Jenkins-Smith',
        phone: '+1 555 999 8888',
      };

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      (supabase.from as jest.Mock).mockReturnValue({ update: mockUpdate });
      (authService.loadUserProfile as jest.Mock).mockResolvedValue(updatedMock);

      const result = await profileService.updateProfile('user-123', {
        fullName: 'Sarah Jenkins-Smith',
        phone: '+1 555 999 8888',
      });

      expect(mockUpdate).toHaveBeenCalledWith({
        full_name: 'Sarah Jenkins-Smith',
        phone: '+1 555 999 8888',
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'user-123');

      // Verify useAuthStore state update
      expect(useAuthStore.getState().user?.fullName).toBe('Sarah Jenkins-Smith');
      expect(useAuthStore.getState().user?.phone).toBe('+1 555 999 8888');

      // Verify query cache invalidation
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ['profile', 'user-123'],
      });

      expect(result).toEqual(updatedMock);
    });

    test('getProfile retrieves authoritative profile via authService', async () => {
      (authService.loadUserProfile as jest.Mock).mockResolvedValue(mockUser);

      const profile = await profileService.getProfile('user-123');
      expect(authService.loadUserProfile).toHaveBeenCalledWith('user-123', mockUser.email);
      expect(profile).toEqual(mockUser);
    });
  });
});
