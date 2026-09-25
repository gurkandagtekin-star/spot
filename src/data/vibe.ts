import i18n from '../i18n/i18n';

export const VIBE_TAGS: { id: string; label: string }[] = [
  { id: 'kahve', label: '☕ Kahve' },
  { id: 'ps', label: '🎮 PS5' },
  { id: 'gece', label: '🚗 Gece sürüşü' },
  { id: 'yuruyus', label: '🚶 Yürüyüş' },
  { id: 'okey', label: '🀄 Okey' },
  { id: 'muzik', label: '🎵 Müzik' },
  { id: 'sohbet', label: '💬 Sohbet' },
  { id: 'spor', label: '⚽ Sahaya' },
];

export const CUSTOM_VIBE_PREFIX = 'c:';
export const CUSTOM_VIBE_MAX = 20;
export const VIBE_MAX_TAGS = 8;

export function isCustomVibe(id: string) {
  return String(id || '').startsWith(CUSTOM_VIBE_PREFIX);
}

export function encodeCustomVibe(raw: string) {
  const text = String(raw || '')
    .replace(/[\r\n\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CUSTOM_VIBE_MAX);
  return text ? `${CUSTOM_VIBE_PREFIX}${text}` : '';
}

export function vibeLabel(id: string) {
  if (isCustomVibe(id)) return id.slice(CUSTOM_VIBE_PREFIX.length);
  const key = `vibe.${id}`;
  const translated = i18n.t(key);
  if (translated && translated !== key) return translated;
  return VIBE_TAGS.find((t) => t.id === id)?.label || id;
}
