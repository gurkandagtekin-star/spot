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

export function vibeLabel(id: string) {
  const key = `vibe.${id}`;
  const translated = i18n.t(key);
  if (translated && translated !== key) return translated;
  return VIBE_TAGS.find((t) => t.id === id)?.label || id;
}
