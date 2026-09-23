import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const CHUNK_SIZE = 1800; // Safe threshold well below Android KeyStore 2048-byte limit

/**
 * In-memory fallback for environments without SecureStore (e.g. Node tests, SSR)
 */
const memoryStorage = new Map<string, string>();

async function isSecureStoreAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * SecureStorageAdapter
 * Conforms to Supabase's SupportedStorage interface.
 * Implements chunking to protect against Android KeyStore's 2048-byte item size limit.
 */
export const SecureStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    const isAvailable = await isSecureStoreAvailable();
    if (!isAvailable) {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return memoryStorage.get(key) ?? null;
    }

    try {
      const manifest = await SecureStore.getItemAsync(key);
      if (!manifest) return null;

      // Check if value was stored in chunks
      if (manifest.startsWith('__CHUNKED__:')) {
        const chunkCount = parseInt(manifest.replace('__CHUNKED__:', ''), 10);
        const chunkPromises: Promise<string | null>[] = [];
        for (let i = 0; i < chunkCount; i++) {
          chunkPromises.push(SecureStore.getItemAsync(`${key}_chunk_${i}`));
        }
        const chunks = await Promise.all(chunkPromises);
        if (chunks.some((c) => c === null)) {
          return null; // Missing chunk, invalid session
        }
        return chunks.join('');
      }

      return manifest;
    } catch (error) {
      console.warn(`[SecureStorageAdapter] Failed to read key ${key}:`, error);
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const isAvailable = await isSecureStoreAvailable();
    if (!isAvailable) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
      memoryStorage.set(key, value);
      return;
    }

    try {
      if (value.length <= CHUNK_SIZE) {
        // Clear any old chunks if previously chunked
        await this.clearChunks(key);
        await SecureStore.setItemAsync(key, value);
      } else {
        // Value exceeds single item limit, chunk it
        const chunks: string[] = [];
        for (let i = 0; i < value.length; i += CHUNK_SIZE) {
          chunks.push(value.slice(i, i + CHUNK_SIZE));
        }

        for (let i = 0; i < chunks.length; i++) {
          await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i]);
        }

        // Store manifest pointing to chunk count
        await SecureStore.setItemAsync(key, `__CHUNKED__:${chunks.length}`);
      }
    } catch (error) {
      console.warn(`[SecureStorageAdapter] Failed to write key ${key}:`, error);
    }
  },

  async removeItem(key: string): Promise<void> {
    const isAvailable = await isSecureStoreAvailable();
    if (!isAvailable) {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      memoryStorage.delete(key);
      return;
    }

    try {
      await this.clearChunks(key);
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.warn(`[SecureStorageAdapter] Failed to delete key ${key}:`, error);
    }
  },

  async clearChunks(key: string): Promise<void> {
    try {
      const manifest = await SecureStore.getItemAsync(key);
      if (manifest && manifest.startsWith('__CHUNKED__:')) {
        const count = parseInt(manifest.replace('__CHUNKED__:', ''), 10);
        for (let i = 0; i < count; i++) {
          await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  },
};
