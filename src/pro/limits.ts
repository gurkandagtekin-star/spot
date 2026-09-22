export const FREE_DAILY_PINS = 2;
export const PRO_DAILY_PINS = 12;
export const FREE_AD_MARKS = 2;
export const FREE_PIN_MS = 2 * 60 * 60 * 1000;
export const PRO_PIN_MS = 16 * 60 * 60 * 1000;
export const PRO_CHAT_MS = 24 * 60 * 60 * 1000;

export function isProRange(range: string) {
  return range === 'all';
}

export function dailyPinLimit(isPro: boolean, adMarksToday = 0) {
  if (isPro) return PRO_DAILY_PINS;
  return FREE_DAILY_PINS + Math.min(FREE_AD_MARKS, Math.max(0, adMarksToday));
}

export function adMarksLeft(isPro: boolean, adMarksToday = 0) {
  if (isPro) return 0;
  return Math.max(0, FREE_AD_MARKS - Math.max(0, adMarksToday));
}
