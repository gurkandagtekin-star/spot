import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Avatar } from '../components/Avatar';
import { pickProfilePhoto } from '../media/pickPhoto';
import { useSpot } from '../store/SpotContext';
import { colors, radius } from '../theme';
import { normalizeHandle } from '../utils';

export function OnboardingScreen() {
  const spot = useSpot();
  const [step, setStep] = useState(0);
  const [handle, setHandle] = useState(spot.me.instagram || '');
  const [name, setName] = useState(spot.me.name);
  const [bio, setBio] = useState(
    spot.me.bio === 'Yüz yüze tanışmayı seviyorum.' ? '' : spot.me.bio,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ageOk, setAgeOk] = useState(false);

  const photo = async () => {
    setError(null);
    try {
      const picked = await pickProfilePhoto();
      if (!picked) return;
      const res = await spot.uploadPhoto(picked.dataUrl);
      if (!res.ok) setError(res.reason);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fotoğraf seçilemedi.');
    }
  };

  const saveHandle = async (raw: string) => {
    const next = normalizeHandle(raw);
    if (next === null) {
      setError('Kullanıcı adı harf, rakam, nokta veya alt çizgi; en fazla 30.');
      return false;
    }
    try {
      await spot.setMyProfile({ instagram: next });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kullanıcı adı kaydedilemedi.');
      return false;
    }
  };

  return (
    <View style={styles.page}>
      <Text style={styles.kicker}>Adım {step + 1} / 4</Text>
      {step === 0 ? (
        <>
          <Text style={styles.title}>Kullanıcı adın</Text>
          <Text style={styles.lead}>
            Instagram’daki adın gibi. Zorunlu değil; kartta köprü olur, doğrulama
            yok. İstersen boş bırak.
          </Text>
          <Text style={styles.label}>@kullanıcı</Text>
          <View style={styles.handleRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              value={handle}
              onChangeText={(v) => setHandle(v.replace(/^@/, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="kullaniciadi"
              placeholderTextColor={colors.muted}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
            />
          </View>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Text style={styles.title}>Yüzün görünsün</Text>
          <Text style={styles.lead}>
            Karşı taraf seni tanısın. Galeriden bir kare seç; Google fotoğrafın
            da durur.
          </Text>
          <Pressable onPress={() => void photo()} style={styles.photoWrap}>
            <Avatar name={spot.me.name} uri={spot.me.photoUrl} size={112} />
            <Text style={styles.photoHint}>Galeriden seç</Text>
          </Pressable>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Text style={styles.title}>Seni tanıyalım</Text>
          <Text style={styles.lead}>Adın ve bir cümle. Uzun hikaye yok.</Text>
          <Text style={styles.label}>Ad</Text>
          <TextInput value={name} onChangeText={setName} style={styles.input} />
          <Text style={styles.label}>Kısa tanıtım</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Kahve, sahil, yeni insan…"
            placeholderTextColor={colors.muted}
            multiline
            style={[styles.input, { minHeight: 90, textAlignVertical: 'top' }]}
          />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Text style={styles.title}>İlk mark’ını koy</Text>
          <Text style={styles.lead}>
            Haritada bir kahve, park veya sokak seç. Ne yapmak istediğini yaz.
            Karşı taraf onaylarsa sohbet açılır.
          </Text>
          <View style={styles.tips}>
            <Text style={styles.tip}>Mekan ikonuna bas, yer adı gelir.</Text>
            <Text style={styles.tip}>İstemezsen mark’ı silebilirsin.</Text>
            <Text style={styles.tip}>Rahatsız eden olursa engelle / şikayet et.</Text>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: ageOk }}
            style={styles.ageRow}
            onPress={() => setAgeOk((v) => !v)}
          >
            <View style={[styles.box, ageOk && styles.boxOn]} />
            <Text style={styles.ageText}>
              18 yaşından büyüğüm. Yüz yüze tanışma için kullanacağım.
            </Text>
          </Pressable>
        </>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.footer}>
        {step <= 1 ? (
          <Pressable
            onPress={async () => {
              setError(null);
              if (step === 0) {
                setBusy(true);
                const ok = await saveHandle(handle);
                setBusy(false);
                if (!ok) return;
                setStep(1);
                return;
              }
              setStep(2);
            }}
          >
            <Text style={styles.skip}>Şimdilik geç</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={styles.cta}
          disabled={busy}
          onPress={async () => {
            setError(null);
            if (step === 0) {
              setBusy(true);
              const ok = await saveHandle(handle);
              setBusy(false);
              if (ok) setStep(1);
              return;
            }
            if (step === 1) {
              setStep(2);
              return;
            }
            if (step === 2) {
              if (name.trim().length < 2) {
                setError('En az 2 harflik bir ad yaz.');
                return;
              }
              setBusy(true);
              try {
                await spot.setMyProfile({
                  name: name.trim(),
                  bio: bio.trim() || 'Yüz yüze tanışmayı seviyorum.',
                });
                setStep(3);
              } catch {
                setError('Kaydedilemedi.');
              }
              setBusy(false);
              return;
            }
            if (!ageOk) {
              setError('Haritaya geçmek için 18 yaşını onayla.');
              return;
            }
            setBusy(true);
            const res = await spot.finishOnboarding();
            setBusy(false);
            if (!res.ok) setError(res.reason);
          }}
        >
          <Text style={styles.ctaText}>
            {step === 0
              ? handle.trim()
                ? 'Kaydet ve devam'
                : 'Boş bırak, devam'
              : step === 1
                ? 'Devam'
                : step === 2
                  ? 'Kaydet ve devam'
                  : 'Haritaya geç'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent', padding: 24, paddingTop: 36 },
  kicker: {
    color: colors.coral,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 12,
    marginBottom: 10,
  },
  title: { fontSize: 30, fontWeight: '900', color: colors.ink, marginBottom: 10 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 22 },
  photoWrap: { alignItems: 'center', gap: 12, marginTop: 12 },
  photoHint: { color: colors.coral, fontWeight: '800' },
  label: { fontWeight: '700', color: colors.ink, marginBottom: 6, marginTop: 8 },
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingLeft: 12,
    backgroundColor: colors.paper,
  },
  at: { fontWeight: '800', color: colors.muted, fontSize: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: 12,
    color: colors.ink,
    backgroundColor: colors.paper,
    marginBottom: 8,
  },
  tips: { gap: 10 },
  tip: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.ink,
    fontWeight: '600',
  },
  footer: { marginTop: 'auto', gap: 12, paddingBottom: 12 },
  skip: { textAlign: 'center', color: colors.muted, fontWeight: '700' },
  cta: {
    backgroundColor: colors.coral,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  error: { color: colors.warning, fontWeight: '700', marginTop: 8 },
  ageRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    marginTop: 2,
  },
  boxOn: { backgroundColor: colors.coral, borderColor: colors.coral },
  ageText: { flex: 1, color: colors.muted, lineHeight: 20, fontWeight: '600' },
});
