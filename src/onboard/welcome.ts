import { Platform } from 'react-native';

const KEY = 'spot_welcome_seen';

async function nativeStore() {
  return import('expo-secure-store');
}

async function readAll(): Promise<Record<string, boolean>> {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(KEY);
    } else {
      const store = await nativeStore();
      raw = await store.getItemAsync(KEY);
    }
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, boolean>) {
  const raw = JSON.stringify(map);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, raw);
    return;
  }
  void nativeStore()
    .then((store) => store.setItemAsync(KEY, raw))
    .catch(() => {});
}

export async function loadWelcomeSeen(userId: string) {
  if (!userId) return false;
  const map = await readAll();
  return Boolean(map[userId]);
}

export async function markWelcomeSeen(userId: string) {
  if (!userId) return;
  const map = await readAll();
  map[userId] = true;
  writeAll(map);
}
