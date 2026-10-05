/**
 * Profile Management Service (MVP-10)
 * Vetopia Mobile
 */

import { supabase } from '../supabase/client';
import { useAuthStore, UserProfile } from '../../store/authStore';
import { queryClient } from '../query/client';
import { ValidationError, normalizeError } from '../api/errors';
import { authService } from '../auth/authService';

export interface UpdateProfileInput {
  fullName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

export class ProfileService {
  /**
   * Validates full name input.
   */
  private validateFullName(name?: string): string | undefined {
    if (name === undefined) return undefined;
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      throw new ValidationError('Full name must be at least 2 characters long.');
    }
    if (trimmed.length > 100) {
      throw new ValidationError('Full name cannot exceed 100 characters.');
    }
    return trimmed;
  }

  /**
   * Validates phone number input if provided.
   */
  private validatePhone(phone?: string | null): string | null | undefined {
    if (phone === undefined) return undefined;
    if (phone === null || phone.trim() === '') return null;
    const trimmed = phone.trim();
    // Allow international numbers with +, digits, spaces, hyphens, and parens (7-20 chars)
    const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;
    if (!phoneRegex.test(trimmed)) {
      throw new ValidationError('Please enter a valid phone number (7-20 digits).');
    }
    return trimmed;
  }

  /**
   * Updates authenticated user's profile with strict input validation.
   * Strictly protects system fields (id, email, roles, onboarded).
   */
  public async updateProfile(userId: string, input: UpdateProfileInput): Promise<UserProfile> {
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required to update profile.');
    }

    const validatedName = this.validateFullName(input.fullName);
    const validatedPhone = this.validatePhone(input.phone);

    const updates: Record<string, unknown> = {};
    if (validatedName !== undefined) updates.full_name = validatedName;
    if (validatedPhone !== undefined) updates.phone = validatedPhone;
    if (input.avatarUrl !== undefined) updates.avatar_url = input.avatarUrl;

    if (Object.keys(updates).length === 0) {
      throw new ValidationError('No valid profile fields provided for update.');
    }

    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

      if (error) {
        throw normalizeError(error);
      }

      // Reload authoritatively from database to ensure fresh state
      const currentEmail = useAuthStore.getState().user?.email;
      const updatedProfile = await authService.loadUserProfile(userId, currentEmail);

      // Sync local auth store
      useAuthStore.getState().setUser(updatedProfile);

      // Invalidate relevant React Query caches
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });

      return updatedProfile;
    } catch (err) {
      throw normalizeError(err);
    }
  }

  /**
   * Fetches the authoritative user profile.
   */
  public async getProfile(userId: string): Promise<UserProfile> {
    const currentEmail = useAuthStore.getState().user?.email;
    return authService.loadUserProfile(userId, currentEmail);
  }
}

export const profileService = new ProfileService();
