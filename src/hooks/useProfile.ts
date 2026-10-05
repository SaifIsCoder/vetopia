/**
 * Profile Management Hook (MVP-10)
 * Vetopia Mobile
 */

import { useState } from 'react';
import { useAuthStore, UserProfile } from '../store/authStore';
import { profileService, UpdateProfileInput } from '../lib/profile/profileService';

export function useProfile() {
  const user = useAuthStore((state) => state.user);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const updateProfile = async (input: UpdateProfileInput): Promise<UserProfile | null> => {
    if (!user?.id) {
      setUpdateError('No authenticated user session found.');
      return null;
    }

    setIsUpdating(true);
    setUpdateError(null);
    setIsSuccess(false);

    try {
      const updated = await profileService.updateProfile(user.id, input);
      setIsSuccess(true);
      return updated;
    } catch (err: any) {
      const msg = err?.message || 'Failed to update profile. Please try again.';
      setUpdateError(msg);
      return null;
    } finally {
      setIsUpdating(false);
    }
  };

  const resetStatus = () => {
    setUpdateError(null);
    setIsSuccess(false);
  };

  return {
    user,
    updateProfile,
    isUpdating,
    updateError,
    isSuccess,
    resetStatus,
  };
}
