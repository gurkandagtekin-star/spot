import { Platform } from 'react-native';
import {
  PIN_COVERS_MARK,
  WALL_POSTS_MARK,
  bioMarkPayload,
  visibleBio,
} from '../utils';

export { visibleBio };

export function readPinCovers(bio: string): Record<string, string> {
  const raw = bioMarkPayload(bio, PIN_COVERS_MARK);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

export function withPinCovers(bio: string, covers: Record<string, string>) {
  const visible = visibleBio(bio);
  const next: Record<string, string> = {};
  Object.entries(covers).forEach(([id, url]) => {
    if (id && url) next[id] = url;
  });
  let out = visible;
  if (Object.keys(next).length) {
    out += `\n${PIN_COVERS_MARK}${JSON.stringify(next)}`;
  }
  const wall = bioMarkPayload(bio, WALL_POSTS_MARK);
  if (wall) out += `\n${WALL_POSTS_MARK}${wall}`;
  return out;
}

const FILE = 'spot-pin-covers.json';

export async function loadLocalPinCovers(): Promise<Record<string, string>> {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(FILE);
      return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    }
    const FileSystem = await import('expo-file-system/legacy');
    const path = `${FileSystem.documentDirectory || ''}${FILE}`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(path);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function saveLocalPinCovers(covers: Record<string, string>) {
  const raw = JSON.stringify(covers);
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
