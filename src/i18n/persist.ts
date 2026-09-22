import { Platform } from 'react-native';
import type { AppLanguage } from './i18n';

const KEY = 'spot_lang';

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadLanguage(): Promise<AppLanguage | null> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      return raw === 'tr' || raw === 'en' ? raw : null;
    }
    const store = await nativeStore();
    const raw = await store.getItemAsync(KEY);
    return raw === 'tr' || raw === 'en' ? raw : null;
  } catch {
    return null;
  }
}

export function saveLanguage(lng: AppLanguage) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, lng);
    return;
  }
  void nativeStore()
    .then((store) => store.setItemAsync(KEY, lng))
    .catch(() => {});
}
