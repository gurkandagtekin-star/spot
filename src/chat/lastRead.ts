import { Platform } from 'react-native';

const KEY = 'spot_last_read';

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadLastRead(): Promise<Record<string, number>> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    }
    const store = await nativeStore();
    const raw = await store.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function saveLastRead(map: Record<string, number>) {
  const raw = JSON.stringify(map);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, raw);
    return;
  }
  void nativeStore()
    .then((store) => store.setItemAsync(KEY, raw))
    .catch(() => {});
}
