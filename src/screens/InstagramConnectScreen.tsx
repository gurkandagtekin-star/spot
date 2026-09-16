import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startOAuth } from '../auth/startOAuth';
import { useSpot } from '../store/SpotContext';
import { colors, radius } from '../theme';

export function InstagramConnectScreen() {
  const insets = useSafeAreaInsets();
  const spot = useSpot();

  return (
    <View style={[styles.page, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.kicker}>Son adım</Text>
      <Text style={styles.title}>Instagram’ını bağla</Text>
      <Text style={styles.lead}>
        Google ile girdin. Instagram giriş penceresi açılır; kullanıcı adı
        yazılmaz. Token saklamayız, yalnızca genel @adın görünür.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Instagram ile bağla"
        style={styles.ig}
        onPress={() => {
          void (async () => {
            const result = await startOAuth('instagram');
            if (!result || 'cancelled' in result) return;
            if ('error' in result) return;
            await spot.signInWithToken(result.token);
          })();
        }}
      >
        <Text style={styles.igText}>Instagram ile bağla</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Çıkış yap"
        onPress={() => {
          void spot.signOut();
        }}
      >
        <Text style={styles.out}>Çıkış yap</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 24 },
  kicker: {
    color: colors.coral,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontSize: 12,
    marginBottom: 8,
  },
  title: { fontSize: 32, fontWeight: '900', color: colors.ink, marginBottom: 12 },
  lead: { color: colors.muted, fontSize: 16, lineHeight: 24, marginBottom: 28 },
  ig: {
    backgroundColor: colors.instagram,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  igText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  out: {
    textAlign: 'center',
    color: colors.muted,
    fontWeight: '700',
    marginTop: 18,
  },
});
