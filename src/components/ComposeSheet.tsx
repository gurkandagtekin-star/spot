import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { DragSheet } from './DragSheet';
import { FilterChips } from './FilterChips';
import { TimeWheel } from './TimeWheel';
import { pickMeetupPhoto } from '../media/pickPhoto';
import { useAlert } from '../context/AlertContext';
import { radius, type ColorTokens } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';
import type { PinKind } from '../types';

type Props = {
  visible: boolean;
  remaining: number;
  isPro?: boolean;
  adMarksLeft?: number;
  onWatchAd?: () => Promise<boolean>;
  onOpenPro?: () => void;
  placeName?: string;
  onClose: () => void;
  onSubmit: (
    text: string,
    kind: PinKind,
    meetAt: number,
    featured: boolean,
    photoDataUrl?: string,
    capacity?: 2 | 3 | 4,
    anonymous?: boolean,
  ) => Promise<string | null> | string | null;
};

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function nextSlot() {
  const d = new Date();
  d.setSeconds(0, 0);
  const mins = Math.ceil((d.getMinutes() + 1) / 5) * 5;
  d.setMinutes(mins);
  if (mins >= 60) {
    d.setHours(d.getHours() + 1);
    d.setMinutes(0);
  }
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function meetAtFromClock(hour: number, minute: number) {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMilliseconds(0);
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() < Date.now() - 30 * 1000) {
    d.setDate(d.getDate() + 1);
  }
  return d.getTime();
}

