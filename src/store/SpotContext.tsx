import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { io, type Socket } from 'socket.io-client';
import { API_URL, api, getToken, hydrateToken, setToken, type Snapshot, ApiError } from '../api';
import { parseSpotToken } from '../auth/parseToken';
import { DEFAULT_MAP } from '../data/seed';
import { prepareNotices, presentSystemNotice, registerExpoPush, lastPushToken } from '../notices/present';
import type { AppNotice, Pin, Profile } from '../types';
import { livePins, pinsLeftToday } from '../utils';

const emptyMe: Profile = {
  id: '',
  name: '',
  instagram: '',
  bio: '',
  interests: [],
  badges: [],
};

type SpotState = Snapshot & {
  signedIn: boolean;
  location: { lat: number; lng: number };
  hasGps: boolean;
  notice: AppNotice | null;
  apiDown: boolean;
};

type SpotContextValue = SpotState & {
  meId: string;
  remainingPins: number;
  live: Pin[];
  profileById: (id: string) => Profile | undefined;
  signOut: () => Promise<void>;
  signInWithToken: (token: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteAccount: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  retryConnection: () => Promise<void>;
  dropPin: (
    text: string,
    kind: Pin['kind'],
    at: { lat: number; lng: number },
    extra: { meetAt: number; placeName?: string; featured?: boolean },
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  sendJoin: (
    pinId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  decideRequest: (requestId: string, accept: boolean) => Promise<string | null>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  setMyProfile: (
    patch: Partial<Pick<Profile, 'bio' | 'name' | 'instagram'>>,
  ) => Promise<void>;
  disconnectInstagram: () => Promise<void>;
  setLocation: (loc: { lat: number; lng: number }) => void;
  activatePro: (
    plan: 'monthly' | 'yearly',
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  uploadPhoto: (
    dataUrl: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  finishOnboarding: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  closePin: (
    pinId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  blockUser: (
    userId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  unblockUser: (
    userId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  reportUser: (
    userId: string,
    reason: string,
    pinId?: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  dismissNotice: () => void;
  spinChat: (chatId: string) => Promise<{ ok: true } | { ok: false; reason: string }>;
  checkin: (
    chatId: string,
    happened: boolean,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  startSafeShare: (
    chatId: string,
  ) => Promise<{ ok: true; url: string } | { ok: false; reason: string }>;
  stopSafeShare: (chatId: string) => Promise<void>;
  setViewingChat: (chatId: string | null) => void;
};

const emptySnap: Snapshot = {
  me: emptyMe,
  profiles: [],
  pins: [],
  requests: [],
  chats: [],
  blocked: [],
};

const SpotContext = createContext<SpotContextValue | null>(null);

function applySnap(
  prev: SpotState,
  snap: Snapshot,
  signedIn = true,
): SpotState {
  return {
    ...prev,
    ...snap,
    me: snap.me ?? emptyMe,
    signedIn,
    notice: prev.notice,
    apiDown: false,
    blocked: snap.blocked ?? [],
  };
}

export function SpotProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SpotState>({
    ...emptySnap,
    signedIn: false,
    location: DEFAULT_MAP,
    hasGps: false,
    notice: null,
    apiDown: false,
  });
  const locRef = useRef(state.location);
  locRef.current = state.location;
  const viewingChatRef = useRef<string | null>(null);

  const hydrate = useCallback((snap: Snapshot) => {
    setState((s) => applySnap(s, snap, true));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void hydrateToken().then((token) => {
      if (!token || cancelled) return;
      api
        .snapshot()
        .then((snap) => {
          if (!cancelled) hydrate(snap);
        })
        .catch((err) => {
          if (cancelled) return;
          const status = err instanceof ApiError ? err.status : 0;
          if (status === 401) {
            setToken(null);
            setState((s) => ({ ...s, ...emptySnap, signedIn: false, apiDown: false }));
            return;
          }
          setState((s) => ({ ...s, apiDown: true }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const apply = async (token: string) => {
      setToken(token);
      const snap = await api.snapshot();
      hydrate(snap);
    };
    const onMsg = (event: MessageEvent) => {
      if (event.data?.type === 'SPOT_AUTH' && typeof event.data.token === 'string') {
        void apply(event.data.token);
      }
    };
    window.addEventListener('message', onMsg);
    const fromQuery = new URLSearchParams(window.location.search).get('spot_token');
    const fromHash = window.location.hash.match(/spot_token=([^&]+)/);
    const incoming = fromQuery || (fromHash ? decodeURIComponent(fromHash[1]) : null);
    if (incoming) {
      void apply(incoming);
      window.history.replaceState(null, '', window.location.pathname);
    }
    return () => window.removeEventListener('message', onMsg);
  }, [hydrate]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const apply = async (url: string) => {
      const token = parseSpotToken(url);
      if (!token) return;
      setToken(token);
      try {
        hydrate(await api.snapshot());
      } catch {
        setState((s) => ({ ...s, apiDown: true }));
      }
    };
    const sub = Linking.addEventListener('url', (event) => {
      void apply(event.url);
    });
    void Linking.getInitialURL().then((url) => {
      if (url) void apply(url);
    });
    return () => sub.remove();
  }, [hydrate]);

  useEffect(() => {
    if (!state.signedIn) return;
    const token = getToken();
    if (!token) return;
    const socket: Socket = io(API_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socket.on('snapshot', (snap: Snapshot) => hydrate(snap));
    socket.on('notice', (notice: AppNotice) => {
      if (!notice?.title) return;
      if (notice.chatId && notice.chatId === viewingChatRef.current) return;
      setState((s) => ({ ...s, notice }));
      void presentSystemNotice(notice);
    });
    return () => {
      socket.disconnect();
    };
  }, [state.signedIn, hydrate]);

  useEffect(() => {
    if (!state.signedIn || !state.me.onboarded) return;
    void prepareNotices().then(() =>
      registerExpoPush((token) => api.registerPushToken(token).then(() => {})),
    );
  }, [state.signedIn, state.me.onboarded]);

  useEffect(() => {
    if (!state.signedIn) return;
    let sub: Location.LocationSubscription | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setState((s) => ({
          ...s,
          hasGps: true,
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
        }));
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: 25 },
          (update) => {
            setState((s) => ({
              ...s,
              location: {
                lat: update.coords.latitude,
                lng: update.coords.longitude,
              },
            }));
          },
        );
      } catch {
        /* izin yoksa Kadıköy varsayılanı kalır */
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [state.signedIn]);

  useEffect(() => {
    const share = state.me.safeShare;
    if (!state.signedIn || !share?.token) return;
    const id = setInterval(() => {
      void api.pingSafeShare(share.token, locRef.current).catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, [state.signedIn, state.me.safeShare?.token]);

  const value = useMemo<SpotContextValue>(() => {
    const me = state.me ?? emptyMe;
    const live = livePins(state.pins);
    const remainingPins = me.isPro
      ? 99
      : me.id
        ? pinsLeftToday(state.pins, me.id)
        : 0;
    const profileById = (id: string) => state.profiles.find((p) => p.id === id);

    const signOut = async () => {
      const push = lastPushToken();
      try {
        if (push) await api.unregisterPushToken(push);
      } catch {
        /* ignore */
      }
      try {
        await api.logout();
      } catch {
        /* ignore */
      }
      setToken(null);
      setState((s) => ({ ...s, ...emptySnap, signedIn: false, apiDown: false }));
    };

    const signInWithToken: SpotContextValue['signInWithToken'] = async (token) => {
      setToken(token);
      try {
        hydrate(await api.snapshot());
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Giriş tamamlanamadı.',
        };
      }
    };

    const retryConnection = async () => {
      const token = getToken();
      if (!token) {
        setState((s) => ({ ...s, apiDown: false }));
        return;
      }
      try {
        hydrate(await api.snapshot());
      } catch {
        setState((s) => ({ ...s, apiDown: true }));
      }
    };

    const deleteAccount: SpotContextValue['deleteAccount'] = async () => {
      try {
        await api.deleteAccount();
        setToken(null);
        setState((s) => ({ ...s, ...emptySnap, signedIn: false, apiDown: false }));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Hesap silinemedi.',
        };
      }
    };

    const dropPin: SpotContextValue['dropPin'] = async (text, kind, at, extra) => {
      try {
        const snap = await api.dropPin({
          text,
          kind,
          lat: at.lat,
          lng: at.lng,
          meetAt: extra.meetAt,
          placeName: extra.placeName,
          featured: extra.featured,
        });
        hydrate(snap);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Mark koyulamadı.',
        };
      }
    };

    const sendJoin: SpotContextValue['sendJoin'] = async (pinId) => {
      try {
        hydrate(await api.joinPin(pinId));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'İstek gönderilemedi.',
        };
      }
    };

    const decideRequest: SpotContextValue['decideRequest'] = async (
      requestId,
      accept,
    ) => {
      try {
        const res = await api.decide(requestId, accept);
        hydrate(res.snapshot);
        return res.chatId;
      } catch {
        return null;
      }
    };

    const sendMessage = async (chatId: string, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      try {
        hydrate(await api.sendMessage(chatId, trimmed));
      } catch {
        /* ignore */
      }
    };

    const setMyProfile: SpotContextValue['setMyProfile'] = async (patch) => {
      hydrate(await api.patchMe(patch));
    };

    const disconnectInstagram = async () => {
      hydrate(await api.disconnectInstagram());
    };

    const setLocation = (loc: { lat: number; lng: number }) => {
      setState((s) => ({ ...s, location: loc }));
    };

    const activatePro: SpotContextValue['activatePro'] = async (plan) => {
      try {
        hydrate(await api.activatePro(plan));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Satın alma tamamlanamadı.',
        };
      }
    };

    const uploadPhoto: SpotContextValue['uploadPhoto'] = async (dataUrl) => {
      try {
        hydrate(await api.uploadPhoto(dataUrl));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Fotoğraf yüklenemedi.',
        };
      }
    };

    const finishOnboarding: SpotContextValue['finishOnboarding'] = async () => {
      try {
        hydrate(await api.patchMe({ onboarded: true }));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Devam edilemedi.',
        };
      }
    };

    const closePin: SpotContextValue['closePin'] = async (pinId) => {
      try {
        hydrate(await api.closePin(pinId));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Mark kapatılamadı.',
        };
      }
    };

    const blockUser: SpotContextValue['blockUser'] = async (userId) => {
      try {
        hydrate(await api.blockUser(userId));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Engellenemedi.',
        };
      }
    };

    const unblockUser: SpotContextValue['unblockUser'] = async (userId) => {
      try {
        hydrate(await api.unblockUser(userId));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Engel kaldırılamadı.',
        };
      }
    };

    const reportUser: SpotContextValue['reportUser'] = async (
      userId,
      reason,
      pinId,
    ) => {
      try {
        await api.reportUser(userId, reason, pinId);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Şikayet gönderilemedi.',
        };
      }
    };

    const dismissNotice = () => {
      setState((s) => ({ ...s, notice: null }));
    };

    const setViewingChat = (chatId: string | null) => {
      viewingChatRef.current = chatId;
    };

    const spinChat: SpotContextValue['spinChat'] = async (chatId) => {
      try {
        hydrate(await api.spinChat(chatId));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Çark çevrilemedi.',
        };
      }
    };

    const checkin: SpotContextValue['checkin'] = async (chatId, happened) => {
      try {
        hydrate(await api.checkin(chatId, happened, state.location));
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Kaydedilemedi.',
        };
      }
    };

    const startSafeShare: SpotContextValue['startSafeShare'] = async (chatId) => {
      try {
        const res = await api.startSafeShare(chatId, state.location);
        hydrate(res.snapshot);
        return { ok: true, url: res.shareUrl };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Link oluşturulamadı.',
        };
      }
    };

    const stopSafeShare: SpotContextValue['stopSafeShare'] = async (chatId) => {
      try {
        hydrate(await api.stopSafeShare(chatId));
      } catch {
        /* ignore */
      }
    };

    return {
      ...state,
      me,
      meId: me.id,
      live,
      remainingPins,
      profileById,
      signOut,
      signInWithToken,
      deleteAccount,
      retryConnection,
      dropPin,
      sendJoin,
      decideRequest,
      sendMessage,
      setMyProfile,
      disconnectInstagram,
      setLocation,
      activatePro,
      uploadPhoto,
      finishOnboarding,
      closePin,
      blockUser,
      unblockUser,
      reportUser,
      dismissNotice,
      setViewingChat,
      spinChat,
      checkin,
      startSafeShare,
      stopSafeShare,
    };
  }, [state, hydrate]);

  return <SpotContext.Provider value={value}>{children}</SpotContext.Provider>;
}

export function useSpot() {
  const ctx = useContext(SpotContext);
  if (!ctx) throw new Error('useSpot must be used inside SpotProvider');
  return ctx;
}
