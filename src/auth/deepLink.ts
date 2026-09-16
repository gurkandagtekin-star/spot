import * as Linking from 'expo-linking';
import { parseSpotToken } from './parseToken';

export type AppLink =
  | { kind: 'auth'; token: string }
  | { kind: 'chat'; chatId: string }
  | { kind: 'tab'; tab: 'map' | 'chats' | 'profile' }
  | { kind: 'none' };

export function parseAppLink(url: string): AppLink {
  const token = parseSpotToken(url);
  if (token) return { kind: 'auth', token };
  let parsed: ReturnType<typeof Linking.parse>;
  try {
    parsed = Linking.parse(url);
  } catch {
    return { kind: 'none' };
  }
  const host = String(parsed.hostname || '').toLowerCase();
  const pathParts = String(parsed.path || '')
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean);
  const segs =
    host === 'chat' ||
    host === 'chats' ||
    host === 'map' ||
    host === 'profile' ||
    host === 'oauth'
      ? [host, ...pathParts]
      : pathParts;
  if (segs[0] === 'chat' && segs[1]) return { kind: 'chat', chatId: segs[1] };
  if (segs[0] === 'chats') return { kind: 'tab', tab: 'chats' };
  if (segs[0] === 'profile') return { kind: 'tab', tab: 'profile' };
  if (segs[0] === 'map') return { kind: 'tab', tab: 'map' };
  return { kind: 'none' };
}
