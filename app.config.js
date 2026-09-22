/** Production AAB: HTTPS only. Local Metro / LAN API still needs HTTP. */
const GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
  '41366568333-tvtr9ptfs6irpdkhntnsbnlgug61eo3d.apps.googleusercontent.com';

module.exports = ({ config }) => {
  const production = String(process.env.EAS_BUILD_PROFILE || '') === 'production';
  return {
    ...config,
    extra: {
      ...(config.extra || {}),
      googleWebClientId: GOOGLE_WEB_CLIENT_ID,
      rcGoogleApiKey: process.env.EXPO_PUBLIC_RC_GOOGLE_API_KEY || '',
      rcAppleApiKey: process.env.EXPO_PUBLIC_RC_APPLE_API_KEY || '',
      rcEntitlement: process.env.EXPO_PUBLIC_RC_ENTITLEMENT || 'pro',
      iapMonthlyId: process.env.EXPO_PUBLIC_IAP_MONTHLY_ID || 'markdate_pro_monthly',
      iapYearlyId: process.env.EXPO_PUBLIC_IAP_YEARLY_ID || 'markdate_pro_yearly',
    },
    android: {
      ...(config.android || {}),
      usesCleartextTraffic: production ? false : true,
    },
  };
};
