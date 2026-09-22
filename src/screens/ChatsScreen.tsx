import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '../components/Avatar';
import { AdBanner } from '../ads/AdsContext';
import { useAlert } from '../context/AlertContext';
import { useSpot } from '../store/SpotContext';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { formatAgo, remainingLabel, atHandle } from '../utils';
import { useTranslation } from 'react-i18next';

type Props = {
  onOpenChat: (chatId: string) => void;
  onOpenMap?: () => void;
};

export function ChatsScreen({ onOpenChat, onOpenMap }: Props) {
  const spot = useSpot();
  const { showAlert } = useAlert();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
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

  const confirmHide = (chatId: string, name: string) => {
    showAlert({
      title: t('chats.deleteTitle'),
      message: t('chats.deleteBody', { name }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      type: 'danger',
      onConfirm: () => {
        void spot.hideChat(chatId);
      },
    });
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={styles.title}>{t('chats.title')}</Text>
        <Text style={styles.lead}>{t('chats.lead')}</Text>
      </View>
      <AdBanner />

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockTitle}>{t('chats.requests')}</Text>
          {incoming.length ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{incoming.length}</Text>
            </View>
          ) : null}
        </View>
        {incoming.length === 0 ? (
          <Text style={styles.quietLine}>{t('chats.noneIncoming')}</Text>
        ) : (
          incoming.map((request) => {
            const from = spot.profileById(request.fromId);
            const pin = spot.pins.find((p) => p.id === request.pinId);
            if (!from || !pin) return null;
            return (
              <View key={request.id} style={styles.requestRow}>
                <Avatar name={from.name} uri={from.photoUrl} size={52} />
                <View style={styles.requestBody}>
                  <Text style={styles.name} numberOfLines={1}>
                    {from.name}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {atHandle(from) ? atHandle(from) : t('chats.saidHi')}
                    {pin.placeName ? ` · ${pin.placeName}` : ''}
                  </Text>
                  <View style={styles.requestActs}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('chats.decline')}
                      style={styles.passBtn}
                      onPress={() => {
                        void spot.decideRequest(request.id, false);
                      }}
                    >
                      <Text style={styles.passTxt}>{t('chats.pass')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('chats.match')}
                      style={styles.matchBtn}
                      onPress={async () => {
                        const { chatId } = await spot.decideRequest(request.id, true);
                        if (chatId) onOpenChat(chatId);
                      }}
                    >
                      <Text style={styles.matchTxt}>{t('chats.match')}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </View>

      {outgoing.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockTitle}>{t('chats.outgoing')}</Text>
          </View>
          {outgoing.map((request) => {
            const pin = spot.pins.find((p) => p.id === request.pinId);
            const author = pin ? spot.profileById(pin.authorId) : undefined;
            const hidden = Boolean(pin?.anonymous);
            const who = hidden ? t('common.anonymous') : author?.name || 'M';
            return (
              <View key={request.id} style={styles.dmRow}>
                <Avatar name={who} uri={hidden ? undefined : author?.photoUrl} size={52} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {hidden ? t('common.anonymous') : author?.name ?? t('common.mark')}
                  </Text>
                  <Text style={styles.preview} numberOfLines={1}>
                    {pin?.text}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('chats.withdrawA11y')}
                  onPress={() => {
                    showAlert({
                      title: t('chats.withdrawTitle'),
                      message: t('chats.withdrawBody'),
                      confirmText: t('chats.withdraw'),
                      cancelText: t('common.cancel'),
                      type: 'danger',
                      onConfirm: () => {
                        void spot.withdrawRequest(request.id);
                      },
                    });
                  }}
                >
                  <Text style={styles.waitTag}>{t('chats.waiting')}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockTitle}>{t('chats.list')}</Text>
          {matches.length ? (
            <Text style={styles.countMuted}>{matches.length}</Text>
          ) : null}
        </View>
        {matches.length === 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chats.goMap')}
            style={styles.emptyCard}
            onPress={onOpenMap}
          >
            <View style={styles.emptyPin}>
              <View style={styles.emptyDot} />
            </View>
            <Text style={styles.emptyTitle}>{t('chats.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('chats.emptyText')}
            </Text>
          </Pressable>
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
                : `${lastMine ? t('chats.youPrefix') : ''}${
                    last.imageUrl || /^data:image\//i.test(last.text)
                      ? t('chats.photo')
                      : last.text
                  }`
              : t('chats.opened');
            const unread = spot.isChatUnread(chat.id);
            const name = other?.name ?? t('nav.chats');
            return (
              <Pressable
                key={chat.id}
                style={styles.dmRow}
                onPress={() => onOpenChat(chat.id)}
                onLongPress={() => confirmHide(chat.id, name)}
              >
                <View style={unread ? styles.avatarRing : undefined}>
                  <Avatar name={name} uri={other?.photoUrl} size={56} />
                </View>
                <View style={styles.dmBody}>
                  <View style={styles.dmTop}>
                    <Text style={[styles.name, unread && styles.nameUnread]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.ago, unread && styles.agoUnread]}>
                      {last ? formatAgo(last.at) : ''}
                    </Text>
                  </View>
                  <Text
                    style={[styles.preview, unread && styles.previewUnread]}
                    numberOfLines={1}
                  >
                    {lastLabel}
                  </Text>
                  <Text style={styles.foot} numberOfLines={1}>
                    {pin?.placeName || t('common.mark')}
                    {' · '}
                    {remainingLabel(chat.closesAt || pin?.expiresAt || Date.now())}
                  </Text>
                </View>
                {unread ? <View style={styles.unreadDot} /> : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('chats.menu')}
                  hitSlop={10}
                  style={styles.moreHit}
                  onPress={() => confirmHide(chat.id, name)}
                >
                  <View style={styles.moreDots}>
                    <View style={styles.moreDot} />
                    <View style={styles.moreDot} />
                    <View style={styles.moreDot} />
                  </View>
                </Pressable>
              </Pressable>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: 'transparent' },
    content: { paddingBottom: 36 },
    head: {
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
    },
    title: { fontSize: 28, fontWeight: '800', color: colors.ink, letterSpacing: -0.4 },
    lead: { color: colors.muted, marginTop: 4, fontSize: 14, fontWeight: '600' },
    block: { marginTop: 6 },
    blockHead: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      gap: 8,
    },
    blockTitle: {
      flex: 1,
      fontWeight: '800',
      color: colors.ink,
      fontSize: 15,
    },
    countMuted: { color: colors.muted, fontWeight: '700', fontSize: 13 },
    badge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#FF5E97',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    badgeTxt: { color: '#fff', fontWeight: '800', fontSize: 11 },
    quietLine: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '600',
      paddingHorizontal: 16,
      paddingBottom: 12,
      lineHeight: 18,
    },
    emptyCard: {
      marginHorizontal: 16,
      marginBottom: 12,
      backgroundColor: colors.paper,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      paddingVertical: 22,
      paddingHorizontal: 18,
      alignItems: 'center',
      gap: 8,
    },
    emptyPin: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.coralSoft,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    emptyDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: colors.coral,
    },
    emptyTitle: {
      fontWeight: '800',
      color: colors.ink,
      fontSize: 16,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
      lineHeight: 20,
    },
    requestRow: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
    },
    requestBody: { flex: 1, minWidth: 0, gap: 8 },
    requestActs: { flexDirection: 'row', gap: 8 },
    passBtn: {
      flex: 1,
      borderRadius: radius.pill,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: colors.chipBg,
    },
    passTxt: { color: colors.chipText, fontWeight: '800', fontSize: 13 },
    matchBtn: {
      flex: 1,
      borderRadius: radius.pill,
      paddingVertical: 8,
      alignItems: 'center',
      backgroundColor: '#FF5E97',
    },
    matchTxt: { color: '#fff', fontWeight: '800', fontSize: 13 },
    dmRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    avatarRing: {
      borderRadius: 32,
      borderWidth: 2,
      borderColor: '#FF5E97',
      padding: 2,
    },
    dmBody: { flex: 1, minWidth: 0 },
    dmTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    name: { fontWeight: '700', color: colors.ink, fontSize: 16, flex: 1 },
    nameUnread: { fontWeight: '900' },
    preview: { color: colors.muted, marginTop: 2, fontSize: 14, fontWeight: '500' },
    previewUnread: { color: colors.ink, fontWeight: '700' },
    foot: { color: colors.muted, fontWeight: '600', fontSize: 12, marginTop: 3 },
    ago: { color: colors.muted, fontSize: 12, fontWeight: '600' },
    agoUnread: { color: '#FF5E97', fontWeight: '800' },
    unreadDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: '#FF5E97',
    },
    waitTag: {
      color: colors.gold,
      fontWeight: '800',
      fontSize: 11,
    },
    moreHit: { width: 22, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
    moreDots: { gap: 3, alignItems: 'center' },
    moreDot: {
      width: 3,
      height: 3,
      borderRadius: 1.5,
      backgroundColor: colors.muted,
    },
  });
