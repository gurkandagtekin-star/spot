import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { ChatThread, FollowListUser, JoinRequest, Pin, Profile, WallPost } from './types';
import { mergeWallPosts } from './wall/persist';
import { readWallFromBio, withWallInBio } from './wall/bio';
import { acceptLanguage, localError } from './i18n/errors';

function lanHost() {
  const uri = String(
    Constants.expoConfig?.hostUri ||
      Constants.expoGoConfig?.debuggerHost ||
      Constants.linkingUri ||
      '',
  );
  const host = uri
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')[0]
    .split(':')[0]
    .trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') return '';
  if (/\.exp\.direct$/i.test(host)) return '';
  if (/\.expo\.dev$/i.test(host)) return '';
  if (/\.ngrok/i.test(host)) return '';
  return host;
}

const LAN_IP = '192.168.1.104';

function withLanOrigin(origin: string) {
  const raw = String(origin || 'http://127.0.0.1:3001').replace(/\/$/, '');
  if (Platform.OS === 'web') return raw;
  try {
    const u = new URL(raw);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      const host = lanHost() || LAN_IP;
      u.hostname = host;
      return u.toString().replace(/\/$/, '');
    }
  } catch {
    /* keep */
  }
  return raw;
}

function devApiOrigin() {
  if (Platform.OS === 'web') return 'http://127.0.0.1:3001';
  const host = lanHost() || LAN_IP;
  return `http://${host}:3001`;
}

export function getApiUrl() {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    return devApiOrigin();
  }
  return withLanOrigin(
    String(process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:3001').replace(
      /\/$/,
      '',
    ),
  );
}

export function getFormattedImageUrl(url?: string | null) {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (
    raw.startsWith('data:') ||
    raw.startsWith('file:') ||
    raw.startsWith('content:') ||
    raw.startsWith('blob:')
  ) {
    return raw;
  }
  const origin = getApiUrl();
  if (raw.startsWith('/')) return `${origin}${raw}`;
  try {
    const u = new URL(raw);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      const api = new URL(origin);
      u.protocol = api.protocol;
      u.host = api.host;
      return u.toString();
    }
  } catch {
    /* keep */
  }
  return raw;
}

