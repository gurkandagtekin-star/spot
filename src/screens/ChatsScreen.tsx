import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { useSpot } from '../store/SpotContext';
import { colors, radius } from '../theme';
import { formatAgo, remainingLabel } from '../utils';

type Props = {
  onOpenChat: (chatId: string) => void;
};

export function ChatsScreen({ onOpenChat }: Props) {
  const spot = useSpot();
  const incoming = spot.requests.filter((r) => {
    const pin = spot.pins.find((p) => p.id === r.pinId);
    return pin?.authorId === spot.meId && r.status === 'pending';
  });
  const outgoing = spot.requests.filter(
    (r) => r.fromId === spot.meId && r.status === 'pending',
  );
  const matches = [...spot.chats].sort((a, b) => {
    const la = a.messages[a.messages.length - 1]?.at ?? 0;
    const lb = b.messages[b.messages.length - 1]?.at ?? 0;
    return lb - la;
  });

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.kicker}>Mark Date</Text>
      <Text style={styles.title}>Eşleşme</Text>
      <Text style={styles.lead}>
        Selam onaylanınca sohbet açılır. Mark bitince kapanır.
      </Text>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Gelen selam</Text>
        {incoming.length ? (
          <View style={styles.count}>
            <Text style={styles.countText}>{incoming.length}</Text>
          </View>
        ) : null}
      </View>
      {incoming.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>👋</Text>
          <Text style={styles.emptyTitle}>Bekleyen istek yok</Text>
          <Text style={styles.empty}>
            Mark koyduğunda yakındakiler selam atabilir.
          </Text>
        </View>
      ) : (
        incoming.map((request) => {
          const from = spot.profileById(request.fromId);
          const pin = spot.pins.find((p) => p.id === request.pinId);
          if (!from || !pin) return null;
          return (
            <View key={request.id} style={styles.helloCard}>
              <View style={styles.rowTop}>
                <Avatar name={from.name} uri={from.photoUrl} size={52} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{from.name}</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    {from.instagram ? `@${from.instagram}` : 'Kullanıcı adı yok'}
                    {pin.placeName ? ` · ${pin.placeName}` : ''}
                  </Text>
                </View>
              </View>
              <Text style={styles.pin} numberOfLines={2}>
                {pin.text}
              </Text>
              <View style={styles.row}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Reddet"
                  style={styles.ghost}
                  onPress={() => {
                    void spot.decideRequest(request.id, false);
                  }}
                >
                  <Text style={styles.ghostText}>Geç</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Eşleş"
                  style={styles.cta}
                  onPress={async () => {
                    const id = await spot.decideRequest(request.id, true);
                    if (id) onOpenChat(id);
                  }}
                >
                  <Text style={styles.ctaText}>Eşleş</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {outgoing.length > 0 ? (
        <>
          <Text style={styles.section}>Gönderdiğin</Text>
          {outgoing.map((request) => {
            const pin = spot.pins.find((p) => p.id === request.pinId);
            const author = pin ? spot.profileById(pin.authorId) : undefined;
            return (
              <View key={request.id} style={styles.waitCard}>
                <Avatar name={author?.name || 'M'} uri={author?.photoUrl} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{author?.name ?? 'Mark'}</Text>
                  <Text style={styles.pin} numberOfLines={1}>
                    {pin?.text}
                  </Text>
                </View>
                <Text style={styles.waitTag}>Bekliyor</Text>
              </View>
            );
          })}
        </>
      ) : null}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Sohbetler</Text>
        {matches.length ? (
          <Text style={styles.quiet}>{matches.length} açık</Text>
        ) : null}
      </View>
      {matches.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>Henüz eşleşme yok</Text>
          <Text style={styles.empty}>
            Karşı taraf onaylayınca burada konuşursunuz.
          </Text>
        </View>
      ) : (
        matches.map((chat) => {
          const otherId = chat.memberIds.find((id) => id !== spot.meId);
          const other = otherId ? spot.profileById(otherId) : undefined;
          const last = chat.messages[chat.messages.length - 1];
          const pin = spot.pins.find((p) => p.id === chat.pinId);
          const lastMine = last && last.fromId === spot.meId;
          const lastLabel = last
            ? last.fromId === 'system'
              ? last.text
              : `${lastMine ? 'Sen: ' : ''}${last.text}`
            : 'Sohbet açıldı';
          return (
            <Pressable
              key={chat.id}
              style={styles.chatCard}
              onPress={() => onOpenChat(chat.id)}
            >
              <Avatar name={other?.name || 'S'} uri={other?.photoUrl} size={52} />
              <View style={{ flex: 1 }}>
                <View style={styles.chatTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {other?.name ?? 'Sohbet'}
                  </Text>
                  <Text style={styles.ago}>{last ? formatAgo(last.at) : ''}</Text>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {lastLabel}
                </Text>
                <Text style={styles.foot} numberOfLines={1}>
                  {pin?.placeName || pin?.text || 'Mark bitti'}
                  {' · '}
                  {remainingLabel(chat.closesAt || pin?.expiresAt || Date.now())}
                </Text>
              </View>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 44, gap: 10 },
  kicker: {
    color: colors.coral,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  title: { fontSize: 32, fontWeight: '900', color: colors.ink, marginTop: -4 },
  lead: { color: colors.muted, lineHeight: 20, marginBottom: 6 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  section: { fontWeight: '800', color: colors.ink, fontSize: 15, flex: 1 },
  quiet: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  count: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  empty: { color: colors.muted, lineHeight: 20, fontSize: 13 },
  emptyBox: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'flex-start',
    gap: 6,
  },
  emptyEmoji: { fontSize: 22, marginBottom: 2 },
  emptyTitle: { fontWeight: '800', color: colors.ink, fontSize: 15 },
  helloCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.coralSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.coral,
    gap: 10,
  },
  waitCard: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  waitTag: {
    color: colors.gold,
    fontWeight: '800',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chatCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chatTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rowTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  name: { fontWeight: '800', color: colors.ink, fontSize: 16, flex: 1 },
  meta: { color: colors.muted, marginTop: 2, fontSize: 12, fontWeight: '600' },
  pin: { color: colors.ink, lineHeight: 20, fontSize: 14 },
  preview: { color: colors.muted, marginTop: 3, fontSize: 13 },
  foot: { color: colors.teal, fontWeight: '700', fontSize: 11, marginTop: 4 },
  ago: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 8 },
  cta: {
    flex: 1.2,
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800' },
  ghost: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: 'center',
    backgroundColor: colors.paperSoft,
  },
  ghostText: { color: colors.muted, fontWeight: '700' },
});
