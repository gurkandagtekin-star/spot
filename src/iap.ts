/** Play Console / App Store product IDs — match these in RevenueCat. */
export const PRO_PRODUCT_IDS = {
  monthly: process.env.EXPO_PUBLIC_IAP_MONTHLY_ID || 'markdate_pro_monthly',
  yearly: process.env.EXPO_PUBLIC_IAP_YEARLY_ID || 'markdate_pro_yearly',
} as const;

export type ProPlanId = keyof typeof PRO_PRODUCT_IDS;

export const PRO_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_RC_ENTITLEMENT || 'pro';

export function rcApiKey() {
  const android = String(
    process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY || '',
  ).trim();
  const ios = String(process.env.EXPO_PUBLIC_RC_APPLE_API_KEY || '').trim();
  return { android, ios };
}

/** SDK configured when a platform public SDK key is present. */
export function iapConfigured() {
  const { android, ios } = rcApiKey();
  return Boolean(android || ios);
}

export const IAP_ENABLED = iapConfigured();
