import { Platform } from 'react-native';

const FILE = 'spot-profile-album.json';
let cache: Record<string, string[]> = {};

function durable(uri: string) {
  const value = String(uri || '').trim();
  if (!value || value.startsWith('data:') || value.startsWith('blob:')) return '';
  return value;
}

function unique(list: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  list.forEach((raw) => {
    const uri = durable(raw);
    if (!uri) return;
    const key = /^(file:|content:)/i.test(uri) ? uri : uri.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);
    out.push(uri);
  });
  return out.slice(0, 6);
}

export function albumFor(userId: string) {
  if (!userId) return [];
  return cache[userId] || [];
}

export function rememberAlbum(userId: string, photos: string[]) {
  if (!userId) return;
  cache[userId] = unique(photos);
  persist();
}

export async function loadAlbums() {
  try {
    let raw: string | null = null;
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      raw = localStorage.getItem(FILE);
    } else {
      const FileSystem = await import('expo-file-system/legacy');
      const path = `${FileSystem.documentDirectory || ''}${FILE}`;
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) raw = await FileSystem.readAsStringAsync(path);
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
    localStorage.setItem(FILE, raw);
    return;
  }
  void import('expo-file-system/legacy')
    .then((FileSystem) => {
      const path = `${FileSystem.documentDirectory || ''}${FILE}`;
      return FileSystem.writeAsStringAsync(path, raw);
    })
    .catch(() => {});
}

export async function stashAlbumPhoto(userId: string, sourceUri: string) {
  const src = String(sourceUri || '').trim();
  if (!userId || !src) return src;
  if (Platform.OS === 'web' || src.startsWith('http')) {
    rememberAlbum(userId, [src, ...albumFor(userId)]);
    return src;
  }
  try {
    const FileSystem = await import('expo-file-system/legacy');
    const dir = `${FileSystem.documentDirectory || ''}profile-album/${userId}/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    await FileSystem.copyAsync({ from: src, to: dest });
    rememberAlbum(userId, [dest, ...albumFor(userId)]);
    return dest;
  } catch {
    rememberAlbum(userId, [src, ...albumFor(userId)]);
    return src;
  }
}
