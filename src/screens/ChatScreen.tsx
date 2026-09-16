import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Avatar } from '../components/Avatar';
import { suggestionsFor } from '../data/play';
import { useSpot } from '../store/SpotContext';
import { colors, radius } from '../theme';
import { instagramUrl, remainingLabel } from '../utils';

type Props = {
  chatId: string;
  onBack: () => void;
};

export function ChatScreen({ chatId, onBack }: Props) {
  const spot = useSpot();
  const [text, setText] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const chat = spot.chats.find((c) => c.id === chatId);
  const otherId = chat?.memberIds.find((id) => id !== spot.meId);
  const other = otherId ? spot.profileById(otherId) : undefined;
  const pin = chat ? spot.pins.find((p) => p.id === chat.pinId) : undefined;
  const closes = chat?.closesAt || pin?.expiresAt;

  useEffect(() => {
    spot.setViewingChat(chatId);
    return () => spot.setViewingChat(null);
  }, [chatId]);

  useEffect(() => {
    const id = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 80);
    return () => clearTimeout(id);
  }, [chat?.messages.length]);

  if (!chat) {
    return (
      <View style={styles.page}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Geri">
          <Text style={styles.back}>← Eşleşme</Text>
        </Pressable>
        <Text style={styles.empty}>Bu sohbet kapandı. Mark süresi doldu.</Text>
      </View>
    );
  }

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    void spot.sendMessage(chat.id, trimmed);
    setText('');
  };

  const ideas = suggestionsFor(pin?.placeName, pin?.kind);

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.head}>
        <View style={styles.headRow}>
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Geri" hitSlop={8}>
            <Text style={styles.back}>←</Text>
          </Pressable>
          <Avatar name={other?.name || 'S'} size={42} uri={other?.photoUrl} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>
              {other?.name ?? 'Sohbet'}
            </Text>
            <Text style={styles.note} numberOfLines={1}>
              {other?.instagram ? `@${other.instagram}` : 'Kullanıcı adı yok'}
            </Text>
          </View>
          {closes ? (
            <View style={styles.timer}>
              <Text style={styles.timerText}>{remainingLabel(closes)}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.pinCard}>
          <Text style={styles.pinKicker}>{pin?.placeName || 'Mark'}</Text>
          <Text style={styles.pin} numberOfLines={2}>
            {pin ? pin.text : 'Mark haritadan kalktı. Kısa bir süre daha açık.'}
          </Text>
        </View>
        {otherId ? (
          <View style={styles.safety}>
            <Pressable
              style={styles.safetyChip}
              onPress={async () => {
                const res = await spot.startSafeShare(chat.id);
                if (!res.ok) {
                  Alert.alert('Paylaşılamadı', res.reason);
                  return;
                }
                try {
                  await Share.share({
                    message: `Mark Date: şu an bir buluşmadayım. Konumum bu linkte, yaklaşık 2 saat açık:\n${res.url}`,
                  });
                } catch {
                  await Clipboard.setStringAsync(res.url);
                  Alert.alert('Link kopyalandı', 'Güvendiğin kişiye yapıştır.');
                }
              }}
            >
              <Text style={styles.safetyText}>
                {spot.me.safeShare ? 'Konum açık' : 'Güvenli konum'}
              </Text>
            </Pressable>
            {spot.me.safeShare ? (
              <Pressable
                style={styles.safetyChip}
                onPress={() => void spot.stopSafeShare(chat.id)}
              >
                <Text style={styles.safetyText}>Kapat</Text>
              </Pressable>
            ) : null}
            {other?.instagram ? (
              <Pressable
                style={styles.safetyChip}
                onPress={() => Linking.openURL(instagramUrl(other.instagram))}
              >
                <Text style={[styles.safetyText, { color: colors.instagram }]}>IG</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.safetyChip}
              onPress={async () => {
                const res = await spot.blockUser(otherId);
                if (res.ok) onBack();
              }}
            >
              <Text style={styles.safetyText}>Engelle</Text>
            </Pressable>
            <Pressable
              style={styles.safetyChip}
              onPress={async () => {
                const res = await spot.reportUser(otherId, 'rahatsiz', chat.pinId);
                if (res.ok) {
                  Alert.alert(
                    'Şikayet alındı',
                    'Ekip bakacak. İstersen kişiyi de engelleyebilirsin.',
                  );
                }
              }}
            >
              <Text style={styles.safetyText}>Şikayet</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {chat.needsCheckin ? (
        <View style={styles.checkin}>
          <Text style={styles.checkinTitle}>Buluştunuz mu?</Text>
          <Text style={styles.checkinLead}>
            Sadece aktivite oldu mu. Puan görünmez.
          </Text>
          <View style={styles.checkinRow}>
            <Pressable
              style={styles.yes}
              onPress={() => void spot.checkin(chat.id, true)}
            >
              <Text style={styles.yesText}>Evet</Text>
            </Pressable>
            <Pressable
              style={styles.no}
              onPress={() => void spot.checkin(chat.id, false)}
            >
              <Text style={styles.noText}>Hayır</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.playBar}
      >
        {ideas.map((idea) => (
          <Pressable
            key={idea}
            style={styles.idea}
            onPress={() => void spot.sendMessage(chat.id, idea)}
          >
            <Text style={styles.ideaText} numberOfLines={2}>
              {idea}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={styles.spin}
          onPress={async () => {
            const res = await spot.spinChat(chat.id);
            if (!res.ok) Alert.alert('Çark', res.reason);
          }}
        >
          <Text style={styles.spinText}>Çark</Text>
        </Pressable>
      </ScrollView>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.list}>
        {chat.messages.map((m) => {
          const mine = m.fromId === spot.meId;
          const system = m.fromId === 'system';
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                system && styles.system,
                mine && !system && styles.mine,
              ]}
            >
              <Text
                style={[
                  styles.msg,
                  mine && !system && styles.mineText,
                  system && styles.systemText,
                ]}
              >
                {m.text}
              </Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Nerede, saat kaç?"
          placeholderTextColor={colors.muted}
          style={styles.input}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable style={styles.send} onPress={send}>
          <Text style={styles.sendText}>Gönder</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  head: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 10,
  },
  back: { color: colors.coral, fontWeight: '800', fontSize: 22, width: 28 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 17, fontWeight: '900', color: colors.ink },
  note: { color: colors.muted, marginTop: 1, fontSize: 12, fontWeight: '600' },
  timer: {
    backgroundColor: colors.tealSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timerText: { color: colors.teal, fontWeight: '800', fontSize: 11 },
  pinCard: {
    backgroundColor: colors.paperSoft,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pinKicker: {
    color: colors.teal,
    fontWeight: '800',
    fontSize: 11,
    marginBottom: 2,
  },
  pin: { color: colors.ink, fontWeight: '600', fontSize: 13, lineHeight: 18 },
  safety: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  safetyChip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  safetyText: { color: colors.muted, fontWeight: '700', fontSize: 11 },
  checkin: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.tealSoft,
    borderRadius: radius.md,
    padding: 12,
    gap: 8,
  },
  checkinTitle: { fontWeight: '800', color: colors.ink },
  checkinLead: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  checkinRow: { flexDirection: 'row', gap: 8 },
  yes: {
    flex: 1,
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  yesText: { color: '#fff', fontWeight: '800' },
  no: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.paper,
  },
  noText: { color: colors.muted, fontWeight: '800' },
  playBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  idea: {
    maxWidth: 180,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  ideaText: { color: colors.ink, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  spin: {
    backgroundColor: colors.ink,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  spinText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  list: { padding: 16, gap: 8, paddingBottom: 20, flexGrow: 1 },
  bubble: {
    maxWidth: '78%',
    alignSelf: 'flex-start',
    backgroundColor: colors.paper,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.line,
  },
  mine: {
    alignSelf: 'flex-end',
    backgroundColor: colors.coral,
    borderColor: colors.coral,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 6,
  },
  system: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    maxWidth: '88%',
    paddingVertical: 4,
  },
  msg: { color: colors.ink, lineHeight: 20, fontSize: 15 },
  mineText: { color: '#fff' },
  systemText: { color: colors.muted, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    color: colors.ink,
    backgroundColor: colors.paperSoft,
    fontSize: 15,
  },
  send: {
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 11,
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '800' },
  empty: { padding: 20, color: colors.muted, lineHeight: 22 },
});
