import { Platform } from 'react-native';
import Constants from 'expo-constants';

function extra(name: string) {
  const bag = (Constants.expoConfig?.extra || {}) as Record<string, unknown>;
  return String(bag[name] || '').trim();
}

function env(name: string) {
  return String(process.env[name] || extra(name) || '').trim();
}

/** Play Console / App Store product IDs — must match RevenueCat products. */
export const PRO_PRODUCT_IDS = {
  monthly: env('EXPO_PUBLIC_IAP_MONTHLY_ID') || extra('iapMonthlyId') || 'markdate_pro_monthly',
  yearly: env('EXPO_PUBLIC_IAP_YEARLY_ID') || extra('iapYearlyId') || 'markdate_pro_yearly',
} as const;

export type ProPlanId = keyof typeof PRO_PRODUCT_IDS;

export const PRO_ENTITLEMENT_ID =
  env('EXPO_PUBLIC_RC_ENTITLEMENT') || extra('rcEntitlement') || 'pro';

export function rcApiKey() {
  return {
    android: env('EXPO_PUBLIC_RC_GOOGLE_API_KEY') || extra('rcGoogleApiKey'),
    ios: env('EXPO_PUBLIC_RC_APPLE_API_KEY') || extra('rcAppleApiKey'),
  };
}

export function rcPublicKeyForOs(os = Platform.OS) {
  const { android, ios } = rcApiKey();
  if (os === 'ios') return ios;
  if (os === 'android') return android;
  return '';
}

/** RC Test Store keys (`test_…`) crash Play/release builds. Need `goog_` / `appl_`. */
export function rcKeySafeForThisBuild(key = rcPublicKeyForOs()) {
  if (!key) return false;
  if (!key.startsWith('test_')) return true;
  return Boolean(typeof __DEV__ !== 'undefined' && __DEV__);
}

/** Native store billing. Web, missing SDK key, and test keys on release stay off. */
export function iapEnabledOnThisDevice() {
  if (Platform.OS === 'web') return false;
  return rcKeySafeForThisBuild();
}

export const IAP_ENABLED = iapEnabledOnThisDevice();
