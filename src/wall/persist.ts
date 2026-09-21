import { Platform } from 'react-native';
import type { WallPost } from '../types';

const KEY = 'spot_wall_posts';

let cache: Record<string, WallPost[]> = {};

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadWallPosts() {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(KEY);
    } else {
      const store = await nativeStore();
      raw = await store.getItemAsync(KEY);
    }
    cache = raw ? (JSON.parse(raw) as Record<string, WallPost[]>) : {};
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

export function postsFor(userId: string) {
  return cache[userId] || [];
}

export function dropSyncedWallPosts(userId: string, server?: WallPost[]) {
  if (!userId) return [];
  const ids = new Set((server || []).map((p) => p.id).filter(Boolean));
  const texts = new Set(
    (server || []).map((p) => String(p.text || '').trim()).filter(Boolean),
  );
  const prev = cache[userId] || [];
  const next = prev.filter((p) => {
    if (!p?.id) return false;
    if (ids.has(p.id)) return true;
    if (texts.has(String(p.text || '').trim())) return false;
    return true;
  });
  if (next.length !== prev.length) {
    cache[userId] = next;
    persist();
  }
  return next;
}

export function unsyncedWallNotes(userId: string, server?: WallPost[]) {
  dropSyncedWallPosts(userId, server);
  const onServer = new Set((server || []).map((p) => p.id).filter(Boolean));
  const texts = new Set(
    (server || []).map((p) => String(p.text || '').trim()).filter(Boolean),
  );
  const owners =
    typeof __DEV__ !== 'undefined' && __DEV__ ? Object.keys(cache) : [userId];
  const out: WallPost[] = [];
  const seen = new Set<string>();
  owners.forEach((owner) => {
    (cache[owner] || []).forEach((p) => {
      if (!p?.id || onServer.has(p.id)) return;
      const text = String(p.text || '').trim();
      if (text.length < 2 || texts.has(text) || seen.has(text)) return;
      seen.add(text);
      out.push(p);
    });
  });
  return out;
}

export function mergeWallPosts(server?: WallPost[], local?: WallPost[]) {
  const loc = new Map((local || []).filter((p) => p?.id).map((p) => [p.id, p]));
  const byId = new Map<string, WallPost>();
  (server || []).forEach((p) => {
    if (!p?.id) return;
    const extra = loc.get(p.id);
    byId.set(p.id, extra
      ? {
          ...p,
          ...extra,
          text: p.text || extra.text,
          likeCount: Math.max(Number(p.likeCount) || 0, Number(extra.likeCount) || 0),
          liked: Boolean(extra.liked || p.liked),
        }
      : p);
  });
  (local || []).forEach((p) => {
    if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
  });
  return [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export function rememberWallPost(userId: string, post: WallPost) {
  if (!userId || !post?.id) return;
  const prev = cache[userId] || [];
  const i = prev.findIndex((p) => p.id === post.id);
  if (i >= 0) {
    const next = [...prev];
    next[i] = { ...prev[i], ...post };
    cache[userId] = next;
  } else {
    cache[userId] = [post, ...prev];
  }
  persist();
}

export function forgetWallPost(userId: string, postId: string) {
  if (!postId) return;
  let changed = false;
  Object.keys(cache).forEach((owner) => {
    if (userId && owner !== userId) {
      if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    }
    const next = (cache[owner] || []).filter((p) => p.id !== postId);
    if (next.length !== (cache[owner] || []).length) {
      cache[owner] = next;
      changed = true;
    }
  });
  if (changed) persist();
}
