import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { FilterChips } from '../components/FilterChips';
import { useAlert } from '../context/AlertContext';
import { AdBanner } from '../ads/AdsContext';
import { usePro } from '../pro/usePro';
import { useSpot } from '../store/SpotContext';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeContext';
import type { Pin, PinKind, Profile } from '../types';
import {
  atHandle,
  distanceMeters,
  displayName,
  filterPinsByRange,
  formatDistance,
  pinFilledCount,
  pinKindLabel,
  pinQuotaLabel,
  remainingLabel,
} from '../utils';

type KindFilter = 'all' | PinKind;

type Props = {
  onShowOnMap: (pinId: string) => void;
  onCompose: () => void;
  onOpenChat: (chatId: string) => void;
  onOpenPro: () => void;
  onOpenProfile: (userId: string, pinId?: string) => void;
};

export function DiscoverScreen({
  onShowOnMap,
  onCompose,
  onOpenChat,
  onOpenPro,
  onOpenProfile,
}: Props) {
  const spot = useSpot();
  const pro = usePro();
  const { showAlert } = useAlert();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [kind, setKind] = useState<KindFilter>('all');
  const [now, setNow] = useState(() => Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const searchSeq = useRef(0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      searchSeq.current += 1;
      setHits([]);
      setSearching(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(() => {
      void (async () => {
        try {
          const people = await spot.searchUsers(q);
          if (seq !== searchSeq.current) return;
          setHits(people);
        } catch {
          if (seq !== searchSeq.current) return;
          setHits([]);
        } finally {
          if (seq === searchSeq.current) setSearching(false);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const nearby = useMemo(
    () =>
      filterPinsByRange(spot.live, spot.location, spot.meId, '5', '').sort(
        (a, b) =>
          distanceMeters(spot.location, a) - distanceMeters(spot.location, b),
      ),
    [spot.live, spot.location, spot.meId],
  );

  const rows = kind === 'all' ? nearby : nearby.filter((p) => p.kind === kind);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const refresh = async () => {
    setRefreshing(true);
    await spot.retryConnection();
    setNow(Date.now());
    setRefreshing(false);
  };

  const onDrop = () => {
    if (!pro.isPro && spot.remainingPins <= 0) {
      if (pro.adMarksLeft > 0) flash('Reklam izleyerek +1 mark açabilirsin.');
      else onOpenPro();
      return;
    }
    onCompose();
  };

  const onJoin = async (pin: Pin) => {
    if (pin.authorId === spot.meId) {
      onShowOnMap(pin.id);
      return;
    }
    const mine = spot.requests.find(
      (r) => r.pinId === pin.id && r.fromId === spot.meId,
    );
    if (mine?.status === 'accepted') {
      const chat = spot.chats.find(
        (c) => c.pinId === pin.id && c.memberIds.includes(spot.meId),
      );
      if (chat) onOpenChat(chat.id);
      return;
    }
    if (mine?.status === 'pending') {
      flash('Onay bekleniyor.');
      return;
    }
    if (pin.capacity && pinFilledCount(pin) >= pin.capacity) {
      flash('Kadro doldu.');
      return;
    }
    const res = await spot.sendJoin(pin.id);
    flash(res.ok ? 'Selam gitti. Onaylarsa sohbet açılır.' : res.reason);
  };

  const searchingNow = query.trim().length > 0;

  return (
    <View style={styles.fill}>
      <View style={styles.top}>
        <View style={styles.searchBar}>
          <SearchGlyph color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Ara"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={styles.searchInput}
          />
        </View>
        {searchingNow ? null : (
          <>
            <Text style={styles.title}>Şu an yakınında</Text>
            <FilterChips
              scroll
              value={kind}
              onChange={setKind}
              options={[
                { id: 'all', label: 'Tümü' },
                { id: 'hangout', label: 'Takılalım' },
                { id: 'activity', label: 'Aktivite' },
                { id: 'chat', label: 'Sohbet' },
              ]}
            />
          </>
        )}
      </View>
      <AdBanner />
      {searchingNow ? (
        <FlatList
          data={hits}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={hits.length ? styles.list : styles.emptyList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>
                {searching ? 'Aranıyor…' : 'Kullanıcı yok'}
              </Text>
              <Text style={styles.emptyText}>
                {searching
                  ? 'Kullanıcı adına bakıyoruz.'
                  : 'Başka bir @kullanıcı adı veya isim dene.'}
              </Text>
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${displayName(item) || item.name} profili`}
              style={styles.userRow}
              onPress={() => onOpenProfile(item.id)}
            >
              <Avatar
                name={displayName(item) || item.name || item.username}
                uri={item.photoUrl}
                size={48}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} numberOfLines={1}>
                  {displayName(item) || item.name || item.username}
                </Text>
                {atHandle(item) ? (
                  <Text style={styles.userHandle} numberOfLines={1}>
                    {atHandle(item)}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          )}
        />
      ) : (
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        contentContainerStyle={rows.length ? styles.list : styles.emptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh()}
            tintColor="#FF5E97"
            colors={['#FF5E97']}
          />
        }
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        ListEmptyComponent={
          nearby.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Yakınında henüz aktif bir Mark yok</Text>
            <Text style={styles.emptyText}>İlkini sen koy!</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Mark koy"
              style={styles.emptyCta}
              onPress={onDrop}
            >
              <Text style={styles.emptyCtaText}>+ Mark koy</Text>
            </Pressable>
          </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Bu türde yakın mark yok</Text>
              <Text style={styles.emptyText}>Filtreyi Tümü’ye çek veya başka bir tür dene.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <PulseCard
            pin={item}
            now={now}
            meters={distanceMeters(spot.location, item)}
            meId={spot.meId}
            joinLabel={joinLabel(item, spot.meId, spot.requests, spot.chats)}
            authorName={
              item.anonymous && item.authorId !== spot.meId
                ? 'Anonim'
                : spot.profileById(item.authorId)?.name || 'Biri'
            }
            authorPhoto={
              item.anonymous && item.authorId !== spot.meId
                ? undefined
                : spot.profileById(item.authorId)?.photoUrl
            }
            onMap={() => onShowOnMap(item.id)}
            onJoin={() => void onJoin(item)}
            onOpenProfile={() => {
              if (item.anonymous && item.authorId !== spot.meId) {
                showAlert({
                  title: 'Anonim mark',
                  message: 'Bu mark anonim olarak oluşturulmuş. Profil duvarı gizli.',
                });
                return;
              }
              onOpenProfile(item.authorId, item.id);
            }}
          />
        )}
      />
      )}
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

function SearchGlyph({ color }: { color: string }) {
  return (
    <View style={{ width: 18, height: 18 }}>
      <View
        style={{
          width: 12,
          height: 12,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: 7,
          height: 2,
          backgroundColor: color,
          borderRadius: 1,
          right: 0,
          bottom: 1,
          transform: [{ rotate: '45deg' }],
        }}
      />
    </View>
  );
}

function joinLabel(
  pin: Pin,
  meId: string,
  requests: { pinId: string; fromId: string; status: string }[],
  chats: { pinId: string; memberIds: string[] }[],
) {
  if (pin.authorId === meId) return 'İstek gönder';
  const mine = requests.find((r) => r.pinId === pin.id && r.fromId === meId);
  if (mine?.status === 'accepted') {
    return chats.some((c) => c.pinId === pin.id && c.memberIds.includes(meId))
      ? 'Sohbete git'
      : 'Sohbet açık';
  }
  if (mine?.status === 'pending') return 'Onay bekleniyor';
  if (pin.capacity && pinFilledCount(pin) >= pin.capacity) return 'Kadro doldu';
  return pin.kind === 'chat' ? 'Selam at' : 'Katıl';
}

function PulseCard({
  pin,
  now,
  meters,
  meId,
  joinLabel: cta,
  authorName,
  authorPhoto,
  onMap,
  onJoin,
  onOpenProfile,
}: {
  pin: Pin;
  now: number;
  meters: number;
  meId: string;
  joinLabel: string;
  authorName: string;
  authorPhoto?: string;
  onMap: () => void;
  onJoin: () => void;
  onOpenProfile: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const joinOff = cta === 'Onay bekleniyor' || cta === 'Kadro doldu';
  const who = pin.authorId === meId ? 'Sen' : authorName;

  return (
    <Pressable onPress={onMap} style={styles.card}>
      <View style={styles.cardTop}>
        <Pressable onPress={onOpenProfile}>
          <Avatar name={who} uri={authorPhoto} size={44} />
        </Pressable>
        <View style={styles.cardCopy}>
          <Text style={styles.name} numberOfLines={1}>
            {who}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {pinKindLabel(pin.kind)} · {remainingLabel(pin.expiresAt, now)} ·{' '}
            {formatDistance(meters)}
          </Text>
          <Text style={styles.note} numberOfLines={2}>
            {pin.text}
          </Text>
          <Text style={styles.quota} numberOfLines={1}>
            {pinQuotaLabel(pin)}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={cta}
          style={[styles.solid, joinOff && styles.solidOff]}
          onPress={onJoin}
        >
          <Text style={styles.solidText}>{cta}</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    fill: { flex: 1 },
    top: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10, gap: 8 },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      color: colors.ink,
      fontSize: 15,
      fontWeight: '600',
      padding: 0,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.paper,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    userName: { fontWeight: '800', color: colors.ink, fontSize: 16 },
    userHandle: { color: colors.muted, fontWeight: '700', fontSize: 13, marginTop: 2 },
    kicker: {
      color: colors.coral,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      fontSize: 11,
    },
    title: { fontSize: 26, fontWeight: '900', color: colors.ink },
    list: { paddingHorizontal: 16, paddingBottom: 28 },
    emptyList: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 28 },
    empty: {
      marginTop: 48,
      alignItems: 'center',
      paddingHorizontal: 18,
      gap: 8,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.ink,
      textAlign: 'center',
    },
    emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
    emptyCta: {
      marginTop: 10,
      backgroundColor: '#FF5E97',
      borderRadius: radius.pill,
      paddingHorizontal: 22,
      paddingVertical: 12,
    },
    emptyCtaText: { color: '#fff', fontWeight: '900', fontSize: 15 },
    card: {
      backgroundColor: 'rgba(10, 8, 20, 0.55)',
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      padding: 12,
      gap: 12,
    },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    cardCopy: { flex: 1, gap: 3 },
    name: { fontWeight: '800', color: colors.ink, fontSize: 16 },
    meta: { color: colors.muted, fontWeight: '700', fontSize: 12 },
    note: { color: colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 20, marginTop: 2 },
    quota: { color: colors.teal, fontWeight: '800', fontSize: 12 },
    actions: { alignItems: 'center' },
    solid: {
      alignSelf: 'center',
      minWidth: 168,
      paddingHorizontal: 36,
      backgroundColor: colors.coral,
      borderRadius: radius.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    solidOff: { backgroundColor: colors.muted },
    solidText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    toast: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 18,
      backgroundColor: 'rgba(31,26,23,0.92)',
      borderRadius: radius.pill,
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    toastText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  });
