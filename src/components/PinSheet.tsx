import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from './Avatar';
import { BadgeRow } from './BadgeRow';
import { DragSheet } from './DragSheet';
import { useAlert } from '../context/AlertContext';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { JoinRequest, Pin, Profile } from '../types';
import { formatMeetAt, genderLabel, atHandle, pinFilledCount, pinKindLabel, pinQuotaLabel, remainingLabel } from '../utils';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  pin: Pin | null;
  author: Profile | null;
  mine: boolean;
  distance: string;
  myRequest?: JoinRequest;
  alreadyChatId?: string;
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
  alreadyChatId,
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
  const { t } = useTranslation();

  if (!visible || !pin || !author) return null;

  const masked = Boolean(pin.anonymous) && !mine;
  const shownName = masked ? t('common.anonymous') : author.name;
  const shownPhoto = masked ? undefined : author.photoUrl;
  const seatsFull = Boolean(pin.capacity && pinFilledCount(pin) >= pin.capacity);
  const joinLabel =
    myRequest?.status === 'pending'
      ? t('discover.waiting')
      : myRequest?.status === 'accepted' || alreadyChatId
        ? t('discover.chatOpen')
        : seatsFull
          ? t('discover.fullCta')
          : t('discover.sayHi');

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
                ? `${t('kind.chat')} · ${pinQuotaLabel(pin)}`
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
              accessibilityLabel={
                masked ? t('pin.anonProfile') : t('pin.wallA11y', { name: shownName })
              }
              style={styles.card}
              onPress={() => {
                if (masked) {
                  showAlert({
                    title: t('discover.anonTitle'),
                    message: t('discover.anonBody'),
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
                  <Text style={styles.handleTxt}>{t('pin.anonOnMap')}</Text>
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
                  <Text style={styles.tags}>{t('pin.seeWall')}</Text>
                ) : null}
              </View>
            </Pressable>
            {mine ? (
              <View style={{ gap: 10, marginTop: 8 }}>
                <Text style={styles.section}>{t('pin.requests')}</Text>
                {incoming.length === 0 ? (
                  <Text style={styles.empty}>{t('pin.noRequests')}</Text>
                ) : (
                  incoming.map(({ request, from }) => (
                    <View key={request.id} style={styles.req}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{from.name}</Text>
                        <Text style={styles.handleTxt}>
                          {atHandle(from)
                            ? t('pin.saidHiHandle', { handle: atHandle(from) })
                            : t('pin.saidHiName', { name: from.name })}
                        </Text>
                      </View>
                      {request.status === 'pending' ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('pin.reject')}
                            style={styles.smallGhost}
                            onPress={() => onDecide(request.id, false)}
                          >
                            <Text style={styles.smallGhostText}>{t('pin.no')}</Text>
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={t('pin.approve')}
                            style={styles.smallCta}
                            onPress={() => onDecide(request.id, true)}
                          >
                            <Text style={styles.smallCtaText}>{t('pin.approveCta')}</Text>
                          </Pressable>
                        </>
                      ) : (
                        <Text style={styles.handleTxt}>
                          {request.status === 'accepted' ? t('pin.accepted') : t('pin.declined')}
                        </Text>
                      )}
                    </View>
                  ))
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('pin.deleteMark')}
                  style={styles.danger}
                  onPress={onClosePin}
                >
                  <Text style={styles.dangerText}>{t('pin.deleteMark')}</Text>
                </Pressable>
              </View>
            ) : (myRequest?.status === 'accepted' || alreadyChatId) && onOpenChat ? (
              <Pressable style={styles.cta} onPress={onOpenChat}>
                <Text style={styles.ctaText}>{t('pin.goChat')}</Text>
              </Pressable>
            ) : myRequest?.status === 'pending' ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('pin.withdraw')}
                style={styles.danger}
                onPress={() => onWithdraw?.()}
              >
                <Text style={styles.dangerText}>{t('pin.withdraw')}</Text>
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
                  <Text style={styles.safetyText}>{t('pin.block')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => onReport?.('rahatsiz')}
                  style={styles.safetyBtn}
                >
                  <Text style={styles.safetyText}>{t('pin.report')}</Text>
                </Pressable>
              </View>
            ) : null}
            {!mine && myRequest?.status !== 'accepted' ? (
              <Text style={styles.hint}>
                {t('pin.noDm')}
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
