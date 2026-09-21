import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { BadgeRow } from './BadgeRow';
import { DragSheet } from './DragSheet';
import { useAlert } from '../context/AlertContext';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { JoinRequest, Pin, Profile } from '../types';
import { formatMeetAt, genderLabel, atHandle, pinFilledCount, pinKindLabel, pinQuotaLabel, remainingLabel } from '../utils';

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
  onWithdraw?: () => void;
  onOpenChat?: () => void;
  onClosePin?: () => void;
  onBlock?: () => void;
  onReport?: (reason: string) => void;
  onOpenProfile?: (userId: string) => void;
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
  onWithdraw,
  onOpenChat,
  onClosePin,
  onBlock,
  onReport,
  onOpenProfile,
}: Props) {
  const { showAlert } = useAlert();
  const styles = useThemedStyles(createStyles);

  if (!visible || !pin || !author) return null;

  const masked = Boolean(pin.anonymous) && !mine;
  const shownName = masked ? 'Anonim' : author.name;
  const shownPhoto = masked ? undefined : author.photoUrl;
  const seatsFull = Boolean(pin.capacity && pinFilledCount(pin) >= pin.capacity);
  const joinLabel =
    myRequest?.status === 'pending'
      ? 'Onay bekleniyor'
      : myRequest?.status === 'accepted'
        ? 'Sohbet açık'
        : seatsFull
          ? 'Kadro doldu'
          : 'Selam gönder';

  return (
    <DragSheet visible onClose={onClose}>
            <Text style={styles.kicker}>
              {pinKindLabel(pin.kind)} · {distance} · {remainingLabel(pin.expiresAt)}
            </Text>
            {pin.kind !== 'chat' && pin.placeName ? (
              <Text style={styles.place}>{pin.placeName}</Text>
            ) : null}
            <Text style={styles.meet}>
              {pin.kind === 'chat'
                ? `Yalnızca mesaj · ${pinQuotaLabel(pin)}`
                : `${formatMeetAt(pin.meetAt)} · ${pinQuotaLabel(pin)}`}
            </Text>
            {pin.photoUrl ? (
              <View style={styles.coverFrame}>
                <Image
                  source={{ uri: pin.photoUrl }}
                  style={styles.cover}
                  resizeMode="contain"
                />
              </View>
            ) : null}
            <Text style={styles.text}>{pin.text}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={masked ? 'Anonim profil' : `${shownName} duvarı`}
              style={styles.card}
              onPress={() => {
                if (masked) {
                  showAlert({
                    title: 'Anonim mark',
                    message: 'Bu mark anonim olarak oluşturulmuş. Profil duvarı gizli.',
                  });
                  return;
                }
                onOpenProfile?.(author.id);
              }}
            >
              <Avatar name={shownName} uri={shownPhoto} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{shownName}</Text>
                {mine && pin.anonymous ? (
                  <Text style={styles.handleTxt}>Haritada Anonim görünüyorsun</Text>
                ) : null}
                {!masked && (author.age || author.gender) ? (
                  <Text style={styles.handleTxt}>
                    {[author.age ? `${author.age}` : '', genderLabel(author.gender)]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                ) : null}
                {!masked && atHandle(author) ? (
                  <Text style={styles.handleTxt}>{atHandle(author)}</Text>
                ) : null}
                {!masked ? (
                  <BadgeRow badges={author.badges} socialLeader={author.socialLeader} />
                ) : null}
                {!masked ? (
                  <Text style={styles.tags}>Duvarı gör →</Text>
                ) : null}
              </View>
            </Pressable>
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
                        <Text style={styles.handleTxt}>
                          {atHandle(from)
                            ? `${atHandle(from)} merhaba dedi`
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
                        <Text style={styles.handleTxt}>
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
            ) : myRequest?.status === 'pending' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="İsteği geri çek"
                style={styles.danger}
                onPress={() => onWithdraw?.()}
              >
                <Text style={styles.dangerText}>İsteği geri çek</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.cta, seatsFull && styles.ctaOff]}
                onPress={() => {
                  if (!seatsFull) void onJoin();
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
    </DragSheet>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    kicker: { color: colors.muted, fontWeight: '700', fontSize: 13, marginBottom: 8 },
    place: { color: colors.ink, fontWeight: '800', fontSize: 16, marginBottom: 4 },
    meet: { color: colors.teal, fontWeight: '700', fontSize: 13, marginBottom: 10 },
    coverFrame: {
      width: '100%',
      aspectRatio: 4 / 5,
      maxHeight: 360,
      borderRadius: 16,
      marginBottom: 14,
      backgroundColor: colors.paperSoft,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cover: {
      width: '100%',
      height: '100%',
    },
    text: { fontSize: 22, fontWeight: '800', color: colors.ink, marginBottom: 16, lineHeight: 28 },
    card: {
      flexDirection: 'row',
      gap: 12,
      backgroundColor: 'rgba(10, 8, 20, 0.55)',
      borderRadius: radius.md,
      padding: 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    name: { fontWeight: '800', color: colors.ink, fontSize: 16 },
    handleTxt: { color: colors.muted, marginTop: 2 },
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
      borderColor: 'rgba(255, 255, 255, 0.12)',
      backgroundColor: 'rgba(10, 8, 20, 0.55)',
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
