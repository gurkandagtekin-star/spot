import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { googleClientId, startGoogleSignIn } from '../auth/startOAuth';
import { GoogleMark } from '../components/GoogleMark';
import { SignupBackground } from '../components/SignupBackground';
import { PRIVACY_BODY, PRIVACY_TITLE, TERMS_BODY, TERMS_TITLE } from '../legal/copy';
import { useSpot } from '../store/SpotContext';
import { radius } from '../theme';

const WEB_CLIENT_ID = googleClientId();

export function SignupScreen() {
  const insets = useSafeAreaInsets();
  const spot = useSpot();
  const [error, setError] = useState<string | null>(null);
  const [ageOk, setAgeOk] = useState(false);
  const [legalOk, setLegalOk] = useState(false);
  const [legal, setLegal] = useState<'terms' | 'privacy' | null>(null);
  const [busy, setBusy] = useState(false);
  const finishing = useRef(false);
  const googleReady = Boolean(WEB_CLIENT_ID);
  const canGo = ageOk && legalOk && googleReady && !busy;

  const onGoogle = async () => {
    if (!ageOk) {
      setError('Devam etmek için 18 yaşından büyük olduğunu onayla.');
      return;
    }
    if (!legalOk) {
      setError('Devam etmek için şartları ve gizlilik metnini kabul et.');
      return;
    }
    if (!googleReady) {
      setError('Google hazır değil. Biraz bekle.');
      return;
    }
    if (finishing.current) return;
    finishing.current = true;
    setError(null);
    setBusy(true);
    try {
      const result = await startGoogleSignIn();
      if (!result) return;
      if ('cancelled' in result) {
        setError('Google kapandı. Tekrar dene.');
        return;
      }
      if ('error' in result) {
        setError(result.error);
        return;
      }
      const signed = await spot.signInWithToken(result.token);
      if (!signed.ok) setError(signed.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google girişi başarısız.');
    } finally {
      finishing.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.page}>
      <SignupBackground />
      <View
        style={{
          flex: 1,
          backgroundColor: 'transparent',
          justifyContent: 'space-between',
          paddingVertical: 40,
          paddingTop: insets.top + 40,
          paddingBottom: Math.max(insets.bottom, 40),
          paddingHorizontal: 28,
        }}
      >
        <View style={styles.hero}>
          <Text style={styles.logo}>Mark Date</Text>
          <Text style={styles.slogan}>Anı yakala, yüz yüze tanış.</Text>
          <Text style={styles.lead}>
            Haritada bir işaret bırak. İki taraf onaylarsa sohbet anında açılır.
          </Text>
        </View>

        <View style={styles.actions}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {!WEB_CLIENT_ID ? (
            <Text style={styles.warn}>
              Google’a ulaşılamadı. İnternetini kontrol et.
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ageOk }}
            style={styles.ageRow}
            onPress={() => setAgeOk((v) => !v)}
          >
            <View style={[styles.box, ageOk && styles.boxOn]}>
              {ageOk ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={styles.ageText}>18 yaşından büyüğüm.</Text>
          </Pressable>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: legalOk }}
            style={styles.ageRow}
            onPress={() => setLegalOk((v) => !v)}
          >
            <View style={[styles.box, legalOk && styles.boxOn]}>
              {legalOk ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={styles.legalText}>
              Kullanım Şartları ve Gizlilik Politikası’nı kabul ediyorum.
            </Text>
          </Pressable>
          <View style={styles.linkRow}>
            <Pressable onPress={() => setLegal('terms')}>
              <Text style={styles.link}>Kullanım Şartları</Text>
            </Pressable>
            <Text style={styles.linkDot}>·</Text>
            <Pressable onPress={() => setLegal('privacy')}>
              <Text style={styles.link}>Gizlilik Politikası</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Google ile Giriş Yap"
            style={[styles.google, !canGo && styles.googleOff]}
            onPress={() => {
              void onGoogle();
            }}
          >
            <GoogleMark />
            <Text style={styles.googleText}>
              {busy ? 'Bağlanıyor…' : 'Google ile Giriş Yap'}
            </Text>
          </Pressable>
          <Text style={styles.fine}>
            İşaretler 2 saatte kaybolur. Gizlilik ve onay esastır.
          </Text>
        </View>
      </View>

      <Modal visible={Boolean(legal)} transparent animationType="fade">
        <View style={styles.legalFrame}>
          <View style={[styles.legalCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.legalTitle}>
              {legal === 'privacy' ? PRIVACY_TITLE : TERMS_TITLE}
            </Text>
            <ScrollView style={styles.legalScroll}>
              <Text style={styles.legalBody}>
                {legal === 'privacy' ? PRIVACY_BODY : TERMS_BODY}
              </Text>
            </ScrollView>
            <Pressable style={styles.legalClose} onPress={() => setLegal(null)}>
              <Text style={styles.legalCloseTxt}>Kapat</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#0A0A0A' },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1.4,
    textAlign: 'center',
  },
  slogan: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  lead: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
    marginTop: 4,
  },
  actions: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
    gap: 14,
  },
  google: {
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    gap: 10,
  },
  googleOff: { opacity: 0.45 },
  googleText: { color: '#000000', fontWeight: '700', fontSize: 16 },
  ageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 10,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: '#FF5E97', borderColor: '#FF5E97' },
  check: { color: '#fff', fontWeight: '900', fontSize: 13 },
  ageText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  legalText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 20 },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: -6,
  },
  linkDot: { color: 'rgba(255,255,255,0.35)', fontWeight: '800' },
  link: {
    color: '#FF5E97',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  fine: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.78)',
    fontSize: 12,
    lineHeight: 17,
  },
  warn: {
    color: '#FFD6A8',
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 13,
  },
  error: { color: '#FFD6A8', fontWeight: '700', textAlign: 'center' },
  legalFrame: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  legalCard: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 22,
    paddingTop: 22,
    maxHeight: '78%',
  },
  legalTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 12 },
  legalScroll: { marginBottom: 16 },
  legalBody: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 23 },
  legalClose: {
    backgroundColor: '#FF5E97',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  legalCloseTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
