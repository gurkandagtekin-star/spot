import { Platform } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { API_URL, api } from '../api';
import { parseSpotToken } from './parseToken';

WebBrowser.maybeCompleteAuthSession();

export type OAuthResult =
  | { token: string }
  | { cancelled: true }
  | { error: string };

function nativeRedirect() {
  return AuthSession.makeRedirectUri({
    scheme: 'markdate',
    path: 'oauth',
  });
}

export async function startOAuth(
  provider: 'google' | 'instagram',
): Promise<OAuthResult | void> {
  const redirect =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.origin
      : nativeRedirect();

  let ticket = '';
  if (provider === 'instagram') {
    try {
      ticket = (await api.igTicket()).ticket;
    } catch {
      /* Google oturumu yoksa sunucu kurulum veya hata sayfası gösterir */
    }
  }
  const url = `${API_URL}/auth/${provider}/start?redirect=${encodeURIComponent(
    redirect,
  )}&ticket=${encodeURIComponent(ticket)}`;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (provider === 'instagram') {
      window.location.assign(url);
      return;
    }
    const popup = window.open(url, 'spot-auth', 'width=420,height=680');
    if (!popup) window.location.assign(url);
    return;
  }

  try {
    const result = await WebBrowser.openAuthSessionAsync(url, redirect);
    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { cancelled: true };
    }
    if (result.type === 'success' && result.url) {
      const token = parseSpotToken(result.url);
      if (token) return { token };
      return { error: 'Giriş tamamlandı ama oturum anahtarı gelmedi.' };
    }
      return { error: 'Giriş tamamlanamadı.' };
  } catch {
    return { error: 'Giriş penceresi açılamadı.' };
  }
}
