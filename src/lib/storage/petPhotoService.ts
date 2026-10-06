/**
 * Pet Photo Service (MVP-02: FR-PET-001)
 * Handles native camera & photo library selection via expo-image-picker
 * and direct upload to Supabase Storage 'user-media' bucket.
 */

import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { supabase } from '../supabase/client';

export interface PickPhotoResult {
  canceled: boolean;
  uri?: string;
  error?: string;
}

export class PetPhotoService {
  /**
   * Request permissions and prompt user to select an image from the library
   */
  async pickFromLibrary(): Promise<PickPhotoResult> {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        return {
          canceled: true,
          error: 'Photo library access is required to choose a pet picture.',
        };
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { canceled: true };
      }

      return {
        canceled: false,
        uri: result.assets[0].uri,
      };
    } catch (err: any) {
      console.warn('[PetPhotoService] pickFromLibrary error:', err);
      return {
        canceled: true,
        error: err?.message || 'Failed to select photo from library.',
      };
    }
  }

  /**
   * Request camera permissions and capture a fresh pet photo
   */
  async takePhoto(): Promise<PickPhotoResult> {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        return {
          canceled: true,
          error: 'Camera access is required to take a pet photo.',
        };
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return { canceled: true };
      }

      return {
        canceled: false,
        uri: result.assets[0].uri,
      };
    } catch (err: any) {
      console.warn('[PetPhotoService] takePhoto error:', err);
      return {
        canceled: true,
        error: err?.message || 'Failed to capture photo with camera.',
      };
    }
  }

  /**
   * Upload image binary to Supabase 'user-media' bucket.
   * Falls back to local URI if cloud bucket is unreachable, ensuring offline pet registration succeeds.
   */
  async uploadPetPhoto(uri: string, ownerId: string, petId?: string): Promise<string> {
    try {
      const filename = `pets/${ownerId}/${petId || 'draft'}/photo-${Date.now()}.jpg`;

      // Read file data for upload
      let fileData: any;
      if (Platform.OS === 'web') {
        const res = await fetch(uri);
        fileData = await res.blob();
      } else {
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: 'photo.jpg',
          type: 'image/jpeg',
        } as any);
        fileData = formData;
      }

      const { data, error } = await supabase.storage
        .from('user-media')
        .upload(filename, fileData, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error || !data?.path) {
        console.warn('[PetPhotoService] Cloud upload note (fallback to local URI):', error?.message);
        return uri;
      }

      const { data: publicData } = supabase.storage
        .from('user-media')
        .getPublicUrl(data.path);

      return publicData?.publicUrl || uri;
    } catch (err: any) {
      console.warn('[PetPhotoService] uploadPetPhoto exception (using local URI):', err?.message);
      return uri;
    }
  }
}

export const petPhotoService = new PetPhotoService();
