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
import { api, getApiUrl, getToken, hydrateToken, mediaUrl, setToken, type Snapshot, ApiError } from '../api';
import { parseSpotToken } from '../auth/parseToken';
import { DEFAULT_MAP } from '../data/seed';
import { prepareNotices, presentSystemNotice, registerExpoPush, lastPushToken } from '../notices/present';
import { dailyPinLimit } from '../pro/limits';
import type { AppNotice, Pin, Profile, WallPost } from '../types';
import { loadLastRead, saveLastRead } from '../chat/lastRead';
import {
  loadProfileOverlays,
  mergeProfile,
  shapeProfile,
  overlayFor,
  patchToOverlay,
  rememberOverlay,
} from '../profile/persist';
import {
  albumFor,
  loadAlbums,
  rememberAlbum,
  stashAlbumPhoto,
} from '../profile/album';
import { displayName, livePins, pinCaption, pinEmbeddedAnon, pinEmbeddedPhoto, pinEmbeddedSeats, pinsLeftToday, withPinMeta } from '../utils';
import {
  hideChatLocal,
  hideRequestLocal,
  isChatHidden,
  isRequestHidden,
  loadInboxHide,
} from '../inbox/persist';
import {
  loadLocalPinCovers,
  readPinCovers,
  saveLocalPinCovers,
  visibleBio,
  withPinCovers,
} from '../pins/covers';
import {
  dropSyncedWallPosts,
  forgetWallPost,
  loadWallPosts,
  mergeWallPosts,
  postsFor,
  rememberWallPost,
  unsyncedWallNotes,
} from '../wall/persist';
import { readWallFromBio } from '../wall/bio';
import {
  forgetFollow,
  loadFollows,
  mergeFollowingIds,
  rememberFollow,
} from '../follow/persist';

const emptyMe: Profile = {
  id: '',
  name: '',
  username: '',
  bio: '',
  interests: [],
  badges: [],
};

const extraProfiles: Record<string, Profile> = {};

function fromSearchHit(hit: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  profileImage?: string;
}): Profile {
  return shapeProfile({
    id: hit.id,
    name: hit.displayName || hit.username,
    username: hit.username,
    photoUrl: hit.avatarUrl || hit.profileImage || '',
    bio: '',
    interests: [],
  });
}

