import type { ChatThread, Gender, JoinRequest, Pin, PinKind } from './types';
import { FREE_DAILY_PINS } from './pro/limits';
import i18n from './i18n/i18n';

export { FREE_DAILY_PINS } from './pro/limits';
export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
export const ME_ID = 'me';
export const PIN_PHOTO_MARK = '[[PIN_PHOTO]]';
export const PIN_COVERS_MARK = '[[PIN_COVERS]]';
export const WALL_POSTS_MARK = '[[WALL_POSTS]]';
export const PIN_SEATS_MARK = '[[SEATS]]';
export const PIN_ANON_MARK = '[[ANON]]';

const BIO_MARKS = [PIN_COVERS_MARK, WALL_POSTS_MARK];

export function visibleBio(bio: string) {
  const raw = String(bio || '');
  const cuts = BIO_MARKS.map((m) => raw.indexOf(m)).filter((i) => i >= 0);
  if (!cuts.length) return raw.trim();
  return raw.slice(0, Math.min(...cuts)).trim();
}

export function bioMarkPayload(bio: string, mark: string) {
  const raw = String(bio || '');
  const start = raw.indexOf(mark);
  if (start < 0) return '';
  let rest = raw.slice(start + mark.length);
  const next = BIO_MARKS.map((m) => rest.indexOf(m)).filter((i) => i >= 0);
  if (next.length) rest = rest.slice(0, Math.min(...next));
  return rest.trim();
}

export function pinCaption(text: string) {
  let raw = String(text || '');
  const photoAt = raw.indexOf(PIN_PHOTO_MARK);
  if (photoAt >= 0) raw = raw.slice(0, photoAt);
  return raw
    .replace(/\n?\[\[SEATS\]\](2|3|4)/g, '')
    .replace(/\n?\[\[ANON\]\]/g, '')
    .trim();
}

export function pinEmbeddedAnon(text: string) {
  return String(text || '').includes(PIN_ANON_MARK);
}

export function pinKindLabel(kind?: PinKind) {
  if (kind === 'activity') return i18n.t('kind.activity');
  if (kind === 'chat') return i18n.t('kind.chat');
  return i18n.t('kind.hangout');
}

export function withPinMeta(
  text: string,
  extra?: {
    photoDataUrl?: string;
    capacity?: 2 | 3 | 4;
    anonymous?: boolean;
  },
) {
  const photo = extra?.photoDataUrl || pinEmbeddedPhoto(text);
  let body = pinCaption(text);
  if (extra?.capacity) body += `\n${PIN_SEATS_MARK}${extra.capacity}`;
  if (extra?.anonymous) body += `\n${PIN_ANON_MARK}`;
  if (photo) body += `\n${PIN_PHOTO_MARK}${photo}`;
  return body;
}

export function pinEmbeddedSeats(text: string): 2 | 3 | 4 | undefined {
  const m = String(text || '').match(/\[\[SEATS\]\](2|3|4)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return n === 2 || n === 3 || n === 4 ? n : undefined;
}

export function withPinSeats(text: string, capacity?: 2 | 3 | 4) {
  return withPinMeta(text, { capacity });
}

export function pinFilledCount(pin: { coming?: number }) {
  return 1 + Math.max(0, pin.coming || 0);
}

export function pinQuotaLabel(pin: { coming?: number; capacity?: 2 | 3 | 4 }) {
  if (!pin.capacity) return i18n.t('quota.open');
  const filled = Math.min(pin.capacity, pinFilledCount(pin));
  const open = Math.max(0, pin.capacity - filled);
  if (open <= 0) return i18n.t('quota.full');
  if (open === 1) return i18n.t('quota.one');
  return i18n.t('quota.many', { count: open });
}

export function pinEmbeddedPhoto(text: string) {
  const raw = String(text || '');
  const i = raw.indexOf(PIN_PHOTO_MARK);
  if (i < 0) return '';
  return raw.slice(i + PIN_PHOTO_MARK.length).trim();
}

export function withPinPhoto(text: string, photoDataUrl?: string) {
  const caption = pinCaption(text);
  if (!photoDataUrl) return caption;
  return `${caption}\n${PIN_PHOTO_MARK}${photoDataUrl}`;
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function splitFullName(full: string) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' '),
  };
}

export function displayName(profile: {
  name?: string;
  firstName?: string;
  lastName?: string;
}) {
  const composed = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
  return composed || profile.name || '';
}

export const GENDER_OPTIONS: { id: Gender; labelKey: string }[] = [
  { id: 'woman', labelKey: 'gender.woman' },
  { id: 'man', labelKey: 'gender.man' },
  { id: 'other', labelKey: 'gender.other' },
  { id: 'unspecified', labelKey: 'gender.unspecified' },
];

export function genderLabel(gender?: Gender) {
  const opt = GENDER_OPTIONS.find((g) => g.id === gender);
  return opt ? i18n.t(opt.labelKey) : '';
}

export function toRad(n: number) {
  return (n * Math.PI) / 180;
}

