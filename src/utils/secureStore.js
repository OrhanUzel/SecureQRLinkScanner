import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const isWeb = Platform.OS === 'web';

export async function getItemAsync(key) {
  if (isWeb) {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key, value) {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      return;
    } catch {
      return;
    }
  }
  return SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key) {
  if (isWeb) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      return;
    } catch {
      return;
    }
  }
  return SecureStore.deleteItemAsync(key);
}