import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { api, getApiUrl } from '../api';
import { failCatch, localError } from '../i18n/errors';

WebBrowser.maybeCompleteAuthSession();

export type OAuthResult =
  | { token: string }
  | { cancelled: true }
  | { error: string };

const APP_SCHEME = 'markdate';

function readGoogleWebClientId() {
  const fromEnv = String(
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
      process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
      '',
  ).trim();
  if (fromEnv) return fromEnv;
  const extra = Constants.expoConfig?.extra as
    | { googleWebClientId?: string }
    | undefined;
  return String(extra?.googleWebClientId || '').trim();
}

const WEB_CLIENT_ID = readGoogleWebClientId();

let nativeConfigured = false;

export function googleClientId() {
  return WEB_CLIENT_ID;
}

export function isExpoGo() {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
}

function expoProxyRedirectUri() {
  const owner = Constants.expoConfig?.owner || 'rakbenadam';
  const slug = Constants.expoConfig?.slug || 'mark-date';
  return `https://auth.expo.io/@${owner}/${slug}`;
}

function appReturnUri() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.origin;
  }
  return AuthSession.makeRedirectUri({
    scheme: APP_SCHEME,
    path: 'oauth',
  });
}

async function startWebGoogleSignIn(): Promise<OAuthResult | void> {
  if (!WEB_CLIENT_ID) return { error: localError('Google ayarlı değil.') };
  if (typeof window === 'undefined') return { error: localError('Google penceresi açılamadı.') };
  const url = `${getApiUrl()}/auth/google/start?redirect=${encodeURIComponent(
    window.location.origin,
  )}`;
  const popup = window.open(url, 'spot-auth', 'width=420,height=680');
  if (!popup) window.location.assign(url);
}

async function startBrowserGoogleSignIn(): Promise<OAuthResult> {
  if (!WEB_CLIENT_ID) return { error: localError('Google ayarlı değil.') };
  const proxy = expoProxyRedirectUri();
  const returnUrl = appReturnUri();
  const request = new AuthSession.AuthRequest({
    clientId: WEB_CLIENT_ID,
    redirectUri: proxy,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'profile', 'email'],
    usePKCE: true,
    extraParams: { prompt: 'select_account' },
  });
  const authUrl = await request.makeAuthUrlAsync({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  });
  const startUrl = `${proxy}/start?${new URLSearchParams({
    authUrl,
    returnUrl,
  }).toString()}`;

  try {
    const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
    if (result.type !== 'success' || !result.url) {
      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { cancelled: true };
      }
      return { error: localError('Giriş tamamlanamadı.') };
    }
    const parsed = request.parseReturnUrl(result.url);
    const idToken =
      parsed.type === 'success' ? String(parsed.params.id_token || '').trim() : '';
    const code =
      parsed.type === 'success' ? String(parsed.params.code || '').trim() : '';
    if (!idToken && !code) {
      return { error: localError('Giriş tamamlandı ama oturum anahtarı gelmedi.') };
    }
    const { token } = await api.googleNative({
      idToken: idToken || undefined,
      code: code || undefined,
      redirectUri: proxy,
      codeVerifier: request.codeVerifier,
    });
    return { token };
  } catch (err) {
    return {
      error: failCatch(err, 'Google penceresi açılamadı.'),
    };
  }
}

function missingNativeModule(err: unknown) {
  const message = String(err instanceof Error ? err.message : err);
  return /RNGoogleSignin|native module|Expo Go/i.test(message);
}

async function startNativeGoogleSignIn(): Promise<OAuthResult> {
  if (!WEB_CLIENT_ID) return { error: localError('Google ayarlı değil.') };
  const {
    GoogleSignin,
    isErrorWithCode,
    isSuccessResponse,
    statusCodes,
  } = await import('@react-native-google-signin/google-signin');

  if (!nativeConfigured) {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: false,
    });
    nativeConfigured = true;
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    return { cancelled: true };
  }
  let idToken = String(response.data.idToken || '').trim();
  if (!idToken) {
    const tokens = await GoogleSignin.getTokens();
    idToken = String(tokens.idToken || '').trim();
  }
  if (!idToken) {
    return { error: localError('Giriş tamamlandı ama oturum anahtarı gelmedi.') };
  }
  const { token } = await api.googleNative({ idToken });
  return { token };
}

export async function startGoogleSignIn(): Promise<OAuthResult | void> {
  if (Platform.OS === 'web') return startWebGoogleSignIn();
  if (isExpoGo()) return startBrowserGoogleSignIn();
  try {
    return await startNativeGoogleSignIn();
  } catch (err) {
    if (missingNativeModule(err)) {
      return startBrowserGoogleSignIn();
    }
    try {
      const { isErrorWithCode, statusCodes } = await import(
        '@react-native-google-signin/google-signin'
      );
      if (isErrorWithCode(err) && err.code === statusCodes.SIGN_IN_CANCELLED) {
        return { cancelled: true };
      }
      if (isErrorWithCode(err) && err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return { error: localError('Google Play Hizmetleri yok veya güncel değil.') };
      }
      if (isErrorWithCode(err) && err.code === statusCodes.IN_PROGRESS) {
        return { error: localError('Google girişi zaten sürüyor.') };
      }
    } catch {
      return startBrowserGoogleSignIn();
    }
    return {
      error: failCatch(err, 'Google girişi başarısız.'),
    };
  }
}

export async function startOAuth(
  provider: 'google' | 'instagram' = 'google',
): Promise<OAuthResult | void> {
  if (provider !== 'google') {
    return { error: localError('Instagram bağlantısı kaldırıldı.') };
  }
  return startGoogleSignIn();
}
