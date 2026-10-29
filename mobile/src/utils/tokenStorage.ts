import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const webStorageKey = (key: string) => `busnext:${key}`;

export async function getStoredToken(key: string): Promise<string | null> {
  if (Platform.OS !== 'web') return SecureStore.getItemAsync(key);

  try {
    return globalThis.localStorage.getItem(webStorageKey(key));
  } catch {
    return null;
  }
}

export async function setStoredToken(key: string, value: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  try {
    globalThis.localStorage.setItem(webStorageKey(key), value);
  } catch {
    // Web storage can be blocked in private or restricted browser contexts.
  }
}

export async function deleteStoredToken(key: string): Promise<void> {
  if (Platform.OS !== 'web') {
    await SecureStore.deleteItemAsync(key);
    return;
  }

  try {
    globalThis.localStorage.removeItem(webStorageKey(key));
  } catch {
    // Web storage can be blocked in private or restricted browser contexts.
  }
}
