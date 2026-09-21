import { Platform } from 'react-native';

const KEY = 'spot_inbox_hide';

type InboxHide = {
  chats: string[];
  requests: string[];
};

let cache: InboxHide = { chats: [], requests: [] };

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadInboxHide() {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(KEY);
    } else {
      const store = await nativeStore();
      raw = await store.getItemAsync(KEY);
    }
    const parsed = raw ? (JSON.parse(raw) as InboxHide) : null;
    cache = {
      chats: Array.isArray(parsed?.chats) ? parsed.chats : [],
      requests: Array.isArray(parsed?.requests) ? parsed.requests : [],
    };
  } catch {
    cache = { chats: [], requests: [] };
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

export function isChatHidden(id: string) {
  return cache.chats.includes(id);
}

export function isRequestHidden(id: string) {
  return cache.requests.includes(id);
}

export function hideChatLocal(id: string) {
  if (!id || cache.chats.includes(id)) return;
  cache.chats = [...cache.chats, id];
  persist();
}

export function hideRequestLocal(id: string) {
  if (!id || cache.requests.includes(id)) return;
  cache.requests = [...cache.requests, id];
  persist();
}
