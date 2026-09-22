import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { ComposeSheet } from '../components/ComposeSheet';
import { LiveClock } from '../components/LiveClock';
import { MapHint } from '../components/MapHint';
import { NearbyList } from '../components/NearbyList';
import { PinSheet } from '../components/PinSheet';
import { RadiusChips } from '../components/RadiusChips';
import { SpotMap } from '../components/SpotMap';
import { LocateIcon, PlusIcon } from '../components/TabIcons';
import { api } from '../api';
import { loadMapHintSeen, rememberMapHintSeen } from '../map/mapHint';
import { AdBanner, useAds } from '../ads/AdsContext';
import { usePro } from '../pro/usePro';
import { useSpot } from '../store/SpotContext';
import { radius, type ColorTokens } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';
import type { MapIntent, PinKind } from '../types';
import {
  distanceMeters,
  filterPinsByRange,
  formatDistance,
  formatMeetAt,
  liveChatWith,
  pinQuotaLabel,
  type PinRange,
} from '../utils';

type Props = {
  onOpenChat: (chatId: string) => void;
  onOpenChats: () => void;
  onOpenPro: () => void;
  onOpenProfile: (userId: string, pinId: string) => void;
  intent?: MapIntent | null;
  onIntentConsumed?: () => void;
};

export function MapScreen({
  onOpenChat,
  onOpenChats,
  onOpenPro,
  onOpenProfile,
  intent,
  onIntentConsumed,
}: Props) {
  const spot = useSpot();
  const pro = usePro();
  const ads = useAds();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [followToken, setFollowToken] = useState(0);
  const [lookAt, setLookAt] = useState<{ lat: number; lng: number } | null>(null);
  const [range, setRange] = useState<PinRange>('5');
  const [myArea, setMyArea] = useState('');
  const seenPins = useRef<Set<string>>(new Set());
  const primedNearby = useRef(false);
  const lastAreaFetch = useRef({ lat: 0, lng: 0 });
  const ignoreMapClick = useRef(0);
  const hintLocked = useRef(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (!pro.canUseRange(range)) setRange('15');
  }, [pro.isPro, range, pro.canUseRange]);

  const dismissHint = useCallback(() => {
    hintLocked.current = true;
    setShowHint(false);
    rememberMapHintSeen();
  }, []);

  useEffect(() => {
    let alive = true;
    void loadMapHintSeen().then((seen) => {
      if (!alive || seen || hintLocked.current) return;
      setShowHint(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (!intent) return;
    if (intent.type === 'focus') {
      const pin = spot.live.find((p) => p.id === intent.pinId);
      if (pin) {
        setLookAt({ lat: pin.lat, lng: pin.lng });
        setFollowToken((n) => n + 1);
        setSelectedId(pin.id);
        setCompose(false);
      }
    } else if (intent.type === 'compose') {
      if (!pro.isPro && spot.remainingPins <= 0) {
        if (pro.adMarksLeft > 0) flash(t('map.watchAdHint'));
        else onOpenPro();
      } else {
        setSelectedId(null);
        setDraft({ lat: spot.location.lat, lng: spot.location.lng });
        setCompose(true);
      }
    }
    onIntentConsumed?.();
  }, [intent]);

  useEffect(() => {
    if (spot.hasGps) setFollowToken((n) => n + 1);
  }, [spot.hasGps]);

  useEffect(() => {
    if (compose) dismissHint();
  }, [compose, dismissHint]);

  useEffect(() => {
    const prev = lastAreaFetch.current;
    if (prev.lat && distanceMeters(prev, spot.location) < 500) return;
    lastAreaFetch.current = spot.location;
    let cancelled = false;
    api
      .lookupPlace(spot.location.lat, spot.location.lng)
      .then((res) => {
        if (!cancelled) setMyArea(res.area || '');
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spot.location.lat, spot.location.lng]);

  const visible = useMemo(
    () =>
      filterPinsByRange(spot.live, spot.location, spot.meId, range, myArea),
    [spot.live, spot.location, spot.meId, range, myArea],
  );

  useEffect(() => {
    if (selectedId && !visible.some((p) => p.id === selectedId)) {
      setSelectedId(null);
    }
  }, [visible, selectedId]);

  useAndroidBack(
    useCallback(() => {
      if (compose) {
        setCompose(false);
        return true;
      }
      if (selectedId) {
        setSelectedId(null);
        return true;
      }
      return false;
    }, [compose, selectedId]),
  );

  useEffect(() => {
    if (!draft) {
      setPlaceName('');
      return;
    }
    let cancelled = false;
    api
      .lookupPlace(draft.lat, draft.lng)
      .then((res) => {
        if (!cancelled) setPlaceName(res.placeName);
      })
      .catch(() => {
        if (!cancelled) setPlaceName('');
      });
    return () => {
      cancelled = true;
    };
  }, [draft]);

  useEffect(() => {
    if (!primedNearby.current) {
      primedNearby.current = true;
      seenPins.current = new Set(spot.live.map((p) => p.id));
      return;
    }
    for (const pin of visible) {
      if (seenPins.current.has(pin.id)) continue;
      seenPins.current.add(pin.id);
      if (pin.authorId === spot.meId) continue;
      const meters = distanceMeters(spot.location, pin);
      flash(
        t('map.nearbyNew', {
          name: pin.placeName || pin.text,
          distance: formatDistance(meters),
        }),
      );
      break;
    }
    for (const pin of spot.live) seenPins.current.add(pin.id);
  }, [visible, spot.live, spot.location, spot.meId]);

  const mapPins = useMemo(
    () =>
      visible.map((p) => {
        const author = spot.profileById(p.authorId);
        return {
          id: p.id,
          lat: p.lat,
          lng: p.lng,
          text: p.text,
          kind: p.kind,
          mine: p.authorId === spot.meId,
          coming: p.coming ?? 0,
          meetLabel: p.kind === 'chat' ? t('map.chat') : formatMeetAt(p.meetAt || p.createdAt),
          featured: Boolean(p.featured),
          socialLeader: Boolean(
            p.anonymous && p.authorId !== spot.meId
              ? false
              : p.socialLeader || author?.socialLeader,
          ),
          authorName:
            p.anonymous && p.authorId !== spot.meId
              ? t('common.anonymous')
              : author?.name || '?',
          photoUrl:
            p.anonymous && p.authorId !== spot.meId ? undefined : author?.photoUrl,
          capacity: p.capacity,
          quotaLabel: p.capacity ? pinQuotaLabel(p) : undefined,
        };
      }),
    [visible, spot.meId, spot.profiles, spot.profileById, t],
  );

  const selected = spot.live.find((p) => p.id === selectedId) ?? null;
  const author = selected ? spot.profileById(selected.authorId) ?? null : null;
  const mine = selected?.authorId === spot.meId;
  const distance = selected
    ? formatDistance(distanceMeters(spot.location, selected))
    : '';
  const myRequest = selected
    ? spot.requests.find(
        (r) => r.pinId === selected.id && r.fromId === spot.meId,
      )
    : undefined;
  const pairChat =
    selected && !mine
      ? liveChatWith(spot.chats, spot.meId, selected.authorId)
      : undefined;
  const incoming = selected && mine
    ? spot.requests
        .filter((r) => r.pinId === selected.id)
        .flatMap((request) => {
          const from = spot.profileById(request.fromId);
          return from ? [{ request, from }] : [];
        })
    : [];

  const helloCount = spot.requests.filter((r) => {
    const pin = spot.pins.find((p) => p.id === r.pinId);
    return pin?.authorId === spot.meId && r.status === 'pending';
  }).length;

  return (
    <View style={styles.fill}>
      <View
        style={[
          styles.mapStage,
          compose || selected ? { pointerEvents: 'none' } : null,
        ]}
        collapsable={false}
      >
        <SpotMap
        center={lookAt || spot.location}
        pins={mapPins}
        places={[]}
        draft={draft}
        followToken={followToken}
        onPinPress={(id) => setSelectedId(id)}
        onDraftMove={(lat, lng) => setDraft({ lat, lng })}
        onPlacePress={() => {}}
        onPlace={(lat, lng, name) => {
          setSelectedId(null);
          setDraft({ lat, lng });
          setPlaceName(name);
          setCompose(true);
        }}
        onView={() => {}}
        onMapClick={(lat, lng) => {
          if (Date.now() - ignoreMapClick.current < 500) return;
          dismissHint();
          setSelectedId(null);
          setDraft({ lat, lng });
          setCompose(true);
        }}
      />
      </View>
      <View style={styles.top}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={styles.hello} numberOfLines={1}>
              {t('map.hello', { name: spot.me.name })}
            </Text>
            <Text style={styles.brand}>{t('map.brand')}</Text>
          </View>
          <LiveClock />
        </View>
        <RadiusChips
          value={range}
          locked={pro.isPro ? [] : ['all']}
          onChange={(next) => {
            if (!pro.canUseRange(next)) {
              onOpenPro();
              return;
            }
            setRange(next);
          }}
        />
        {!compose && !selected ? <AdBanner /> : null}
      </View>
      {helloCount > 0 && !compose && !selected ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('map.incomingHellos')}
          style={styles.helloBanner}
          onPress={onOpenChats}
        >
          <Text style={styles.helloBannerText}>
            {helloCount === 1
              ? t('map.helloOne')
              : t('map.helloMany', { count: helloCount })}
          </Text>
        </Pressable>
      ) : null}
      {showHint && !compose && !selected ? (
        <MapHint visible onDismiss={dismissHint} />
      ) : spot.live.length === 0 && !compose ? (
        <View style={styles.emptyCard} pointerEvents="none">
          <Text style={styles.emptyTitle}>{t('map.emptyTitle')}</Text>
          <Text style={styles.emptyText}>{t('map.emptyText')}</Text>
        </View>
      ) : visible.length === 0 && !compose && !selected ? (
        <View style={styles.emptyCard} pointerEvents="none">
          <Text style={styles.emptyTitle}>{t('map.emptyRangeTitle')}</Text>
          <Text style={styles.emptyText}>
            {range === 'area'
              ? myArea
                ? t('map.emptyAreaNamed', { area: myArea })
                : t('map.emptyArea')
              : t('map.emptyWider')}
          </Text>
        </View>
      ) : !selected && !compose ? (
        <NearbyList
          pins={visible}
          meId={spot.meId}
          origin={spot.location}
          profileById={spot.profileById}
          onOpen={setSelectedId}
        />
      ) : null}
      {selected || compose ? null : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.locate')}
        style={styles.locate}
        onPress={() => {
          void (async () => {
            const ok = await spot.refreshGps();
            if (!ok) {
              flash(t('map.gpsDenied'));
              return;
            }
            setLookAt(null);
            setFollowToken((n) => n + 1);
          })();
        }}
      >
        <LocateIcon color={colors.ink} size={22} />
      </Pressable>
      )}
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      {selected || compose ? null : (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('map.drop')}
        style={styles.fab}
        onPress={() => {
          if (!pro.isPro && spot.remainingPins <= 0) {
            if (ads.adsEnabled && pro.adMarksLeft > 0) flash(t('map.watchAdHint'));
            else onOpenPro();
            return;
          }
          if (!draft) {
            setDraft({ lat: spot.location.lat, lng: spot.location.lng });
          }
          setCompose(true);
        }}
      >
        <PlusIcon color="#fff" size={22} />
      </Pressable>
      )}
      <ComposeSheet
        visible={compose}
        remaining={spot.remainingPins}
        isPro={pro.isPro}
        adMarksLeft={ads.adsEnabled ? pro.adMarksLeft : 0}
        onWatchAd={
          ads.adsEnabled
            ? async () => {
                const ok = await ads.showRewarded();
                if (!ok) return false;
                const res = await pro.claimAdMark();
                if (!res.ok) {
                  flash(res.reason);
                  return false;
                }
                flash(t('map.adGranted'));
                return true;
              }
            : undefined
        }
        onOpenPro={onOpenPro}
        placeName={placeName}
        onClose={() => setCompose(false)}
        onSubmit={async (text, kind: PinKind, meetAt: number, featured: boolean, photoDataUrl?: string, capacity?: 2 | 3 | 4, anonymous?: boolean) => {
          if (!draft) return t('map.pickPlace');
          if (kind === 'chat' && !pro.isPro) {
            onOpenPro();
            return t('map.chatPro');
          }
          if (!pro.isPro && featured) {
            onOpenPro();
            return t('map.featurePro');
          }
          if (!pro.isPro && anonymous) {
            onOpenPro();
            return t('map.anonPro');
          }
          const res = await spot.dropPin(text, kind, draft, {
            meetAt,
            placeName: kind === 'chat' ? undefined : placeName || undefined,
            featured,
            photoDataUrl,
            capacity,
            anonymous,
          });
          if (!res.ok) return res.reason;
          setDraft(null);
          flash(
            kind === 'chat'
              ? t('map.droppedChat')
              : pro.isPro
                ? t('map.droppedPro')
                : t('map.droppedFree'),
          );
          void ads.showInterstitial();
          return null;
        }}
      />
      <PinSheet
        visible={!!selected}
        pin={selected}
        author={author}
        mine={!!mine}
        distance={distance}
        myRequest={myRequest}
        alreadyChatId={pairChat?.id}
        incoming={incoming}
        onClose={() => setSelectedId(null)}
        onOpenChat={() => {
          if (!selected) return;
          const chat =
            pairChat ||
            spot.chats.find(
              (c) => c.pinId === selected.id && c.memberIds.includes(spot.meId),
            );
          if (chat) {
            setSelectedId(null);
            onOpenChat(chat.id);
          }
        }}
        onJoin={async () => {
          if (!selected) return null;
          if (pairChat) {
            setSelectedId(null);
            flash(t('chats.alreadyOpen'));
            onOpenChat(pairChat.id);
            return null;
          }
          const res = await spot.sendJoin(selected.id);
          if (!res.ok) {
            flash(res.reason);
            return res.reason;
          }
          if (res.chatId) {
            setSelectedId(null);
            flash(t('chats.alreadyOpen'));
            onOpenChat(res.chatId);
            return null;
          }
          flash(t('map.joinSent'));
          return null;
        }}
        onWithdraw={async () => {
          if (!myRequest) return;
          const res = await spot.withdrawRequest(myRequest.id);
          flash(res.ok ? t('map.requestWithdrawn') : res.reason);
        }}
        onDecide={async (id, accept) => {
          const { chatId, filled } = await spot.decideRequest(id, accept);
          if (filled) {
            setSelectedId(null);
            flash(t('map.rosterFull'));
          }
          if (chatId) {
            setSelectedId(null);
            onOpenChat(chatId);
          }
        }}
        onClosePin={async () => {
          if (!selected) return;
          const res = await spot.closePin(selected.id);
          setSelectedId(null);
          flash(res.ok ? t('map.markClosed') : res.reason);
        }}
        onBlock={async () => {
          if (!selected) return;
          const res = await spot.blockUser(selected.authorId);
          setSelectedId(null);
          flash(res.ok ? t('map.personBlocked') : res.reason);
        }}
        onReport={async (reason) => {
          if (!selected) return;
          const res = await spot.reportUser(selected.authorId, reason, selected.id);
          flash(res.ok ? t('profile.reported') : res.reason);
        }}
        onOpenProfile={(userId) => {
          if (!selected) return;
          onOpenProfile(userId, selected.id);
        }}
      />
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#D5DDD4', position: 'relative' },
  mapStage: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#D5DDD4',
  },
  top: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: colors.paper,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    gap: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: { color: colors.muted, fontWeight: '600', fontSize: 11 },
  brand: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: 0 },
  locate: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 5,
    zIndex: 12,
  },
  helloBanner: {
    position: 'absolute',
    top: 128,
    left: 16,
    right: 16,
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 8,
  },
  helloBannerText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
  },
  emptyCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 96,
    backgroundColor: 'rgba(12, 9, 22, 0.92)',
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  emptyTitle: { fontWeight: '800', color: '#fff', fontSize: 16 },
  emptyText: { color: 'rgba(255,255,255,0.86)', marginTop: 6, lineHeight: 22 },
  fab: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.coral,
    shadowColor: colors.coral,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 11,
  },
  toast: {
    position: 'absolute',
    top: 124,
    left: 24,
    right: 24,
    backgroundColor: 'rgba(12, 9, 22, 0.94)',
    borderRadius: radius.md,
    padding: 12,
    zIndex: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  toastText: { color: '#fff', textAlign: 'center', fontWeight: '700', lineHeight: 20 },
});