export function mediaUrl(url?: string | null) {
  return getFormattedImageUrl(url) || '';
}

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
    res = await fetch(`${getApiUrl()}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': acceptLanguage(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(localError('Sunucuya bağlanılamadı. İnternetini kontrol et.'), 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new ApiError(data.error || localError('Sunucu hatası.'), res.status);
  }
  return data;
}

export const api = {
  providers: () =>
    request<{ google: boolean; googleClientId?: string; instagram?: boolean }>(
      '/auth/providers',
      {
        token: null,
      },
    ),
  googleNative: (body: {
    idToken?: string;
    code?: string;
    redirectUri?: string;
    codeVerifier?: string;
  }) =>
    request<{ token: string }>('/auth/google', {
      method: 'POST',
      body,
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
  claimAdMark: () =>
    request<Snapshot>('/me/ad-mark', { method: 'POST' }),
  patchMe: (
    patch: Partial<
      Pick<
        Profile,
        'name' | 'bio' | 'username' | 'firstName' | 'lastName' | 'age' | 'birthDate' | 'gender' | 'interests'
      > & { onboarded?: boolean }
    >,
  ) => request<Snapshot>('/me', { method: 'PATCH', body: patch }),
  searchUsers: (q: string) =>
    request<{
      users?: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl?: string;
        profileImage?: string;
      }[];
    }>(`/api/users/search?q=${encodeURIComponent(q)}`),
  dropPin: (body: {
    text: string;
    kind: Pin['kind'];
    lat: number;
    lng: number;
    meetAt: number;
    placeName?: string;
    featured?: boolean;
    photoUrl?: string;
    capacity?: 2 | 3 | 4;
    anonymous?: boolean;
  }) => request<Snapshot>('/pins', { method: 'POST', body }),
  activatePro: (plan: 'monthly' | 'yearly') =>
    request<Snapshot>('/me/pro', { method: 'POST', body: { plan } }),
  syncStorePro: (body: {
    plan?: 'monthly' | 'yearly';
    productId?: string;
    expiresAt?: number;
  }) => request<Snapshot>('/me/pro/sync', { method: 'POST', body }),
  lookupPlace: (lat: number, lng: number) =>
    request<{ placeName: string; area?: string }>(`/geo/reverse?lat=${lat}&lng=${lng}`),
  joinPin: (pinId: string, body?: { fromId?: string; toId?: string }) =>
    request<Snapshot & { chatId?: string; already?: boolean }>(
      `/pins/${pinId}/join`,
      { method: 'POST', body: body || {} },
    ),
  decide: (requestId: string, accept: boolean) =>
    request<{ chatId: string | null; filled?: boolean; snapshot: Snapshot }>(
      `/requests/${requestId}/decide`,
      { method: 'POST', body: { accept } },
    ),
  withdrawRequest: (requestId: string) =>
    request<Snapshot>(`/requests/${requestId}`, { method: 'DELETE' }),
  hideChat: (chatId: string) =>
    request<Snapshot>(`/chats/${chatId}`, { method: 'DELETE' }),
  sendMessage: (chatId: string, text: string, dataUrl?: string) =>
    request<Snapshot>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: dataUrl ? { text: dataUrl } : { text },
    }),
  uploadPhoto: (dataUrl: string) =>
    request<Snapshot>('/me/photo', { method: 'POST', body: { dataUrl } }),
  uploadPhotos: (dataUrls: string[]) =>
    request<Snapshot>('/me/photos', { method: 'POST', body: { dataUrls } }),
  removePhoto: (url: string) =>
    request<Snapshot>('/me/photos', { method: 'DELETE', body: { url } }),
  closePin: (pinId: string) =>
    request<Snapshot>(`/pins/${pinId}`, { method: 'DELETE' }),
  blockUser: (userId: string) =>
    request<Snapshot>(`/users/${userId}/block`, { method: 'POST' }),
  unblockUser: (userId: string) =>
    request<Snapshot>(`/users/${userId}/block`, { method: 'DELETE' }),
  followUser: (userId: string) =>
    request<Snapshot>(`/users/${userId}/follow`, { method: 'POST' }),
  unfollowUser: (userId: string) =>
    request<Snapshot>(`/users/${userId}/follow`, { method: 'DELETE' }),
  listFollowers: (userId: string) =>
    request<{ users?: FollowListUser[] }>(`/users/${userId}/followers`),
  listFollowing: (userId: string) =>
    request<{ users?: FollowListUser[] }>(`/users/${userId}/following`),
  startHello: (userId: string) =>
    request<{
      chatId?: string | null;
      pending?: boolean;
      already?: boolean;
      snapshot: Snapshot;
    }>(
      `/users/${userId}/hello`,
      {
        method: 'POST',
      },
    ),
  postWallNote: async (targetUserId: string, text: string, authorId?: string) => {
    const body = {
      authorId: authorId || targetUserId,
      targetUserId,
      text,
    };
    try {
      return await request<{ posts?: WallPost[] } & Snapshot>(`/api/wall`, {
        method: 'POST',
        body,
      });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status !== 404 && status !== 0) throw err;
      try {
        return await request<Snapshot>(`/users/${targetUserId}/wall-posts`, {
          method: 'POST',
          body: { text },
        });
      } catch (retry) {
        const retryStatus = retry instanceof ApiError ? retry.status : 0;
        if (retryStatus !== 404 && retryStatus !== 0) throw retry;
        const snap = await request<Snapshot>('/snapshot');
        const me = snap.me;
        if (!me?.id || me.id !== targetUserId) throw retry;
        const post: WallPost = {
          id: `post_${Date.now().toString(36)}`,
          fromId: me.id,
          fromName: String(me.firstName || me.name || 'Biri').trim() || 'Biri',
          fromPhoto: me.photoUrl || '',
          text: String(text || '').trim().slice(0, 280),
          createdAt: Date.now(),
          likeCount: 0,
        };
        const posts = mergeWallPosts(readWallFromBio(me.bio), [
          post,
          ...(me.wallPosts || []),
        ]).slice(0, 24);
        const next = await request<Snapshot>('/me', {
          method: 'PATCH',
          body: { bio: withWallInBio(me.bio || '', posts) },
        });
        if (next.me) next.me.wallPosts = posts;
        next.profiles = (next.profiles || []).map((p) =>
          p.id === me.id ? { ...p, wallPosts: posts } : p,
        );
        return { ...next, posts };
      }
    }
  },
  listWallPosts: async (userId: string) => {
    let server: WallPost[] = [];
    let bio = '';
    try {
      const data = await request<{ posts?: WallPost[] }>(`/api/wall/${userId}`);
      if (Array.isArray(data.posts)) server = data.posts;
    } catch {
      /* eski sunucu */
    }
    try {
      const snap = await request<Snapshot>('/snapshot');
      const person =
        snap.me?.id === userId
          ? snap.me
          : (snap.profiles || []).find((p) => p.id === userId);
      if (!server.length) server = person?.wallPosts || [];
      bio = person?.bio || '';
    } catch {
      /* snapshot yoksa bio yok */
    }
    return mergeWallPosts(server, readWallFromBio(bio));
  },
  deleteWallNote: async (userId: string, postId: string) => {
    try {
      return await request<Snapshot>(`/users/${userId}/wall-posts/${postId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      if (status !== 404 && status !== 0) throw err;
      try {
        return await request<Snapshot>(`/api/wall/${userId}/${postId}`, {
          method: 'DELETE',
        });
      } catch (retry) {
        const retryStatus = retry instanceof ApiError ? retry.status : 0;
        if (retryStatus !== 404 && retryStatus !== 0) throw retry;
        const snap = await request<Snapshot>('/snapshot');
        const me = snap.me;
        if (!me?.id || me.id !== userId) throw retry;
        const posts = mergeWallPosts(me.wallPosts, readWallFromBio(me.bio)).filter(
          (p) => p.id !== postId,
        );
        const next = await request<Snapshot>('/me', {
          method: 'PATCH',
          body: { bio: withWallInBio(me.bio || '', posts) },
        });
        if (next.me) next.me.wallPosts = posts;
        next.profiles = (next.profiles || []).map((p) =>
          p.id === me.id ? { ...p, wallPosts: posts } : p,
        );
        return next;
      }
    }
  },
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
