import { Platform } from 'react-native';
import type { Gender, Profile } from '../types';
import { displayName } from '../utils';

const KEY = 'spot_profile_overlay';

export type ProfileOverlay = {
  firstName?: string;
  lastName?: string;
  age?: number;
  birthDate?: string;
  gender?: Gender;
  bio?: string;
  vibeNote?: string;
  name?: string;
  photos?: string[];
};

let cache: Record<string, ProfileOverlay> = {};

async function nativeStore() {
  return import('expo-secure-store');
}

export async function loadProfileOverlays() {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(KEY);
    } else {
      const store = await nativeStore();
      raw = await store.getItemAsync(KEY);
    }
    cache = raw ? (JSON.parse(raw) as Record<string, ProfileOverlay>) : {};
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

export function overlayFor(userId: string) {
  return cache[userId];
}

export function rememberOverlay(userId: string, patch: ProfileOverlay) {
  if (!userId) return;
  const next: ProfileOverlay = { ...cache[userId] };
  (Object.keys(patch) as (keyof ProfileOverlay)[]).forEach((key) => {
    const val = patch[key];
    if (val === undefined) return;
    (next as Record<string, unknown>)[key] = val;
  });
  cache[userId] = next;
  persist();
}

export function shapeProfile(server: Profile): Profile {
  const username = String(
    server.username || (server as { instagram?: string }).instagram || '',
  )
    .replace(/^@/, '')
    .trim();
  const name = displayName(server) || server.displayName || server.name;
  return {
    ...server,
    username,
    name,
    photoUrl: server.photoUrl || server.avatarUrl || '',
    photos: mergePhotoList(server.photos, server.photoUrl || server.avatarUrl),
  };
}

function mergePhotoList(...groups: (string[] | string | undefined)[]) {
  const list: string[] = [];
  const seen = new Set<string>();
  const add = (raw?: string) => {
    const uri = String(raw || '').trim();
    if (!uri || uri.startsWith('data:') || uri.startsWith('blob:')) return;
    const key = uri.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);
    list.push(uri);
  };
  for (const group of groups) {
    if (Array.isArray(group)) group.forEach(add);
    else add(group);
  }
  return list.slice(0, 6);
}

export function mergeProfile(server: Profile, overlay?: ProfileOverlay): Profile {
  const extra = overlay || cache[server.id];
  if (!extra) {
    return shapeProfile({
      ...server,
      name: displayName(server) || server.name,
    });
  }
  const firstName = server.firstName || extra.firstName || '';
  const lastName = server.lastName || extra.lastName || '';
  const birthDate = server.birthDate || extra.birthDate;
  const age = server.age || extra.age;
  const gender = server.gender || extra.gender;
  const username = String(
    server.username || (server as { instagram?: string }).instagram || '',
  ).replace(/^@/, '');
  const bio = extra.bio || server.bio;
  const name =
    displayName({ firstName, lastName, name: extra.name || server.name }) ||
    server.name;
  const vibeNote =
    extra.vibeNote !== undefined ? extra.vibeNote : server.vibeNote;
  return {
    ...server,
    firstName,
    lastName,
    age,
    birthDate,
    gender,
    username,
    bio,
    vibeNote,
    name,
    photoUrl: server.photoUrl || server.avatarUrl || '',
    photos: mergePhotoList(
      server.photos,
      extra.photos,
      server.photoUrl || server.avatarUrl,
    ),
  };
}

export function patchToOverlay(
  patch: Partial<Profile> & { onboarded?: boolean },
): ProfileOverlay {
  const next: ProfileOverlay = {};
  if (typeof patch.firstName === 'string') next.firstName = patch.firstName;
  if (typeof patch.lastName === 'string') next.lastName = patch.lastName;
  if (typeof patch.age === 'number' && Number.isFinite(patch.age)) next.age = patch.age;
  if (typeof patch.birthDate === 'string' && patch.birthDate) next.birthDate = patch.birthDate;
  if (patch.gender) next.gender = patch.gender;
  if (typeof patch.bio === 'string') next.bio = patch.bio;
  if (typeof patch.name === 'string') next.name = patch.name;
  if (typeof patch.vibeNote === 'string') next.vibeNote = patch.vibeNote;
  if (Array.isArray(patch.photos)) next.photos = patch.photos.filter(Boolean).slice(0, 6);
  return next;
}