const pinPhotos: Record<string, string> = {};

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
  claimAdMark: () => Promise<{ ok: true } | { ok: false; reason: string }>;
  dropPin: (
    text: string,
    kind: Pin['kind'],
    at: { lat: number; lng: number },
    extra: {
      meetAt: number;
      placeName?: string;
      featured?: boolean;
      photoDataUrl?: string;
      capacity?: 2 | 3 | 4;
      anonymous?: boolean;
    },
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  sendJoin: (
    pinId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  withdrawRequest: (
    requestId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  hideChat: (
    chatId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  decideRequest: (
    requestId: string,
    accept: boolean,
  ) => Promise<{ chatId: string | null; filled: boolean }>;
  sendMessage: (
    chatId: string,
    text: string,
    extra?: { dataUrl?: string },
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  setMyProfile: (
    patch: Partial<
      Pick<Profile, 'bio' | 'name' | 'username' | 'firstName' | 'lastName' | 'age' | 'birthDate' | 'gender' | 'interests' | 'vibeNote'>
    >,
  ) => Promise<void>;
  rememberProfiles: (people: Profile[]) => void;
  searchUsers: (q: string) => Promise<Profile[]>;
  setLocation: (loc: { lat: number; lng: number }) => void;
  activatePro: (
    plan: 'monthly' | 'yearly',
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  uploadPhoto: (
    dataUrl: string,
    localUri?: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  uploadPhotos: (
    items: { dataUrl: string; uri?: string }[],
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
  followUser: (
    userId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  unfollowUser: (
    userId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  startHello: (
    userId: string,
  ) => Promise<{ ok: true; chatId: string } | { ok: false; reason: string }>;
  postWallNote: (
    userId: string,
    text: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  deleteWallNote: (
    userId: string,
    postId: string,
  ) => Promise<{ ok: true } | { ok: false; reason: string }>;
  likeWallNote: (userId: string, postId: string) => void;
  refreshWall: (userId: string) => Promise<WallPost[]>;
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
  markChatRead: (chatId: string) => void;
  isChatUnread: (chatId: string) => boolean;
  unreadChats: number;
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

const heroPreview: Record<string, string> = {};

function withMediaProfile(person: Profile): Profile {
  if (!person?.id) return person;
  const preview = heroPreview[person.id];
  const wallPosts = mergeWallPosts(
    person.wallPosts,
    readWallFromBio(person.bio),
  ).map((p) => ({
    ...p,
    fromPhoto: mediaUrl(p.fromPhoto) || p.fromPhoto,
  }));
  return {
    ...person,
    photoUrl: preview || mediaUrl(person.photoUrl) || person.photoUrl,
    photos: (() => {
      const list: string[] = [];
      const seen = new Set<string>();
      const add = (raw?: string) => {
        const uri = String(raw || '').trim();
        if (!uri) return;
        const key = uri.split('?')[0];
        if (seen.has(key) || list.includes(uri)) return;
        seen.add(key);
        list.push(uri);
      };
      if (preview && (preview.startsWith('file:') || preview.startsWith('content:') || preview.startsWith('data:'))) {
        add(preview);
      }
      (person.photos || []).forEach((p) => add(mediaUrl(p) || p));
      add(mediaUrl(person.photoUrl) || person.photoUrl);
      return list.slice(0, 6);
    })(),
    wallMarks: (person.wallMarks || []).map((m) => ({
      ...m,
      photoUrl: mediaUrl(m.photoUrl) || m.photoUrl,
    })),
    wallPosts,
  };
}

function withLocalPosts(person: Profile, selfId?: string): Profile {
  if (!person?.id) return person;
  if (selfId && person.id !== selfId) return person;
  return {
    ...person,
    wallPosts: mergeWallPosts(person.wallPosts, postsFor(person.id)),
  };
}

function withLocalFollows(person: Profile, meId: string, followingIds: string[]): Profile {
  if (!person?.id) return person;
  if (person.id === meId) {
    return {
      ...person,
      followingIds,
      stats: {
        marks: person.stats?.marks || 0,
        meets: person.stats?.meets || 0,
        followers: person.stats?.followers || 0,
        following: Math.max(person.stats?.following || 0, followingIds.length),
      },
    };
  }
  return {
    ...person,
    stats: {
      marks: person.stats?.marks || 0,
      meets: person.stats?.meets || 0,
      followers: Math.max(
        person.stats?.followers || 0,
        followingIds.includes(person.id) ? 1 : 0,
      ),
      following: person.stats?.following || 0,
    },
  };
}

function mergeKeepPhotos(...groups: (string[] | string | undefined)[]) {
  const list: string[] = [];
  const seen = new Set<string>();
  const add = (raw?: string) => {
    const uri = String(raw || '').trim();
    if (!uri || uri.startsWith('data:') || uri.startsWith('blob:')) return;
    const key = uri.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);
    list.push(uri);
  };
  for (const group of groups) {
    if (Array.isArray(group)) group.forEach(add);
    else add(group);
  }
  return list.slice(0, 6);
}

function applySnap(
  prev: SpotState,
  snap: Snapshot,
  signedIn = true,
): SpotState {
  const rawMe = snap.me ?? emptyMe;
  const followingIds = mergeFollowingIds(rawMe.followingIds, rawMe.id);
  const prevMe = prev.me?.id === rawMe.id ? prev.me : undefined;
  const shapedMe = mergeProfile(rawMe);
  const localAlbum = mergeKeepPhotos(
    albumFor(rawMe.id),
    prevMe?.photos,
    overlayFor(rawMe.id)?.photos,
  );
  const serverAlbum = mergeKeepPhotos(shapedMe.photos, shapedMe.photoUrl);
  const photos =
    serverAlbum.length >= 2
      ? serverAlbum
      : mergeKeepPhotos(localAlbum, serverAlbum, prevMe?.photoUrl);
  if (rawMe.id && photos.length) rememberAlbum(rawMe.id, photos);
  const me = withMediaProfile(
    withLocalFollows(
      withLocalPosts(
        {
          ...shapedMe,
          photos,
          photoUrl: photos[0] || shapedMe.photoUrl || prevMe?.photoUrl,
        },
        rawMe.id,
      ),
      rawMe.id,
      followingIds,
    ),
  );
  const mapped = (snap.profiles || []).map((p) =>
    withMediaProfile(
      withLocalFollows(
        withLocalPosts(
          p.id === me.id ? { ...p, ...me } : mergeProfile(p, overlayFor(p.id)),
          me.id,
        ),
        me.id,
        followingIds,
      ),
    ),
  );
  const seen = new Set(mapped.map((p) => p.id));
  const extras = Object.values(extraProfiles).filter((p) => p.id && !seen.has(p.id));
    const seenBlocked = new Set(
      (snap.blocked ?? []).map((p) => p.id).filter(Boolean),
    );
    const hideOther = (otherId?: string) =>
      Boolean(otherId && otherId !== me.id && seenBlocked.has(otherId));
    return {
    ...prev,
    ...snap,
    me,
    profiles: [...mapped, ...extras].filter((p) => p.id === me.id || !seenBlocked.has(p.id)),
    requests: (snap.requests || []).filter(
      (r) => !isRequestHidden(r.id) && !hideOther(r.fromId),
    ),
    chats: (snap.chats || [])
      .filter((c) => !isChatHidden(c.id))
      .filter((c) => !c.memberIds.some((id) => hideOther(id)))
      .map((c) => ({
        ...c,
        messages: (c.messages || []).map((m) => ({
          ...m,
          imageUrl: mediaUrl(m.imageUrl) || m.imageUrl,
        })),
      })),
    pins: (snap.pins || [])
      .filter((p) => p.authorId === me.id || !seenBlocked.has(p.authorId))
      .map((p) => {
      const author =
        p.authorId === me.id
          ? me
          : (snap.profiles || []).find((u) => u.id === p.authorId);
      const covers = readPinCovers(author?.bio || '');
      const photoUrl =
        p.photoUrl ||
        pinPhotos[p.id] ||
        pinEmbeddedPhoto(p.text) ||
        covers[p.id] ||
        '';
      return {
        ...p,
        text: pinCaption(p.text),
        photoUrl: mediaUrl(photoUrl) || undefined,
        capacity: p.capacity || pinEmbeddedSeats(p.text),
        anonymous: Boolean(p.anonymous) || pinEmbeddedAnon(p.text),
      };
    }),
    signedIn,
    notice: prev.notice,
    apiDown: false,
    blocked: (snap.blocked ?? []).map(withMediaProfile),
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
  const wallFlushRef = useRef(false);
  const [lastRead, setLastRead] = useState<Record<string, number>>({});

  const hydrate = useCallback((snap: Snapshot) => {
    const meId = snap.me?.id;
    const pending = meId
      ? unsyncedWallNotes(
          meId,
          mergeWallPosts(snap.me?.wallPosts, readWallFromBio(snap.me?.bio)),
        )
      : [];
    setState((s) => applySnap(s, snap, true));
    if (!meId || wallFlushRef.current) return;
    if (!pending.length) return;
    wallFlushRef.current = true;
    void (async () => {
      try {
        let last: Snapshot | null = null;
        for (const post of pending) {
          const text = String(post.text || '').trim();
          if (text.length < 2) {
            forgetWallPost(meId, post.id);
            continue;
          }
          try {
            last = await api.postWallNote(meId, text, meId);
            forgetWallPost(meId, post.id);
          } catch {
            break;
          }
        }
        if (last) {
          dropSyncedWallPosts(
            meId,
            mergeWallPosts(last.me?.wallPosts, readWallFromBio(last.me?.bio)),
          );
          setState((s) => applySnap(s, last!, true));
        }
      } finally {
        wallFlushRef.current = false;
      }
    })();
  }, []);

  useEffect(() => {
    void loadLastRead().then(setLastRead);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadProfileOverlays();
      await loadAlbums();
      await loadInboxHide();
      await loadWallPosts();
      await loadFollows();
      Object.assign(pinPhotos, await loadLocalPinCovers());
      const token = await hydrateToken();
      if (!token || cancelled) return;
      try {
        const snap = await api.snapshot();
        if (!cancelled) hydrate(snap);
      } catch (err) {
        if (cancelled) return;
        const status = err instanceof ApiError ? err.status : 0;
        if (status === 401) {
          setToken(null);
          setState((s) => ({ ...s, ...emptySnap, signedIn: false, apiDown: false }));
          return;
        }
        setState((s) => ({ ...s, apiDown: true }));
      }
    })();
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
    const socket: Socket = io(getApiUrl(), {
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
    const remainingPins = me.id
      ? pinsLeftToday(
          state.pins,
          me.id,
          Date.now(),
          dailyPinLimit(Boolean(me.isPro), Number(me.adMarksToday) || 0),
        )
      : 0;
    const profileById = (id: string) =>
      state.profiles.find((p) => p.id === id) || extraProfiles[id];

    const isChatUnread = (chatId: string) => {
      const chat = state.chats.find((c) => c.id === chatId);
      const last = chat?.messages[chat.messages.length - 1];
      if (!last || last.fromId === me.id || last.fromId === 'system') return false;
      return last.at > (lastRead[chatId] || 0);
    };
    const unreadChats = state.chats.filter((c) => isChatUnread(c.id)).length;

    const markChatRead = (chatId: string) => {
      const chat = state.chats.find((c) => c.id === chatId);
      const lastAt = chat?.messages[chat.messages.length - 1]?.at ?? Date.now();
      setLastRead((prev) => {
        if ((prev[chatId] || 0) >= lastAt) return prev;
        const next = { ...prev, [chatId]: lastAt };
        saveLastRead(next);
        return next;
      });
    };

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
      if (kind === 'chat' && !me.isPro) {
        return { ok: false, reason: 'Sohbet noktası Pro’ya özel.' };
      }
      if (!me.isPro && extra.featured) {
        return { ok: false, reason: 'Öne çıkarma Pro’ya özel.' };
      }
      if (!me.isPro && extra.anonymous) {
        return { ok: false, reason: 'Anonim paylaşım Pro’ya özel.' };
      }
      try {
        const snap = await api.dropPin({
          text: withPinMeta(text, {
            photoDataUrl: extra.photoDataUrl,
            capacity: extra.capacity,
            anonymous: extra.anonymous,
          }),
          kind,
          lat: at.lat,
          lng: at.lng,
          meetAt: extra.meetAt,
          placeName: extra.placeName,
          featured: extra.featured,
          capacity: extra.capacity,
          anonymous: extra.anonymous,
        });
        if (extra.photoDataUrl) {
          const newest = [...(snap.pins || [])]
            .filter((p) => p.authorId === snap.me.id)
            .sort((a, b) => b.createdAt - a.createdAt)[0];
          if (newest) {
            pinPhotos[newest.id] = extra.photoDataUrl;
            saveLocalPinCovers(pinPhotos);
            const covers = {
              ...readPinCovers(snap.me.bio),
              [newest.id]: extra.photoDataUrl,
            };
            const liveIds = new Set(
              (snap.pins || [])
                .filter((p) => p.authorId === snap.me.id)
                .map((p) => p.id),
            );
            Object.keys(covers).forEach((id) => {
              if (!liveIds.has(id)) delete covers[id];
            });
            try {
              hydrate(
                await api.patchMe({
                  bio: withPinCovers(visibleBio(snap.me.bio), covers),
                }),
              );
              return { ok: true };
            } catch {
              /* canlı API bio yazmasa da text gömülü */
            }
          }
        }
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

    const withdrawRequest: SpotContextValue['withdrawRequest'] = async (requestId) => {
      hideRequestLocal(requestId);
      try {
        hydrate(await api.withdrawRequest(requestId));
        return { ok: true };
      } catch (err) {
        setState((s) => ({
          ...s,
          requests: s.requests.filter((r) => r.id !== requestId),
        }));
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
          return { ok: true };
        }
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'İstek geri çekilemedi.',
        };
      }
    };

    const hideChat: SpotContextValue['hideChat'] = async (chatId) => {
      hideChatLocal(chatId);
      try {
        hydrate(await api.hideChat(chatId));
        return { ok: true };
      } catch (err) {
        setState((s) => ({
          ...s,
          chats: s.chats.filter((c) => c.id !== chatId),
        }));
        if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
          return { ok: true };
        }
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Sohbet silinemedi.',
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
        return { chatId: res.chatId, filled: Boolean(res.filled) };
      } catch {
        return { chatId: null, filled: false };
      }
    };

    const sendMessage = async (
      chatId: string,
      text: string,
      extra?: { dataUrl?: string },
    ) => {
      const trimmed = text.trim();
      const dataUrl = String(extra?.dataUrl || '').trim();
      if (!trimmed && !dataUrl) {
        return { ok: false as const, reason: 'Boş mesaj.' };
      }
      try {
        hydrate(
          await api.sendMessage(
            chatId,
            trimmed || (dataUrl ? '📷 Fotoğraf' : ''),
            dataUrl || undefined,
          ),
        );
        return { ok: true as const };
      } catch (err) {
        return {
          ok: false as const,
          reason: err instanceof Error ? err.message : 'Mesaj gönderilemedi.',
        };
      }
    };

    const setMyProfile: SpotContextValue['setMyProfile'] = async (patch) => {
      if (typeof patch.vibeNote === 'string' && Object.keys(patch).length === 1) {
        const note = patch.vibeNote.trim().slice(0, 40);
        if (state.me.id) rememberOverlay(state.me.id, { vibeNote: note });
        setState((s) => ({ ...s, me: { ...s.me, vibeNote: note } }));
        return;
      }
      const firstName =
        typeof patch.firstName === 'string' ? patch.firstName.trim() : undefined;
      const lastName =
        typeof patch.lastName === 'string' ? patch.lastName.trim() : undefined;
      const composed = [firstName, lastName].filter(Boolean).join(' ').trim();
      const name =
        composed.length >= 2
          ? composed
          : typeof patch.name === 'string'
            ? patch.name.trim()
            : displayName({
                firstName: firstName ?? state.me.firstName,
                lastName: lastName ?? state.me.lastName,
                name: state.me.name,
              });
      const body = {
        ...patch,
        ...(firstName !== undefined ? { firstName } : {}),
        ...(lastName !== undefined ? { lastName } : {}),
        ...(name.length >= 2 ? { name } : {}),
      };
      const snap = await api.patchMe(body);
      if (snap.me?.id) rememberOverlay(snap.me.id, patchToOverlay(body));
      hydrate(snap);
    };

    const rememberProfiles = (people: Profile[]) => {
      const next = people.map((p) => shapeProfile(p));
      next.forEach((p) => {
        if (p.id) extraProfiles[p.id] = p;
      });
      setState((s) => {
        const ids = new Set(s.profiles.map((p) => p.id));
        return {
          ...s,
          profiles: [
            ...s.profiles.map((p) => extraProfiles[p.id] || p),
            ...next.filter((p) => !ids.has(p.id)),
          ],
        };
      });
    };

    const searchUsers = async (q: string) => {
      const data = await api.searchUsers(q);
      const rawUsers = Array.isArray(data)
        ? data
        : data.users || [];
      const people = rawUsers.map(fromSearchHit);
      rememberProfiles(people);
      return people;
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

    const uploadPhotos: SpotContextValue['uploadPhotos'] = async (items) => {
      const id = state.me.id;
      const stashed: string[] = [];
      for (const item of items) {
        const local = await stashAlbumPhoto(id, item.uri || item.dataUrl);
        if (local) stashed.push(local);
      }
      if (stashed.length) {
        const photos = mergeKeepPhotos(stashed, albumFor(id), state.me.photos, state.me.photoUrl);
        rememberAlbum(id, photos);
        setState((s) => ({
          ...s,
          me: {
            ...s.me,
            photoUrl: photos[0] || s.me.photoUrl,
            photos,
          },
        }));
      }
      try {
        const dataUrls = items.map((item) => item.dataUrl).filter(Boolean);
        let snap: Snapshot | null = null;
        try {
          snap = await api.uploadPhotos(dataUrls);
        } catch (err) {
          if (!(err instanceof ApiError) || err.status !== 404) throw err;
          for (const dataUrl of dataUrls) {
            snap = await api.uploadPhoto(dataUrl);
          }
        }
        if (snap) hydrate(snap);
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Fotoğraf yüklenemedi.',
        };
      }
    };

    const uploadPhoto: SpotContextValue['uploadPhoto'] = async (dataUrl, localUri) => {
      return uploadPhotos([{ dataUrl, uri: localUri }]);
    };

    const finishOnboarding: SpotContextValue['finishOnboarding'] = async () => {
      try {
        const extra = overlayFor(state.me.id) || {};
        const name =
          extra.name ||
          displayName({
            firstName: extra.firstName || state.me.firstName,
            lastName: extra.lastName || state.me.lastName,
            name: state.me.name,
          });
        const snap = await api.patchMe({
          ...extra,
          ...(name && name.length >= 2 ? { name } : {}),
          onboarded: true,
        });
        if (snap.me?.id) rememberOverlay(snap.me.id, extra);
        hydrate(snap);
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
      if (!userId || userId === state.me.id) {
        return { ok: false, reason: 'Engellenemedi.' };
      }
      const person =
        state.profiles.find((p) => p.id === userId) || extraProfiles[userId];
      setState((s) => ({
        ...s,
        pins: s.pins.filter((p) => p.authorId !== userId),
        chats: s.chats.filter((c) => !c.memberIds.includes(userId)),
        requests: s.requests.filter((r) => r.fromId !== userId),
        blocked: s.blocked.some((b) => b.id === userId)
          ? s.blocked
          : [
              ...s.blocked,
              person || {
                id: userId,
                name: 'Engellenen',
                username: '',
                bio: '',
                interests: [],
              },
            ],
      }));
      try {
        hydrate(await api.blockUser(userId));
        return { ok: true };
      } catch (err) {
        try {
          hydrate(await api.snapshot());
        } catch {
          /* */
        }
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

    const followUser: SpotContextValue['followUser'] = async (userId) => {
      if (!userId || userId === state.me.id) {
        return { ok: false, reason: 'Kendini takip edemezsin.' };
      }
      const already = Boolean(state.me.followingIds?.includes(userId));
      const paint = (on: boolean) => {
        rememberFollow(state.me.id, userId);
        if (!on) forgetFollow(state.me.id, userId);
        setState((s) => {
          const had = Boolean(s.me.followingIds?.includes(userId));
          if (on === had) return s;
          const followingIds = on
            ? Array.from(new Set([...(s.me.followingIds || []), userId]))
            : (s.me.followingIds || []).filter((id) => id !== userId);
          const bump = on ? 1 : -1;
          const patchStats = (p: Profile, isTarget: boolean): Profile => ({
            ...p,
            ...(p.id === s.me.id ? { followingIds } : {}),
            stats: {
              marks: p.stats?.marks || 0,
              meets: p.stats?.meets || 0,
              followers: Math.max(
                0,
                (p.stats?.followers || 0) + (isTarget ? bump : 0),
              ),
              following: Math.max(
                0,
                (p.stats?.following || 0) + (p.id === s.me.id ? bump : 0),
              ),
            },
          });
          return {
            ...s,
            me: patchStats({ ...s.me, followingIds }, false),
            profiles: (s.profiles || []).map((p) =>
              patchStats(p, p.id === userId),
            ),
          };
        });
        if (extraProfiles[userId]) {
          const cur = extraProfiles[userId];
          extraProfiles[userId] = {
            ...cur,
            stats: {
              marks: cur.stats?.marks || 0,
              meets: cur.stats?.meets || 0,
              followers: Math.max(0, (cur.stats?.followers || 0) + (on ? 1 : -1)),
              following: cur.stats?.following || 0,
            },
          };
        }
      };
      if (!already) paint(true);
      try {
        const snap = await api.followUser(userId);
        rememberFollow(state.me.id, userId);
        hydrate(snap);
        return { ok: true };
      } catch (err) {
        if (!already) paint(false);
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Takip edilemedi.',
        };
      }
    };

    const unfollowUser: SpotContextValue['unfollowUser'] = async (userId) => {
      const had = Boolean(state.me.followingIds?.includes(userId));
      if (had) {
        forgetFollow(state.me.id, userId);
        setState((s) => {
          const followingIds = (s.me.followingIds || []).filter((id) => id !== userId);
          const patch = (p: Profile, isTarget: boolean): Profile => ({
            ...p,
            ...(p.id === s.me.id ? { followingIds } : {}),
            stats: {
              marks: p.stats?.marks || 0,
              meets: p.stats?.meets || 0,
              followers: Math.max(
                0,
                (p.stats?.followers || 0) - (isTarget ? 1 : 0),
              ),
              following: Math.max(
                0,
                (p.stats?.following || 0) - (p.id === s.me.id ? 1 : 0),
              ),
            },
          });
          return {
            ...s,
            me: patch({ ...s.me, followingIds }, false),
            profiles: (s.profiles || []).map((p) => patch(p, p.id === userId)),
          };
        });
        if (extraProfiles[userId]) {
          const cur = extraProfiles[userId];
          extraProfiles[userId] = {
            ...cur,
            stats: {
              marks: cur.stats?.marks || 0,
              meets: cur.stats?.meets || 0,
              followers: Math.max(0, (cur.stats?.followers || 0) - 1),
              following: cur.stats?.following || 0,
            },
          };
        }
      }
      try {
        const snap = await api.unfollowUser(userId);
        forgetFollow(state.me.id, userId);
        hydrate(snap);
        return { ok: true };
      } catch (err) {
        if (had) rememberFollow(state.me.id, userId);
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Takipten çıkılamadı.',
        };
      }
    };

    const startHello: SpotContextValue['startHello'] = async (userId) => {
      if (!userId || userId === state.me.id) {
        return { ok: false, reason: 'Kendine selam atamazsın.' };
      }
      const open = state.chats.find(
        (c) =>
          c.memberIds.includes(userId) &&
          (!c.closesAt || c.closesAt > Date.now()),
      );
      if (open) return { ok: true, chatId: open.id };
      try {
        const res = await api.startHello(userId);
        hydrate(res.snapshot);
        return { ok: true, chatId: res.chatId };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Selam gönderilemedi.',
        };
      }
    };

    const postWallNote: SpotContextValue['postWallNote'] = async (userId, text) => {
      const trimmed = String(text || '').trim().slice(0, 280);
      if (!userId) return { ok: false, reason: 'Profil yok.' };
      if (trimmed.length < 2) return { ok: false, reason: 'Bir cümle yaz.' };
      if (userId !== state.me.id) {
        return { ok: false, reason: 'Duvara yalnızca sahibi yazabilir.' };
      }
      try {
        const snap = await api.postWallNote(userId, trimmed, state.me.id);
        hydrate(snap);
        const posts = Array.isArray(snap.posts)
          ? snap.posts
          : await api.listWallPosts(userId);
        setState((s) => {
          const wallPosts = posts.map((p) => ({
            ...p,
            fromPhoto: mediaUrl(p.fromPhoto) || p.fromPhoto,
          }));
          const paint = (p: Profile) => (p.id === userId ? { ...p, wallPosts } : p);
          return {
            ...s,
            me: paint(s.me),
            profiles: (s.profiles || []).map(paint),
          };
        });
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Not paylaşılamadı.',
        };
      }
    };

    const deleteWallNote: SpotContextValue['deleteWallNote'] = async (userId, postId) => {
      try {
        hydrate(await api.deleteWallNote(userId, postId));
        forgetWallPost(userId, postId);
        return { ok: true };
      } catch {
        forgetWallPost(userId, postId);
        setState((s) => {
          const paint = (p: Profile) =>
            p.id === userId
              ? {
                  ...p,
                  wallPosts: (p.wallPosts || []).filter((x) => x.id !== postId),
                }
              : p;
          return {
            ...s,
            me: paint(s.me),
            profiles: (s.profiles || []).map(paint),
          };
        });
        return { ok: true };
      }
    };

    const likeWallNote: SpotContextValue['likeWallNote'] = (userId, postId) => {
      setState((s) => {
        const paint = (p: Profile) => {
          if (p.id !== userId) return p;
          const wallPosts = (p.wallPosts || []).map((post) => {
            if (post.id !== postId) return post;
            const liked = !post.liked;
            const likeCount = Math.max(0, (post.likeCount || 0) + (liked ? 1 : -1));
            const next = { ...post, liked, likeCount };
            rememberWallPost(userId, next);
            return next;
          });
          return { ...p, wallPosts };
        };
        return {
          ...s,
          me: paint(s.me),
          profiles: (s.profiles || []).map(paint),
        };
      });
    };

    const refreshWall: SpotContextValue['refreshWall'] = async (userId) => {
      if (!userId) return [];
      const posts = await api.listWallPosts(userId);
      const wallPosts = posts.map((p) => ({
        ...p,
        fromPhoto: mediaUrl(p.fromPhoto) || p.fromPhoto,
      }));
      setState((s) => {
        const paint = (p: Profile) => (p.id === userId ? { ...p, wallPosts } : p);
        return {
          ...s,
          me: paint(s.me),
          profiles: (s.profiles || []).map(paint),
        };
      });
      return wallPosts;
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
      if (chatId) markChatRead(chatId);
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

    const claimAdMark: SpotContextValue['claimAdMark'] = async () => {
      if (me.isPro) {
        return { ok: false, reason: 'Pro’da reklam hakkı yok.' };
      }
      try {
        hydrate(await api.claimAdMark());
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : 'Hak eklenemedi.',
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
      claimAdMark,
      dropPin,
      sendJoin,
      withdrawRequest,
      hideChat,
      decideRequest,
      sendMessage,
      setMyProfile,
      rememberProfiles,
      searchUsers,
      setLocation,
      activatePro,
      uploadPhoto,
      uploadPhotos,
      finishOnboarding,
      closePin,
      blockUser,
      unblockUser,
      followUser,
      unfollowUser,
      startHello,
      postWallNote,
      deleteWallNote,
      likeWallNote,
      refreshWall,
      reportUser,
      dismissNotice,
      setViewingChat,
      markChatRead,
      isChatUnread,
      unreadChats,
      spinChat,
      checkin,
      startSafeShare,
      stopSafeShare,
    };
  }, [state, hydrate, lastRead]);

  return <SpotContext.Provider value={value}>{children}</SpotContext.Provider>;
}

export function useSpot() {
  const ctx = useContext(SpotContext);
  if (!ctx) throw new Error('useSpot must be used inside SpotProvider');
  return ctx;
}
