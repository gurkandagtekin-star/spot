/** Real AdMob unit IDs via EAS env. Empty = ads off (no fake interstitials). */
export function adsConfigured() {
  const app = String(process.env.EXPO_PUBLIC_ADMOB_APP_ID || '').trim();
  const rewarded = String(process.env.EXPO_PUBLIC_ADMOB_REWARDED_ID || '').trim();
  const banner = String(process.env.EXPO_PUBLIC_ADMOB_BANNER_ID || '').trim();
  return Boolean(app && (rewarded || banner));
}

export const ADS_ENABLED = adsConfigured();
