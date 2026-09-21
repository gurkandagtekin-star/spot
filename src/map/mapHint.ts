import { Platform } from 'react-native';

const KEY = 'markdate_map_hint_seen';

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadMapHintSeen() {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(KEY) === '1';
    }
    const store = await nativeStore();
    return (await store.getItemAsync(KEY)) === '1';
  } catch {
    return false;
  }
}

export function rememberMapHintSeen() {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(KEY, '1');
      return;
    }
    void nativeStore()
      .then((store) => store.setItemAsync(KEY, '1'))
      .catch(() => {});
  } catch {
    /* ignore */
  }
}
