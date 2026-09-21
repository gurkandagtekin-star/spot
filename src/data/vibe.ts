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
  return VIBE_TAGS.find((t) => t.id === id)?.label || id;
}
