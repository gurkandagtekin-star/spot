import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api';
import { startOAuth } from '../auth/startOAuth';
import { GoogleMark } from '../components/GoogleMark';
import { SignupMapPreview } from '../components/SignupMapPreview';
import { useSpot } from '../store/SpotContext';
import { colors } from '../theme';

export function SignupScreen() {
  const insets = useSafeAreaInsets();
  const spot = useSpot();
  const [error, setError] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState<boolean | null>(null);
  const [ageOk, setAgeOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .providers()
      .then((p) => {
        if (!cancelled) setGoogleReady(p.google);
      })
      .catch(() => {
        if (!cancelled) setGoogleReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={[styles.page, { paddingTop: insets.top + 8 }]}>
      <SignupMapPreview />

      <View style={styles.copy}>
        <Text style={styles.logo}>Mark Date</Text>
        <Text style={styles.headline}>Yüz yüze{'\n'}tanış.</Text>
        <Text style={styles.lead}>
          Konumunu aç, bir saat seç, yakınına mark bırak. İsteyen selam atar;
          ikiniz de onaylarsanız yüz yüze tanışırsınız.
        </Text>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {googleReady === false ? (
          <Text style={styles.warn}>
            Google henüz açık değil. `.env` içine GOOGLE_CLIENT_ID ve
            GOOGLE_CLIENT_SECRET yazıp API’yi yeniden başlat.
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ageOk }}
          style={styles.ageRow}
          onPress={() => setAgeOk((v) => !v)}
        >
          <View style={[styles.box, ageOk && styles.boxOn]} />
          <Text style={styles.ageText}>18 yaşından büyüğüm. Mark Date yüz yüze tanışma içindir.</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Google ile devam et"
          style={[styles.google, (!ageOk || busy) && styles.googleOff]}
          onPress={() => {
            if (!ageOk) {
              setError('Devam etmek için 18 yaşından büyük olduğunu onayla.');
              return;
            }
            setError(null);
            setBusy(true);
            void (async () => {
              try {
                const result = await startOAuth('google');
                if (!result) return;
                if ('cancelled' in result) return;
                if ('error' in result) {
                  setError(result.error);
                  return;
                }
                const signed = await spot.signInWithToken(result.token);
                if (!signed.ok) setError(signed.reason);
              } catch {
                setError('Google penceresi açılamadı.');
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          <GoogleMark />
          <Text style={styles.googleText}>Google ile devam et</Text>
        </Pressable>
        <Text style={styles.fine}>
          Aynı Google her seferinde aynı hesabı açar. 2 saatlik mark, iki taraflı
          onay.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  copy: { paddingHorizontal: 28, paddingTop: 28, gap: 10, flex: 1 },
  logo: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.coral,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headline: {
    fontSize: 40,
    fontWeight: '900',
    color: colors.ink,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  lead: { fontSize: 16, color: colors.muted, lineHeight: 24, maxWidth: 340 },
  footer: { paddingHorizontal: 24, gap: 12 },
  google: {
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E3E3E3',
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  googleOff: { opacity: 0.45 },
  googleText: { color: '#1F1A17', fontWeight: '700', fontSize: 16 },
  ageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 4 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: '#fff',
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  ageText: { flex: 1, color: colors.muted, fontSize: 13, lineHeight: 18 },
  fine: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  warn: {
    color: colors.warning,
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  error: { color: colors.warning, fontWeight: '700', textAlign: 'center' },
});
