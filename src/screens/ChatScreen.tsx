import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { KEYBOARD_SCROLL_PAD, useKeyboardHeight } from '../hooks/useKeyboard';
import {
  FlatList,
  Image,
  Keyboard,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../components/Avatar';
import { useAlert } from '../context/AlertContext';
import { PhotoPeek } from '../components/PhotoPeek';
import { pickChatPhoto, setMediaPickerOpen } from '../media/pickPhoto';
import { useSpot } from '../store/SpotContext';
import { atHandle, remainingLabel } from '../utils';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../types';

type Props = {
  chatId: string;
  onBack: () => void;
  onOpenProfile?: (userId: string, pinId?: string) => void;
};

type Row =
  | { kind: 'day'; id: string; label: string }
  | { kind: 'msg'; id: string; msg: ChatMessage };

function dayLabel(ts: number, t: (key: string) => string, locale: string) {
  const d = new Date(ts);
  const today = new Date();
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return t('time.today');
  const y = new Date(today);
  y.setDate(today.getDate() - 1);
  if (sameDay(d, y)) return t('time.yesterday');
  return d.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function rowsFromMessages(
  messages: ChatMessage[],
  t: (key: string) => string,
  locale: string,
): Row[] {
  const rows: Row[] = [];
  let lastDay = '';
  for (const msg of messages) {
    const label = dayLabel(msg.at, t, locale);
    if (label !== lastDay) {
      lastDay = label;
      rows.push({ kind: 'day', id: `day-${msg.at}`, label });
    }
    rows.push({ kind: 'msg', id: msg.id, msg });
  }
  return rows;
}

export function ChatScreen({ chatId, onBack, onOpenProfile }: Props) {
  const spot = useSpot();
  const { showAlert } = useAlert();
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [peek, setPeek] = useState(false);
  const [sendingPhoto, setSendingPhoto] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const pickingRef = useRef(false);
  const listRef = useRef<FlatList<Row>>(null);
  const kbHeight = useKeyboardHeight();
  useAndroidBack(
    useCallback(() => {
      if (pickingRef.current) return true;
      if (peek) {
        setPeek(false);
        return true;
      }
      onBack();
      return true;
    }, [onBack, peek]),
  );
  const chat = spot.chats.find((c) => c.id === chatId);
  const others = (chat?.memberIds || []).filter((id) => id !== spot.meId);
  const isGroup = others.length > 1;
  const otherId = others[0];
  const other = otherId ? spot.profileById(otherId) : undefined;
  const pin = chat ? spot.pins.find((p) => p.id === chat.pinId) : undefined;
  const closes = chat?.closesAt || pin?.expiresAt;
  const rows = useMemo(
    () => rowsFromMessages(chat?.messages ?? [], t, i18n.language),
    [chat?.messages, t, i18n.language],
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    spot.setViewingChat(chatId);
    return () => spot.setViewingChat(null);
  }, [chatId]);

  useEffect(() => {
    if (chat) spot.markChatRead(chatId);
  }, [chat?.messages.length, chatId]);

  const scrollToLatest = useCallback((animated = true) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  useEffect(() => {
    const id = setTimeout(() => scrollToLatest(false), 80);
    return () => clearTimeout(id);
  }, [chat?.messages.length, scrollToLatest]);

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => scrollToLatest(true), 60);
    });
    return () => show.remove();
  }, [scrollToLatest]);

  if (!chat) {
    return (
      <View style={styles.page}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <Text style={styles.empty}>{t('chat.closed')}</Text>
      </View>
    );
  }

  const groupTitle =
    pin?.placeName || t('chats.group', { count: chat.memberIds.length });
  const title = isGroup ? groupTitle : other?.name ?? t('kind.chat');
  const canSend = Boolean(text.trim()) && !sendingPhoto;
  const active = Boolean(closes && closes > now);
  const place = pin?.kind === 'chat' ? null : pin?.placeName;
  const subtitle = [place || null, active ? t('chat.active') : remainingLabel(closes || 0, now) || t('chat.ended')]
    .filter(Boolean)
    .join('  •  ');

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    const res = await spot.sendMessage(chat.id, trimmed);
    if (!res.ok) {
      setText(trimmed);
      showAlert({ title: t('chat.message'), message: res.reason });
      return;
    }
    scrollToLatest(true);
  };

  const sendPhoto = async (source: 'camera' | 'library') => {
    if (pickingRef.current || sendingPhoto) return;
    pickingRef.current = true;
    setMediaPickerOpen(true);
    try {
      const targetId = chat.id;
      const picked = await pickChatPhoto(source);
      if (!picked?.dataUrl || picked.dataUrl.length < 80) {
        if (picked) showAlert({ title: t('chat.photoTitle'), message: t('chat.photoFail') });
        return;
      }
      setSendingPhoto(true);
      const res = await spot.sendMessage(targetId, '', { dataUrl: picked.dataUrl });
      if (!res.ok) showAlert({ title: t('chat.photoTitle'), message: res.reason });
      else scrollToLatest(true);
    } catch (err) {
      showAlert({
        title: source === 'camera' ? t('common.camera') : t('common.gallery'),
        message: err instanceof Error ? err.message : t('chat.openFail'),
      });
    } finally {
      pickingRef.current = false;
      setMediaPickerOpen(false);
      setSendingPhoto(false);
    }
  };

  const attach = () => {
    showAlert({
      title: t('chat.add'),
      message: t('chat.addHint'),
      actions: [
        { text: t('common.camera'), onPress: () => void sendPhoto('camera') },
        { text: t('common.gallery'), onPress: () => void sendPhoto('library') },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    });
  };

  const composerPad = kbHeight > 0 ? 6 : Math.max(insets.bottom, 10);

  return (
    <View style={styles.page}>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            hitSlop={8}
            style={styles.backHit}
          >
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chat.profilePhoto')}
            onPress={() => {
              if (!isGroup) setPeek(true);
            }}
          >
            <Avatar name={title} uri={isGroup ? undefined : other?.photoUrl} size={42} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('chat.openProfile')}
            onPress={() => {
              if (!isGroup && otherId) onOpenProfile?.(otherId, pin?.id);
            }}
            style={{ flex: 1 }}
          >
            <Text style={styles.name} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.note} numberOfLines={1}>
              {subtitle || t('chat.active')}
            </Text>
          </Pressable>
          {otherId && !isGroup ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.menu')}
              hitSlop={8}
              onPress={() => setSafetyOpen((v) => !v)}
              style={styles.menuHit}
            >
              <View style={styles.menuDots}>
                <View style={styles.menuDot} />
                <View style={styles.menuDot} />
                <View style={styles.menuDot} />
              </View>
            </Pressable>
          ) : null}
        </View>
        {otherId && !isGroup && safetyOpen ? (
          <View style={styles.safety}>
            <Pressable
              style={styles.safetyChip}
              onPress={async () => {
                const res = await spot.startSafeShare(chat.id);
                if (!res.ok) {
                  showAlert({ title: t('chat.shareFail'), message: res.reason });
                  return;
                }
                try {
                  await Share.share({
                    message: t('chat.safeShareBody', { url: res.url }),
                  });
                } catch {
                  await Clipboard.setStringAsync(res.url);
                  showAlert({
                    title: t('chat.copiedTitle'),
                    message: t('chat.copiedBody'),
                  });
                }
              }}
            >
              <Text style={styles.safetyText}>
                {spot.me.safeShare ? t('chat.locOn') : t('chat.safeLoc')}
              </Text>
            </Pressable>
            {spot.me.safeShare ? (
              <Pressable
                style={styles.safetyChip}
                onPress={() => void spot.stopSafeShare(chat.id)}
              >
                <Text style={styles.safetyText}>{t('common.close')}</Text>
              </Pressable>
            ) : null}
            {other ? (
              <Pressable
                style={styles.safetyChip}
                onPress={() => onOpenProfile?.(other.id, chat.pinId)}
              >
                <Text style={styles.safetyText}>{atHandle(other) || other.name}</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.safetyChip}
              onPress={() => {
                showAlert({
                  title: t('chat.block'),
                  message: t('chat.blockBody', {
                    name: other?.name || t('chat.thisPerson'),
                  }),
                  confirmText: t('chat.block'),
                  cancelText: t('common.cancel'),
                  type: 'danger',
                  onConfirm: () => {
                    void (async () => {
                      const res = await spot.blockUser(otherId);
                      if (res.ok) onBack();
                    })();
                  },
                });
              }}
            >
              <Text style={styles.safetyText}>{t('chat.block')}</Text>
            </Pressable>
            <Pressable
              style={styles.safetyChip}
              onPress={() => {
                showAlert({
                  title: t('chat.reportTitle'),
                  message: t('chat.reportBody'),
                  confirmText: t('common.send'),
                  cancelText: t('common.cancel'),
                  onConfirm: () => {
                    void (async () => {
                      const res = await spot.reportUser(otherId, 'rahatsiz', chat.pinId);
                      if (res.ok) {
                        showAlert({
                          title: t('chat.reportedTitle'),
                          message: t('chat.reportedBody'),
                        });
                      }
                    })();
                  },
                });
              }}
            >
              <Text style={styles.safetyText}>{t('chat.report')}</Text>
            </Pressable>
            <Pressable
              style={styles.safetyChip}
              onPress={() => {
                showAlert({
                  title: t('chats.deleteTitle'),
                  message: t('chat.deleteBody', {
                    name: other?.name || t('chat.thisPerson'),
                  }),
                  confirmText: t('common.delete'),
                  cancelText: t('common.cancel'),
                  type: 'danger',
                  onConfirm: () => {
                    void (async () => {
                      const res = await spot.hideChat(chat.id);
                      if (res.ok) onBack();
                    })();
                  },
                });
              }}
            >
              <Text style={[styles.safetyText, { color: '#FF8A9B' }]}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={[styles.body, { paddingBottom: kbHeight }]}>
          {chat.needsCheckin ? (
            <View style={styles.checkin}>
              <Text style={styles.checkinTitle}>{t('chat.checkin')}</Text>
              <View style={styles.checkinRow}>
                <Pressable style={styles.yes} onPress={() => void spot.checkin(chat.id, true)}>
                  <Text style={styles.yesText}>{t('chat.yes')}</Text>
                </Pressable>
                <Pressable style={styles.no} onPress={() => void spot.checkin(chat.id, false)}>
                  <Text style={styles.noText}>{t('chat.no')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          <FlatList
            ref={listRef}
            style={styles.thread}
            data={rows}
            keyExtractor={(item) => item.id}
            ListHeaderComponent={
              <View style={styles.infoBanner}>
                <Text style={styles.infoBannerTxt}>
                  {t('chat.liveHint')}
                </Text>
              </View>
            }
            contentContainerStyle={[
              styles.list,
              { paddingBottom: kbHeight > 0 ? KEYBOARD_SCROLL_PAD : 16 },
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets={false}
            onContentSizeChange={() => scrollToLatest(true)}
            renderItem={({ item }) => {
              if (item.kind === 'day') {
                return (
                  <View style={styles.dayWrap}>
                    <View style={styles.dayPill}>
                      <Text style={styles.day}>{item.label}</Text>
                    </View>
                  </View>
                );
              }
              const m = item.msg;
              const mine = m.fromId === spot.meId;
              const system = m.fromId === 'system';
              const loc = String(i18n.language || '').startsWith('tr') ? 'tr-TR' : 'en-US';
              const time = new Date(m.at).toLocaleTimeString(loc, {
                hour: '2-digit',
                minute: '2-digit',
              });
              const photo =
                m.imageUrl ||
                (m.text && /^data:image\//i.test(m.text) ? m.text : '');
              const caption =
                m.text &&
                m.text !== t('chat.photoSentinel') &&
                m.text !== '📷 Fotoğraf' &&
                !/^data:image\//i.test(m.text)
                  ? m.text
                  : '';
              if (system) {
                return (
                  <View style={styles.system}>
                    <Text style={styles.systemText}>{m.text}</Text>
                  </View>
                );
              }
              return (
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {isGroup && !mine ? (
                    <Text style={styles.fromName} numberOfLines={1}>
                      {spot.profileById(m.fromId)?.name || t('common.someone')}
                    </Text>
                  ) : null}
                  {photo ? (
                    <Image source={{ uri: photo }} style={styles.photo} />
                  ) : null}
                  {caption ? (
                    <Text style={[styles.msg, mine && styles.mineText]}>{caption}</Text>
                  ) : null}
                  <Text style={[styles.stamp, mine && styles.stampMine]}>{time}</Text>
                </View>
              );
            }}
          />
          <View style={[styles.composer, { paddingBottom: composerPad }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('chat.add')}
              style={styles.mediaBtn}
              onPress={attach}
            >
              <Text style={styles.mediaIcon}>＋</Text>
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={sendingPhoto ? t('chat.sendingPhoto') : t('chat.placeholder')}
              placeholderTextColor="rgba(247, 240, 245, 0.42)"
              style={styles.input}
              onSubmitEditing={() => void send()}
              returnKeyType="send"
              blurOnSubmit={false}
              multiline
              maxLength={500}
              editable={!sendingPhoto}
            />
            <Pressable
              style={[styles.send, !canSend && styles.sendOff]}
              onPress={() => void send()}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityLabel={t('common.send')}
            >
              <Text style={styles.sendText}>➤</Text>
            </Pressable>
          </View>
      </View>
      <PhotoPeek
        visible={peek}
        uri={other?.photoUrl}
        name={other?.name ?? t('kind.chat')}
        onClose={() => setPeek(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  body: { flex: 1 },
  head: {
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: 'rgba(16, 10, 24, 0.92)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 94, 151, 0.22)',
    gap: 8,
  },
  backHit: { width: 32, alignItems: 'center', justifyContent: 'center' },
  back: { color: '#FF7AB8', fontWeight: '300', fontSize: 34, lineHeight: 36, marginTop: -2 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 16, fontWeight: '800', color: '#F7F0F5' },
  note: { color: 'rgba(255, 184, 214, 0.82)', marginTop: 1, fontSize: 12, fontWeight: '600' },
  menuHit: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuDots: { gap: 3, alignItems: 'center' },
  menuDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF7AB8',
  },
  safety: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 6 },
  safetyChip: {
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 151, 0.28)',
    backgroundColor: 'rgba(42, 36, 56, 0.85)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  safetyText: { color: '#D8CBE4', fontWeight: '700', fontSize: 11 },
  infoBanner: {
    alignSelf: 'center',
    maxWidth: '86%',
    marginTop: 10,
    marginBottom: 14,
    backgroundColor: 'rgba(244, 193, 110, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 120, 0.35)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoBannerTxt: {
    color: '#F6DE9A',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  checkin: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(30, 18, 40, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 94, 151, 0.28)',
  },
  checkinTitle: { fontWeight: '800', color: '#F7F0F5', fontSize: 13 },
  checkinRow: { flexDirection: 'row', gap: 8 },
  yes: {
    flex: 1,
    backgroundColor: '#FF5E97',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  yesText: { color: '#fff', fontWeight: '800' },
  no: {
    flex: 1,
    backgroundColor: '#2A2438',
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: 'center',
  },
  noText: { color: '#D8CBE4', fontWeight: '800' },
  thread: { flex: 1 },
  list: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 12, flexGrow: 1 },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayPill: {
    backgroundColor: 'rgba(12, 8, 20, 0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  day: {
    color: 'rgba(247, 240, 245, 0.72)',
    fontSize: 11,
    fontWeight: '800',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    marginVertical: 3,
  },
  fromName: {
    color: '#FFB8D6',
    fontWeight: '800',
    fontSize: 11,
    marginBottom: 3,
  },
  theirs: {
    alignSelf: 'flex-start',
    backgroundColor: '#2A2238',
    borderBottomLeftRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF5E97',
    borderBottomRightRadius: 5,
  },
  system: {
    alignSelf: 'center',
    maxWidth: '88%',
    marginVertical: 8,
    paddingHorizontal: 12,
  },
  msg: { color: '#F3EAF4', lineHeight: 21, fontSize: 15.5 },
  mineText: { color: '#fff' },
  systemText: {
    color: 'rgba(247, 240, 245, 0.55)',
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
  photo: {
    width: 220,
    height: 220,
    borderRadius: 12,
    marginBottom: 4,
    backgroundColor: '#1A1224',
  },
  stamp: {
    alignSelf: 'flex-end',
    color: 'rgba(247, 240, 245, 0.45)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
  },
  stampMine: { color: 'rgba(255,255,255,0.78)' },
  composer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: '#140C1C',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 94, 151, 0.18)',
    alignItems: 'flex-end',
  },
  mediaBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2A2238',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  mediaIcon: { fontSize: 20, color: '#FF7AB8', fontWeight: '700' },
  input: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    color: '#F7F0F5',
    backgroundColor: '#24182E',
    fontSize: 16,
    maxHeight: 120,
  },
  send: {
    backgroundColor: '#FF5E97',
    borderRadius: 21,
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendOff: { opacity: 0.35 },
  sendText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  empty: { padding: 20, color: 'rgba(247, 240, 245, 0.65)', lineHeight: 22 },
});