export function ComposeSheet({
  visible,
  remaining,
  isPro,
  adMarksLeft = 0,
  onWatchAd,
  onOpenPro,
  placeName,
  onClose,
  onSubmit,
}: Props) {
  const { showAlert } = useAlert();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PinKind>('hangout');
  const [whenNow, setWhenNow] = useState(true);
  const [clockOpen, setClockOpen] = useState(false);
  const [clock, setClock] = useState(nextSlot);
  const [featured, setFeatured] = useState(false);
  const [seats, setSeats] = useState<'any' | '2' | '3' | '4'>('any');
  const [anonymous, setAnonymous] = useState(false);
  const [photo, setPhoto] = useState<{ uri: string; dataUrl: string } | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const clockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeClockSoon = () => {
    if (clockTimer.current) clearTimeout(clockTimer.current);
    clockTimer.current = setTimeout(() => setClockOpen(false), 900);
  };

  const reset = () => {
    setText('');
    setKind('hangout');
    setWhenNow(true);
    setClockOpen(false);
    setClock(nextSlot());
    setFeatured(false);
    setSeats('any');
    setAnonymous(false);
    setPhoto(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const addPhoto = (source: 'camera' | 'library') => {
    void (async () => {
      if (picking) return;
      setPicking(true);
      setError(null);
      try {
        const picked = await pickMeetupPhoto(source);
        if (picked) setPhoto(picked);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('compose.photoFail'));
      } finally {
        setPicking(false);
      }
    })();
  };

  const pickSource = () => {
    showAlert({
      title: kind === 'chat' ? t('compose.addVisual') : t('compose.meetPhoto'),
      message: kind === 'chat' ? t('compose.visualHint') : t('compose.meetHint'),
      actions: [
        { text: t('common.camera'), onPress: () => addPhoto('camera') },
        { text: t('common.gallery'), onPress: () => addPhoto('library') },
        { text: t('common.cancel'), style: 'cancel' },
      ],
    });
  };

  const submit = async () => {
    if (submitting) return;
    if (kind === 'chat' && !isPro) {
      onOpenPro?.();
      setError(t('map.chatPro'));
      return;
    }
    if (featured && !isPro) {
      onOpenPro?.();
      return;
    }
    if (anonymous && !isPro) {
      onOpenPro?.();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (remaining <= 0) {
        if (adMarksLeft > 0 && onWatchAd) {
          const ok = await onWatchAd();
          if (!ok) return;
        } else {
          onOpenPro?.();
          setError(t('compose.quota'));
          return;
        }
      }
      const meetAt = kind === 'chat' || whenNow ? Date.now() : meetAtFromClock(clock.hour, clock.minute);
      const capacity = seats === 'any' ? undefined : (Number(seats) as 2 | 3 | 4);
      const fail = await onSubmit(
        text,
        kind,
        meetAt,
        featured,
        photo?.dataUrl,
        capacity,
        anonymous,
      );
      if (fail) {
        setError(fail);
        return;
      }
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('compose.quota'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DragSheet
      visible={visible}
      onClose={close}
      keyboard
      dragEnabled={!clockOpen}
      expanded
      footer={
        <>
          {isPro ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: featured }}
              accessibilityLabel={t('compose.feature')}
              onPress={() => setFeatured((v) => !v)}
              style={[styles.featRow, featured && styles.featRowOn]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.featTitle, featured && styles.featTitleOn]}>
                  {t('compose.feature')}
                </Text>
                <Text style={styles.featSub}>{t('compose.featureSub')}</Text>
              </View>
              <Switch
                value={featured}
                onValueChange={setFeatured}
                trackColor={{ false: colors.line, true: '#C084FC' }}
                thumbColor="#fff"
              />
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('compose.featurePro')}
              onPress={() => onOpenPro?.()}
              style={styles.featRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.featTitle}>{t('compose.featurePro')}</Text>
                <Text style={styles.featSub}>{t('compose.featureSubLocked')}</Text>
              </View>
            </Pressable>
          )}
          {isPro ? (
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: anonymous }}
            accessibilityLabel={t('compose.anon')}
            onPress={() => setAnonymous((v) => !v)}
            style={styles.anonRow}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.anonTitle}>{t('compose.anon')}</Text>
              <Text style={styles.anonSub}>
                {t('compose.anonSub')}
              </Text>
            </View>
            <Switch
              value={anonymous}
              onValueChange={setAnonymous}
              trackColor={{ false: colors.line, true: colors.coral }}
              thumbColor="#fff"
            />
          </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('compose.anonPro')}
              onPress={() => onOpenPro?.()}
              style={styles.anonRow}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.anonTitle}>{t('compose.anonPro')}</Text>
                <Text style={styles.anonSub}>
                  {t('compose.anonSubLocked')}
                </Text>
              </View>
            </Pressable>
          )}
          <Text style={styles.label}>{t('compose.notePhoto')}</Text>
          <View style={styles.composer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={photo ? t('compose.changePhoto') : t('compose.addVenuePhoto')}
              style={styles.thumb}
              onPress={pickSource}
              disabled={picking}
            >
              {photo ? (
                <>
                  <Image source={{ uri: photo.uri }} style={styles.thumbImg} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('compose.removePhoto')}
                    hitSlop={8}
                    onPress={() => setPhoto(null)}
                    style={styles.thumbX}
                  >
                    <Text style={styles.thumbXTxt}>×</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.thumbEmpty}>
                  <Text style={styles.thumbPlus}>{picking ? '…' : '＋'}</Text>
                  <Text style={styles.thumbCap}>{t('compose.photoCap')}</Text>
                </View>
              )}
            </Pressable>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                kind === 'chat' ? t('compose.phChat') : t('compose.phMeet')
              }
              placeholderTextColor={colors.muted}
              style={styles.input}
              multiline
              maxLength={120}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={submitting ? t('compose.dropping') : t('compose.drop')}
            accessibilityState={{ disabled: submitting }}
            disabled={submitting}
            style={[styles.cta, submitting && styles.ctaBusy]}
            onPress={() => void submit()}
          >
            {submitting ? (
              <View style={styles.ctaRow}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.ctaText}>{t('compose.dropping')}</Text>
              </View>
            ) : (
              <Text style={styles.ctaText}>
                {remaining <= 0 && adMarksLeft > 0
                  ? t('compose.watchAd')
                  : t('compose.drop')}
              </Text>
            )}
          </Pressable>
        </>
      }
    >
          <Text style={styles.kicker}>{t('compose.kicker')}</Text>
          <Text style={styles.title}>
            {kind === 'chat' ? t('compose.titleChat') : t('compose.titleMeet')}
          </Text>
          {kind !== 'chat' && placeName ? (
            <View style={styles.placeChip}>
              <Text style={styles.placeTxt} numberOfLines={1}>
                {placeName}
              </Text>
            </View>
          ) : null}
          {kind === 'chat' ? (
            <Text style={styles.sub}>
              {t('compose.chatSub')}
              {isPro ? t('compose.chatTtl') : ''}
            </Text>
          ) : (
            <Text style={styles.sub}>
              {t('compose.remaining', { count: remaining })}
              {isPro ? t('compose.ttlPro') : t('compose.ttlFree')}
              {!isPro && adMarksLeft > 0
                ? t('compose.adExtra', { count: adMarksLeft })
                : ''}
            </Text>
          )}

          <Text style={styles.label}>{t('compose.what')}</Text>
          <FilterChips
            wrap
            options={[
              { id: 'hangout', label: t('kind.hangout') },
              { id: 'activity', label: t('kind.activity') },
              { id: 'chat', label: isPro ? t('compose.chatOnly') : t('compose.chatOnlyPro') },
            ]}
            value={kind}
            onChange={(next) => {
              if (next === 'chat' && !isPro) {
                onOpenPro?.();
                return;
              }
              setKind(next);
              if (next === 'chat') {
                setWhenNow(true);
                setClockOpen(false);
              }
            }}
          />
          {kind !== 'chat' ? (
            <>
          <Text style={styles.label}>{t('compose.when')}</Text>
          <View style={styles.whenRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: whenNow }}
              onPress={() => {
                setWhenNow(true);
                setClockOpen(false);
              }}
              style={[styles.whenChip, whenNow && styles.whenChipOn]}
            >
              <Text style={[styles.whenChipTxt, whenNow && styles.whenChipTxtOn]}>
                {t('compose.now')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: !whenNow }}
              onPress={() => {
                if (clockTimer.current) clearTimeout(clockTimer.current);
                setWhenNow(false);
                setClockOpen((open) => !open);
              }}
              style={[styles.clockBtn, !whenNow && styles.clockBtnOn]}
            >
              <Text style={[styles.clockFace, !whenNow && styles.clockFaceOn]}>
                {whenNow ? t('compose.pickTime') : `${pad(clock.hour)}:${pad(clock.minute)}`}
              </Text>
            </Pressable>
          </View>
          {clockOpen && !whenNow ? (
            <View style={styles.wheelCard}>
              <TimeWheel
                key="clock"
                hour={clock.hour}
                minute={clock.minute}
                onChange={(hour, minute) => {
                  setWhenNow(false);
                  setClock({ hour, minute });
                  closeClockSoon();
                }}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('compose.confirmTime')}
                style={styles.wheelDone}
                onPress={() => setClockOpen(false)}
              >
                <Text style={styles.wheelDoneTxt}>{t('common.ok')}</Text>
              </Pressable>
            </View>
          ) : null}
            </>
          ) : null}

          <Text style={styles.label}>{t('compose.howMany')}</Text>
          <FilterChips
            wrap
            options={[
              { id: 'any', label: t('compose.any') },
              { id: '2', label: t('compose.people', { count: 2 }) },
              { id: '3', label: t('compose.people', { count: 3 }) },
              { id: '4', label: t('compose.people', { count: 4 }) },
            ]}
            value={seats}
            onChange={setSeats}
          />

    </DragSheet>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    kicker: {
      color: colors.coral,
      fontWeight: '800',
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      fontSize: 11,
    },
    title: { fontSize: 24, fontWeight: '900', color: colors.ink, marginTop: -4 },
    placeChip: {
      alignSelf: 'flex-start',
      backgroundColor: colors.tealSoft,
      borderRadius: radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    placeTxt: { color: colors.teal, fontWeight: '800', fontSize: 13, maxWidth: 280 },
    sub: { fontSize: 13, color: colors.muted, lineHeight: 18 },
    label: { fontWeight: '800', color: colors.ink, fontSize: 13 },
    whenRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    whenChip: {
      backgroundColor: colors.chipBg,
      borderWidth: 1.5,
      borderColor: colors.chipBg,
      borderRadius: radius.pill,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    whenChipOn: {
      backgroundColor: colors.chipOnBg,
      borderColor: '#FFFFFF',
    },
    whenChipTxt: { color: colors.chipText, fontWeight: '800', fontSize: 14 },
    whenChipTxtOn: { color: colors.chipOnText, fontWeight: '900' },
    clockBtn: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.line,
      backgroundColor: colors.paperSoft,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 14,
      alignItems: 'center',
    },
    clockBtnOn: {
      borderColor: colors.coral,
      backgroundColor: colors.coralSoft,
    },
    clockFace: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.muted,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.6,
    },
    clockFaceOn: { color: colors.ink },
    wheelCard: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      backgroundColor: colors.paperSoft,
      paddingTop: 4,
      paddingBottom: 10,
      paddingHorizontal: 10,
    },
    wheelDone: {
      alignSelf: 'center',
      marginTop: 4,
      backgroundColor: colors.coral,
      borderRadius: radius.pill,
      paddingHorizontal: 22,
      paddingVertical: 8,
    },
    wheelDoneTxt: { color: '#fff', fontWeight: '800', fontSize: 14 },
    composer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      padding: 8,
      backgroundColor: colors.paperSoft,
    },
    thumb: {
      width: 88,
      height: 88,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.paper,
    },
    thumbImg: { width: 88, height: 88 },
    thumbEmpty: {
      width: 88,
      height: 88,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      borderWidth: 1.5,
      borderStyle: 'dashed',
      borderColor: colors.line,
      borderRadius: 12,
    },
    thumbPlus: { color: colors.coral, fontSize: 22, fontWeight: '800' },
    thumbCap: { color: colors.muted, fontSize: 10, fontWeight: '800' },
    thumbX: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(20,18,28,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbXTxt: { color: '#fff', fontSize: 16, fontWeight: '800', marginTop: -1 },
    kind: {
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
      alignSelf: 'flex-start',
    },
    kindText: { color: colors.muted, fontWeight: '700' },
    featRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperSoft,
    },
    featRowOn: {
      borderColor: colors.gold,
      backgroundColor: colors.goldSoft,
    },
    featTitle: { fontWeight: '800', color: colors.ink, fontSize: 14 },
    featTitleOn: { color: colors.gold },
    featSub: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
    input: {
      flex: 1,
      minHeight: 88,
      paddingTop: 8,
      paddingHorizontal: 6,
      fontSize: 16,
      color: colors.ink,
      textAlignVertical: 'top',
    },
    error: { color: colors.warning, fontSize: 13 },
    anonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 4,
    },
    anonTitle: { fontWeight: '800', color: colors.ink, fontSize: 14 },
    anonSub: { color: colors.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
    cta: {
      backgroundColor: colors.coral,
      borderRadius: radius.md,
      paddingVertical: 15,
      alignItems: 'center',
    },
    ctaBusy: { opacity: 0.75 },
    ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  });
