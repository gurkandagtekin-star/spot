import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ComposeSheet } from '../components/ComposeSheet';
import { LiveClock } from '../components/LiveClock';
import { NearbyList } from '../components/NearbyList';
import { PinSheet } from '../components/PinSheet';
import { SpotMap } from '../components/SpotMap';
import { RadiusChips } from '../components/RadiusChips';
import { api } from '../api';
import { useSpot } from '../store/SpotContext';
import { colors, radius } from '../theme';
import type { MapPlace, PinKind } from '../types';
import {
  distanceMeters,
  filterPinsByRange,
  formatDistance,
  formatMeetAt,
  type PinRange,
} from '../utils';

type Props = {
  onOpenChat: (chatId: string) => void;
  onOpenPro: () => void;
};

export function MapScreen({ onOpenChat, onOpenPro }: Props) {
  const spot = useSpot();
  const [compose, setCompose] = useState(false);
  const [draft, setDraft] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [followToken, setFollowToken] = useState(0);
  const [range, setRange] = useState<PinRange>('5');
  const [myArea, setMyArea] = useState('');
  const seenPins = useRef<Set<string>>(new Set());
  const primedNearby = useRef(false);
  const lastPlaceFetch = useRef({ lat: 0, lng: 0, at: 0 });
  const lastAreaFetch = useRef({ lat: 0, lng: 0 });

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => {
    if (spot.hasGps) setFollowToken((n) => n + 1);
  }, [spot.hasGps]);

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
        `Yakında yeni mark: ${pin.placeName || pin.text} · ${formatDistance(meters)}`,
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
          meetLabel: formatMeetAt(p.meetAt || p.createdAt),
          featured: Boolean(p.featured),
          socialLeader: Boolean(p.socialLeader || author?.socialLeader),
          authorName: author?.name || '?',
          photoUrl: author?.photoUrl,
        };
      }),
    [visible, spot.meId, spot.profiles, spot.profileById],
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
  const incoming = selected && mine
    ? spot.requests
        .filter((r) => r.pinId === selected.id)
        .flatMap((request) => {
          const from = spot.profileById(request.fromId);
          return from ? [{ request, from }] : [];
        })
    : [];

  return (
    <View style={styles.fill}>
      <SpotMap
        center={spot.location}
        pins={mapPins}
        places={places}
        draft={draft}
        followToken={followToken}
        onPinPress={setSelectedId}
        onDraftMove={(lat, lng) => setDraft({ lat, lng })}
        onPlace={(lat, lng, name) => {
          setSelectedId(null);
          setDraft({ lat, lng });
          setPlaceName(name);
          setCompose(true);
        }}
        onView={(lat, lng, zoom) => {
          if (zoom < 13) return;
          const prev = lastPlaceFetch.current;
          const wait = places.length > 0 ? 20000 : 3500;
          if (
            distanceMeters(prev, { lat, lng }) < 380 &&
            Date.now() - prev.at < wait
          ) {
            return;
          }
          lastPlaceFetch.current = { lat, lng, at: Date.now() };
          api
            .lookupPlaces(lat, lng)
            .then((res) => {
              if (res.places?.length) setPlaces(res.places);
            })
            .catch(() => {});
        }}
        onMapClick={(lat, lng) => {
          setSelectedId(null);
          setDraft({ lat, lng });
          setCompose(true);
        }}
      />
      <View style={styles.top}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={styles.hello}>Selam {spot.me.name}</Text>
          <Text style={styles.brand}>Mark Date</Text>
          <Text style={styles.sub}>
            {spot.hasGps ? 'Mekan ikonuna bas veya haritaya dokun' : 'Haritaya dokun, mark koy'}
          </Text>
        </View>
        <LiveClock />
      </View>
      <RadiusChips value={range} onChange={setRange} />
      {spot.live.length === 0 && !compose ? (
        <View style={styles.emptyCard} pointerEvents="none">
          <Text style={styles.emptyTitle}>Buralarda henüz mark yok</Text>
          <Text style={styles.emptyText}>
            İlk buluşmayı sen koy. Kahve, park, bahçe ikonuna bas; mark oraya düşer.
          </Text>
        </View>
      ) : visible.length === 0 && !compose && !selected ? (
        <View style={styles.emptyCard} pointerEvents="none">
          <Text style={styles.emptyTitle}>Bu mesafede açık mark yok</Text>
          <Text style={styles.emptyText}>
            {range === 'area'
              ? myArea
                ? `${myArea} içinde canlı mark yok. Tümü veya daha geniş km dene.`
                : 'Semt yaklaşık 2,5 km. Konumun netleşince mahalle adına göre daralır.'
              : 'Yarıçapı büyüt veya Tümü’ne geç; uzak mark’lar gizleniyor.'}
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Konumuma git"
        style={styles.locate}
        onPress={() => {
          if (!spot.hasGps) {
            flash('Konum izni verilirse seni haritada gösteririz.');
            return;
          }
          setFollowToken((n) => n + 1);
        }}
      >
        <Text style={styles.locateText}>Konumum</Text>
      </Pressable>
      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Mark koy"
        style={styles.fab}
        onPress={() => {
          if (!spot.me.isPro && spot.remainingPins <= 0) {
            onOpenPro();
            return;
          }
          if (!draft) {
            flash('Önce haritada buluşma yerini seç.');
            return;
          }
          setCompose(true);
        }}
      >
        <Text style={styles.fabText}>Mark koy</Text>
      </Pressable>
      <ComposeSheet
        visible={compose}
        remaining={spot.remainingPins}
        isPro={Boolean(spot.me.isPro)}
        placeName={placeName}
        onClose={() => setCompose(false)}
        onSubmit={async (text, kind: PinKind, meetAt: number, featured: boolean) => {
          if (!draft) return 'Önce haritada bir yer işaretle.';
          if (!spot.me.isPro && spot.remainingPins <= 0) {
            onOpenPro();
            return 'Günlük hak doldu.';
          }
          const res = await spot.dropPin(text, kind, draft, {
            meetAt,
            placeName: placeName || undefined,
            featured,
          });
          if (!res.ok) return res.reason;
          setDraft(null);
          flash('Mark haritada. Saatinden 2 saat sonra silinecek.');
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
        incoming={incoming}
        onClose={() => setSelectedId(null)}
        onOpenChat={() => {
          if (!selected) return;
          const chat = spot.chats.find(
            (c) => c.pinId === selected.id && c.memberIds.includes(spot.meId),
          );
          if (chat) {
            setSelectedId(null);
            onOpenChat(chat.id);
          }
        }}
        onJoin={async () => {
          if (!selected) return null;
          const res = await spot.sendJoin(selected.id);
          if (!res.ok) {
            flash(res.reason);
            return res.reason;
          }
          flash('İstek gönderildi. Onaylarsa sohbet açılır.');
          return null;
        }}
        onDecide={async (id, accept) => {
          const chatId = await spot.decideRequest(id, accept);
          if (chatId) {
            setSelectedId(null);
            onOpenChat(chatId);
          }
        }}
        onClosePin={async () => {
          if (!selected) return;
          const res = await spot.closePin(selected.id);
          setSelectedId(null);
          flash(res.ok ? 'Mark kapatıldı.' : res.reason);
        }}
        onBlock={async () => {
          if (!selected) return;
          const res = await spot.blockUser(selected.authorId);
          setSelectedId(null);
          flash(res.ok ? 'Kişi engellendi. Mark’ları senden gizlenir.' : res.reason);
        }}
        onReport={async (reason) => {
          if (!selected) return;
          const res = await spot.reportUser(selected.authorId, reason, selected.id);
          flash(res.ok ? 'Şikayet alındı. Ekip bakacak.' : res.reason);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: 'transparent', position: 'relative' },
  top: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: colors.paper,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hello: { color: colors.muted, fontWeight: '600', fontSize: 12 },
  brand: { fontSize: 20, fontWeight: '900', color: colors.ink, marginTop: 1 },
  sub: { color: colors.muted, fontWeight: '700', fontSize: 12, marginTop: 3 },
  locate: {
    position: 'absolute',
    top: 108,
    right: 16,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  locateText: { color: colors.teal, fontWeight: '800', fontSize: 12 },
  emptyCard: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 96,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  emptyTitle: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  emptyText: { color: colors.muted, marginTop: 6, lineHeight: 20 },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: colors.coral,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: radius.pill,
    shadowColor: colors.coral,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  toast: {
    position: 'absolute',
    top: 158,
    left: 24,
    right: 24,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: 12,
    zIndex: 20,
  },
  toastText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
});
