import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Avatar } from './Avatar';
import { BadgeRow } from './BadgeRow';
import { colors, radius } from '../theme';
import type { JoinRequest, Pin, Profile } from '../types';
import { formatMeetAt, instagramUrl, remainingLabel } from '../utils';

type Props = {
  visible: boolean;
  pin: Pin | null;
  author: Profile | null;
  mine: boolean;
  distance: string;
  myRequest?: JoinRequest;
  incoming: { request: JoinRequest; from: Profile }[];
  onClose: () => void;
  onJoin: () => Promise<string | null> | string | null;
  onDecide: (requestId: string, accept: boolean) => void;
  onOpenChat?: () => void;
  onClosePin?: () => void;
  onBlock?: () => void;
  onReport?: (reason: string) => void;
};

export function PinSheet({
  visible,
  pin,
  author,
  mine,
  distance,
  myRequest,
  incoming,
  onClose,
  onJoin,
  onDecide,
  onOpenChat,
  onClosePin,
  onBlock,
  onReport,
}: Props) {
  if (!visible || !pin || !author) return null;

  const joinLabel =
    myRequest?.status === 'pending'
      ? 'Onay bekleniyor'
      : myRequest?.status === 'accepted'
        ? 'Sohbet açık'
        : 'Selam gönder';

  return (
    <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.kicker}>
              {pin.kind === 'activity' ? 'Aktivite' : 'Takılalım'} · {distance} ·{' '}
              {remainingLabel(pin.expiresAt)}
            </Text>
            {pin.placeName ? (
              <Text style={styles.place}>{pin.placeName}</Text>
            ) : null}
            <Text style={styles.meet}>
              {formatMeetAt(pin.meetAt)}
              {pin.coming ? ` · ${pin.coming} kişi geliyor` : ''}
            </Text>
            <Text style={styles.text}>{pin.text}</Text>
            <View style={styles.card}>
              <Avatar name={author.name} uri={author.photoUrl} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{author.name}</Text>
                {author.instagram ? (
                  <Text style={styles.handle}>@{author.instagram}</Text>
                ) : null}
                <Text style={styles.bio}>{author.bio}</Text>
                <BadgeRow badges={author.badges} socialLeader={author.socialLeader} />
                <Text style={styles.tags}>{(author.interests || []).join(' · ')}</Text>
              </View>
            </View>
            {author.instagram ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Instagram profilini aç"
                style={styles.ig}
                onPress={() => Linking.openURL(instagramUrl(author.instagram))}
              >
                <Text style={styles.igText}>Instagram’da aç</Text>
              </Pressable>
            ) : null}
            {mine ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Text style={styles.section}>İstekler</Text>
                {incoming.length === 0 ? (
                  <Text style={styles.empty}>Henüz istek yok. Mark’ın hâlâ haritada.</Text>
                ) : (
                  incoming.map(({ request, from }) => (
                    <View key={request.id} style={styles.req}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{from.name}</Text>
                        <Text style={styles.handle}>
                          {from.instagram
                            ? `@${from.instagram} merhaba dedi`
                            : `${from.name} merhaba dedi`}
                        </Text>
                      </View>
                      {request.status === 'pending' ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="İsteği reddet"
                            style={styles.smallGhost}
                            onPress={() => onDecide(request.id, false)}
                          >
                            <Text style={styles.smallGhostText}>Yok</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="İsteği onayla"
                            style={styles.smallCta}
                            onPress={() => onDecide(request.id, true)}
                          >
                            <Text style={styles.smallCtaText}>Onayla</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Text style={styles.handle}>
                          {request.status === 'accepted' ? 'onaylandı' : 'reddedildi'}
                        </Text>
                      )}
                    </View>
                  ))
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Markı Sil"
                  style={styles.danger}
                  onPress={onClosePin}
                >
                  <Text style={styles.dangerText}>Markı Sil</Text>
                </Pressable>
              </View>
            ) : myRequest?.status === 'accepted' && onOpenChat ? (
              <Pressable style={styles.cta} onPress={onOpenChat}>
                <Text style={styles.ctaText}>Sohbete git</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[
                  styles.cta,
                  myRequest?.status === 'pending' && styles.ctaOff,
                ]}
                onPress={() => {
                  if (myRequest?.status === 'pending') return;
                  void onJoin();
                }}
              >
                <Text style={styles.ctaText}>{joinLabel}</Text>
              </Pressable>
            )}
            {!mine ? (
              <View style={styles.safety}>
                <Pressable onPress={onBlock} style={styles.safetyBtn}>
                  <Text style={styles.safetyText}>Engelle</Text>
                </Pressable>
                <Pressable
                  onPress={() => onReport?.('rahatsiz')}
                  style={styles.safetyBtn}
                >
                  <Text style={styles.safetyText}>Şikayet et</Text>
                </Pressable>
              </View>
            ) : null}
            {!mine && myRequest?.status !== 'accepted' ? (
              <Text style={styles.hint}>
                Direkt mesaj yok. Karşı taraf onaylarsa kısa bir sohbet açılır.
              </Text>
            ) : null}
          </ScrollView>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 30,
  },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  sheet: {
    maxHeight: '78%',
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 22,
    paddingBottom: 28,
  },
  kicker: { color: colors.muted, fontWeight: '700', fontSize: 13, marginBottom: 8 },
  place: { color: colors.ink, fontWeight: '800', fontSize: 16, marginBottom: 4 },
  meet: { color: colors.teal, fontWeight: '700', fontSize: 13, marginBottom: 10 },
  text: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 16, lineHeight: 28 },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.paperSoft,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontWeight: '800', color: colors.coral, fontSize: 20 },
  name: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  handle: { color: colors.muted, marginTop: 2 },
  bio: { color: colors.ink, marginTop: 6, lineHeight: 20 },
  tags: { color: colors.teal, marginTop: 6, fontWeight: '700', fontSize: 12 },
  ig: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.instagram,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  igText: { color: colors.instagram, fontWeight: '800' },
  cta: {
    marginTop: 12,
    backgroundColor: colors.coral,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaOff: { backgroundColor: colors.muted },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  hint: { marginTop: 10, color: colors.muted, fontSize: 13, lineHeight: 18 },
  section: { fontWeight: '800', color: colors.ink, fontSize: 16 },
  empty: { color: colors.muted },
  req: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperSoft,
  },
  smallCta: {
    backgroundColor: colors.coral,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallCtaText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  smallGhost: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallGhostText: { color: colors.muted, fontWeight: '700', fontSize: 12 },
  danger: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  dangerText: { color: colors.warning, fontWeight: '800' },
  safety: { flexDirection: 'row', gap: 8, marginTop: 12 },
  safetyBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: 'center',
  },
  safetyText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
