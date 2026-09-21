import { Platform } from 'react-native';

const KEY = 'spot_follows';

let cache: Record<string, string[]> = {};

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadFollows() {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(KEY);
    } else {
      const store = await nativeStore();
      raw = await store.getItemAsync(KEY);
    }
    cache = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function persist() {
  const raw = JSON.stringify(cache);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, raw);
    return;
  }
  void nativeStore()
    .then((store) => store.setItemAsync(KEY, raw))
    .catch(() => {});
}

export function followingFor(meId: string) {
  return cache[meId] || [];
}

export function rememberFollow(meId: string, otherId: string) {
  if (!meId || !otherId || meId === otherId) return;
  const next = Array.from(new Set([...(cache[meId] || []), otherId]));
  cache[meId] = next;
  persist();
}

export function forgetFollow(meId: string, otherId: string) {
  if (!meId) return;
  cache[meId] = (cache[meId] || []).filter((id) => id !== otherId);
  persist();
}

export function mergeFollowingIds(server: string[] | undefined, meId: string) {
  return Array.from(new Set([...(server || []), ...followingFor(meId)]));
}
