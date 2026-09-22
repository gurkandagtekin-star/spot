import { Platform } from 'react-native';
import type { ThemeScheme } from '../theme';

const KEY = 'spot_theme_v2';

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadTheme(): Promise<ThemeScheme | null> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      return raw === 'light' || raw === 'dark' ? raw : null;
    }
    const store = await nativeStore();
    const raw = await store.getItemAsync(KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

export function saveTheme(scheme: ThemeScheme) {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, scheme);
    return;
  }
  void nativeStore()
    .then((store) => store.setItemAsync(KEY, scheme))
    .catch(() => {});
}
