import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius } from '../theme';
import type { PinKind } from '../types';
import { tonightAt } from '../utils';
import { PIN_TEMPLATES } from '../data/play';

type Props = {
  visible: boolean;
  remaining: number;
  isPro?: boolean;
  placeName?: string;
  onClose: () => void;
  onSubmit: (
    text: string,
    kind: PinKind,
    meetAt: number,
    featured: boolean,
  ) => Promise<string | null> | string | null;
};

const TIMES: { id: string; label: string; at: () => number }[] = [
  { id: 'now', label: 'Şimdi', at: () => Date.now() },
  { id: '1h', label: '1 saat sonra', at: () => Date.now() + 60 * 60 * 1000 },
  { id: '19', label: '19:00', at: () => tonightAt(19) },
  { id: '21', label: '21:00', at: () => tonightAt(21) },
  { id: '22', label: '22:00', at: () => tonightAt(22) },
];

export function ComposeSheet({
  visible,
  remaining,
  isPro,
  placeName,
  onClose,
  onSubmit,
}: Props) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<PinKind>('hangout');
  const [timeId, setTimeId] = useState('now');
  const [featured, setFeatured] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setError(null);
    onClose();
  };

  const submit = async () => {
    const slot = TIMES.find((t) => t.id === timeId) ?? TIMES[0];
    const fail = await onSubmit(text, kind, slot.at(), featured);
    if (fail) {
      setError(fail);
      return;
    }
    setText('');
    setKind('hangout');
    setTimeId('now');
    setFeatured(false);
    setError(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <KeyboardAvoidingView
      style={styles.overlay}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={styles.sheet}>
        <Text style={styles.title}>Buluşma yerini işaretledin</Text>
        <Text style={styles.sub}>
          {placeName ? `${placeName} · ` : ''}
          İğneyi kaydırabilirsin. Mark, saatten 2 saat sonra silinir.{' '}
          {isPro
            ? 'Pro: sınırsız mark.'
            : `Bugün ${remaining} hakkın kaldı.`}
        </Text>
        <View style={styles.kinds}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Takılalım"
            onPress={() => setKind('hangout')}
            style={[styles.kind, kind === 'hangout' && styles.kindOn]}
          >
            <Text style={[styles.kindText, kind === 'hangout' && styles.kindTextOn]}>
              Takılalım
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setKind('activity')}
            style={[styles.kind, kind === 'activity' && styles.kindTeal]}
          >
            <Text style={[styles.kindText, kind === 'activity' && styles.kindTextTeal]}>
              Aktivite
            </Text>
          </Pressable>
        </View>
        <Text style={styles.label}>Hazır kalıp</Text>
        <View style={styles.times}>
          {PIN_TEMPLATES.map((tpl) => (
            <Pressable
              key={tpl.id}
              onPress={() => {
                setKind(tpl.kind);
                setText(tpl.text);
              }}
              style={[styles.time, text === tpl.text && styles.timeOn]}
            >
              <Text style={[styles.timeText, text === tpl.text && styles.timeTextOn]}>
                {tpl.emoji} {tpl.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.label}>Ne zaman?</Text>
        <View style={styles.times}>
          {TIMES.map((slot) => (
            <Pressable
              key={slot.id}
              onPress={() => setTimeId(slot.id)}
              style={[styles.time, timeId === slot.id && styles.timeOn]}
            >
              <Text style={[styles.timeText, timeId === slot.id && styles.timeTextOn]}>
                {slot.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Burada buluşma var, gelmek isteyen yazsın."
          placeholderTextColor={colors.muted}
          style={styles.input}
          multiline
          maxLength={120}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isPro ? (
          <Pressable
            onPress={() => setFeatured((v) => !v)}
            style={[styles.kind, featured && styles.featOn]}
          >
            <Text style={[styles.kindText, featured && styles.featText]}>
              Öne çıkar (Pro)
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mark koy"
          style={styles.cta}
          onPress={submit}
        >
          <Text style={styles.ctaText}>Mark koy</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: 22,
    paddingBottom: 28,
    gap: 10,
  },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontWeight: '700', color: colors.ink, marginTop: 4 },
  kinds: { flexDirection: 'row', gap: 8 },
  kind: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  kindOn: { backgroundColor: colors.coralSoft, borderColor: colors.coral },
  kindTeal: { backgroundColor: colors.tealSoft, borderColor: colors.teal },
  kindText: { color: colors.muted, fontWeight: '700' },
  kindTextOn: { color: colors.coral },
  kindTextTeal: { color: colors.teal },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  timeOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  timeText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
  timeTextOn: { color: '#fff' },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.paperSoft,
    textAlignVertical: 'top',
  },
  error: { color: colors.warning, fontSize: 13 },
  featOn: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  featText: { color: colors.gold },
  cta: {
    backgroundColor: colors.coral,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
