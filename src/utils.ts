import type { Pin } from './types';

export const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
export const FREE_DAILY_PINS = 2;
export const ME_ID = 'me';

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
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
  if (ms <= 0) return 'süre doldu';
  const mins = Math.ceil(ms / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h} sa ${m} dk`;
  }
  return `${mins} dk`;
}

export function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function pinsLeftToday(pins: Pin[], authorId: string, now = Date.now()) {
  const start = startOfDay(now);
  const used = pins.filter(
    (p) => p.authorId === authorId && p.createdAt >= start,
  ).length;
  return Math.max(0, FREE_DAILY_PINS - used);
}

export function formatAgo(ts: number, now = Date.now()) {
  const mins = Math.max(0, Math.round((now - ts) / 60000));
  if (mins < 1) return 'şimdi';
  if (mins < 60) return `${mins} dk`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa`;
  return `${Math.floor(hours / 24)} gün`;
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
  return pins.filter((pin) => pinMatchesRange(pin, origin, meId, range, myArea));
}

export function livePins(pins: Pin[], now = Date.now()) {
  return pins.filter((p) => p.expiresAt > now);
}

export function formatMeetAt(ts: number, now = Date.now()) {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = startOfDay(ts);
  const today = startOfDay(now);
  if (day === today) return `bugün ${time}`;
  if (day === today + 86400000) return `yarın ${time}`;
  const date = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
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

export function instagramUrl(handle: string) {
  const clean = handle.replace(/^@/, '');
  return `https://instagram.com/${clean}`;
}

export function normalizeHandle(raw: string) {
  const h = String(raw || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();
  if (!h) return '';
  if (!/^[a-z0-9._]{1,30}$/.test(h)) return null;
  return h;
}