export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function remainingLabel(expiresAt: number, now = Date.now()) {
  const ms = expiresAt - now;
  if (ms <= 0) return i18n.t('time.expired');
  const mins = Math.ceil(ms / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return i18n.t('time.hoursMins', { h, m });
  }
  return i18n.t('time.mins', { m: mins });
}

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function pinsLeftToday(
  pins: Pin[],
  authorId: string,
  now = Date.now(),
  limit = FREE_DAILY_PINS,
) {
  const start = startOfDay(now);
  const used = pins.filter(
    (p) => p.authorId === authorId && p.createdAt >= start,
  ).length;
  return Math.max(0, limit - used);
}

export function formatAgo(ts: number, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - ts) / 60000));
  if (mins < 1) return i18n.t('time.now');
  if (mins < 60) return i18n.t('time.mins', { m: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return i18n.t('time.hours', { h: hours });
  return i18n.t('time.days', { d: Math.floor(hours / 24) });
}

export type PinRange = '1' | '3' | '5' | '15' | 'area' | 'all';

export const PIN_RANGE_OPTIONS: { id: PinRange; label: string }[] = [
  { id: '1', label: '1 km' },
  { id: '3', label: '3 km' },
  { id: '5', label: '5 km' },
  { id: '15', label: '15 km' },
  { id: 'area', label: 'Semt' },
  { id: 'all', label: 'Tümü' },
];

const RANGE_METERS: Record<Exclude<PinRange, 'area' | 'all'>, number> = {
  '1': 1000,
  '3': 3000,
  '5': 5000,
  '15': 15000,
};

function normArea(raw: string) {
  return String(raw || '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

export function pinMatchesRange(
  pin: Pin,
  origin: { lat: number; lng: number },
  meId: string,
  range: PinRange,
  myArea: string,
) {
  if (pin.authorId === meId) return true;
  if (range === 'all') return true;
  const meters = distanceMeters(origin, pin);
  if (range === 'area') {
    const area = normArea(myArea);
    if (area) {
      const hay = `${pin.area || ''} ${pin.placeName || ''}`.toLocaleLowerCase('tr-TR');
      if (hay.includes(area)) return true;
    }
    return meters <= 2500;
  }
  return meters <= RANGE_METERS[range];
}

export function filterPinsByRange(
  pins: Pin[],
  origin: { lat: number; lng: number },
  meId: string,
  range: PinRange,
  myArea: string,
) {
  return (pins || []).filter((pin) => pinMatchesRange(pin, origin, meId, range, myArea));
}

export function livePins(pins: Pin[] | undefined, now = Date.now()) {
  return (pins || []).filter((p) => p.expiresAt > now && !p.retiredAt);
}

export function formatMeetAt(ts: number, now = Date.now()) {
  const loc = String(i18n.language || '').startsWith('tr') ? 'tr-TR' : 'en-US';
  const d = new Date(ts);
  const time = d.toLocaleTimeString(loc, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = startOfDay(ts);
  const today = startOfDay(now);
  if (day === today) return `${i18n.t('time.today')} ${time}`;
  if (day === today + 86400000) return `${i18n.t('time.tomorrow')} ${time}`;
  const date = d.toLocaleDateString(loc, { day: 'numeric', month: 'short' });
  return `${date} ${time}`;
}

export function tonightAt(hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() < Date.now() - 2 * 60000) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

export function usernameOf(person?: { username?: string; instagram?: string } | null) {
  return String(person?.username || person?.instagram || '')
    .replace(/^@/, '')
    .trim();
}

export function atHandle(person?: { username?: string; instagram?: string } | null) {
  const h = usernameOf(person);
  return h ? `@${h}` : '';
}

export function normalizeHandle(raw: string) {
  const h = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!h) return '';
  if (!/^[a-z0-9._]{2,30}$/.test(h)) return null;
  return h;
}

export function liveChatWith(
  chats: ChatThread[] | undefined,
  meId: string,
  otherId: string,
) {
  if (!meId || !otherId || meId === otherId) return undefined;
  const t = Date.now();
  const open = (chats || []).filter(
    (c) =>
      (c.memberIds || []).includes(meId) &&
      (c.memberIds || []).includes(otherId) &&
      (!c.closesAt || c.closesAt > t),
  );
  return open.find((c) => (c.memberIds || []).length === 2) || open[0];
}

export function pendingPairRequest(
  requests: JoinRequest[] | undefined,
  pins: { id: string; authorId: string }[] | undefined,
  meId: string,
  otherId: string,
) {
  if (!meId || !otherId || meId === otherId) return undefined;
  return (requests || []).find((r) => {
    if (r.status !== 'pending') return false;
    if (r.pinId === 'hello') {
      return (
        (r.fromId === meId && r.toId === otherId) ||
        (r.fromId === otherId && r.toId === meId)
      );
    }
    const host = String(r.toId || '').trim() || (pins || []).find((p) => p.id === r.pinId)?.authorId;
    if (!host) return false;
    return (r.fromId === meId && host === otherId) || (r.fromId === otherId && host === meId);
  });
}
