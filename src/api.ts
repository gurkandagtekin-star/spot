import { Platform } from 'react-native';
import type { ChatThread, JoinRequest, Pin, Profile } from './types';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3001';

export type Snapshot = {
  me: Profile;
  profiles: Profile[];
  pins: Pin[];
  requests: JoinRequest[];
  chats: ChatThread[];
  blocked: Profile[];
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'spot_token';
let memoryToken: string | null = null;

async function nativeStore() {
  return import('expo-secure-store');
}

export function getToken() {
  if (
    !memoryToken &&
    Platform.OS === 'web' &&
    typeof localStorage !== 'undefined'
  ) {
    memoryToken = localStorage.getItem(TOKEN_KEY);
  }
  return memoryToken;
}

export function setToken(token: string | null) {
  memoryToken = token;
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    return;
  }
  void nativeStore()
    .then((store) =>
      token ? store.setItemAsync(TOKEN_KEY, token) : store.deleteItemAsync(TOKEN_KEY),
    )
    .catch(() => {});
}

export async function hydrateToken() {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      memoryToken = localStorage.getItem(TOKEN_KEY);
    }
    return memoryToken;
  }
  try {
    const store = await nativeStore();
    memoryToken = await store.getItemAsync(TOKEN_KEY);
  } catch {
    /* cihazda yoksa bellek */
  }
  return memoryToken;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; token?: string | null } = {},
): Promise<T> {
  const token = opts.token === undefined ? getToken() : opts.token;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError('Sunucuya bağlanılamadı. İnternetini kontrol et.', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ApiError(data.error || 'Sunucu hatası.', res.status);
  }
  return data;
}

export const api = {
  providers: () =>
    request<{ google: boolean; instagram: boolean }>('/auth/providers', {
      token: null,
    }),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  registerPushToken: (token: string) =>
    request<{ ok: boolean }>('/me/push-token', { method: 'POST', body: { token } }),
  unregisterPushToken: (token: string) =>
    request<{ ok: boolean }>('/me/push-token', { method: 'DELETE', body: { token } }),
  deleteAccount: () =>
    request<{ ok: boolean }>('/me', { method: 'DELETE' }),
  snapshot: () => request<Snapshot>('/snapshot'),
  patchMe: (
    patch: Partial<Pick<Profile, 'name' | 'bio' | 'instagram'> & { onboarded?: boolean }>,
  ) => request<Snapshot>('/me', { method: 'PATCH', body: patch }),
  igTicket: () => request<{ ticket: string }>('/auth/instagram/ticket', { method: 'POST' }),
  disconnectInstagram: () =>
    request<Snapshot>('/me/instagram', { method: 'DELETE' }),
  dropPin: (body: {
    text: string;
    kind: Pin['kind'];
    lat: number;
    lng: number;
    meetAt: number;
    placeName?: string;
    featured?: boolean;
  }) => request<Snapshot>('/pins', { method: 'POST', body }),
  activatePro: (plan: 'monthly' | 'yearly') =>
    request<Snapshot>('/me/pro', { method: 'POST', body: { plan } }),
  lookupPlace: (lat: number, lng: number) =>
    request<{ placeName: string; area?: string }>(`/geo/reverse?lat=${lat}&lng=${lng}`),
  lookupPlaces: (lat: number, lng: number) =>
    request<{ places: import('./types').MapPlace[] }>(
      `/geo/places?lat=${lat}&lng=${lng}`,
    ),
  joinPin: (pinId: string) =>
    request<Snapshot>(`/pins/${pinId}/join`, { method: 'POST' }),
  decide: (requestId: string, accept: boolean) =>
    request<{ chatId: string | null; snapshot: Snapshot }>(
      `/requests/${requestId}/decide`,
      { method: 'POST', body: { accept } },
    ),
  sendMessage: (chatId: string, text: string) =>
    request<Snapshot>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: { text },
    }),
  uploadPhoto: (dataUrl: string) =>
    request<Snapshot>('/me/photo', { method: 'POST', body: { dataUrl } }),
  closePin: (pinId: string) =>
    request<Snapshot>(`/pins/${pinId}`, { method: 'DELETE' }),
  blockUser: (userId: string) =>
    request<Snapshot>(`/users/${userId}/block`, { method: 'POST' }),
  unblockUser: (userId: string) =>
    request<Snapshot>(`/users/${userId}/block`, { method: 'DELETE' }),
  reportUser: (userId: string, reason: string, pinId?: string) =>
    request<{ ok: boolean }>(`/users/${userId}/report`, {
      method: 'POST',
      body: { reason, pinId },
    }),
  spinChat: (chatId: string) =>
    request<Snapshot>(`/chats/${chatId}/spin`, { method: 'POST' }),
  checkin: (chatId: string, happened: boolean, loc: { lat: number; lng: number }) =>
    request<Snapshot>(`/chats/${chatId}/checkin`, {
      method: 'POST',
      body: { happened, ...loc },
    }),
  startSafeShare: (chatId: string, loc: { lat: number; lng: number }) =>
    request<{ shareUrl: string; snapshot: Snapshot }>(`/chats/${chatId}/safe-share`, {
      method: 'POST',
      body: loc,
    }),
  stopSafeShare: (chatId: string) =>
    request<Snapshot>(`/chats/${chatId}/safe-share`, { method: 'DELETE' }),
  pingSafeShare: (token: string, loc: { lat: number; lng: number }) =>
    request<{ ok: boolean }>(`/safe/${token}/ping`, {
      method: 'POST',
      body: loc,
    }),
};
