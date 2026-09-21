import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getApiUrl } from '../api';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

export function ConnectionBanner({
  visible,
  onRetry,
}: {
  visible: boolean;
  onRetry: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  if (!visible) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={styles.title}>Sunucuya ulaşılamadı</Text>
        <Text style={styles.body}>
          {typeof __DEV__ !== 'undefined' && __DEV__
            ? `Yerel API: ${getApiUrl()}. Telefon ve PC aynı Wi‑Fi’de olmalı.`
            : 'İnternetini kontrol et. Mark ve sohbet şu an güncellenmiyor.'}
        </Text>
        <Pressable onPress={onRetry} style={styles.btn}>
          <Text style={styles.btnText}>Tekrar dene</Text>
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 12,
    zIndex: 70,
  },
  card: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: 14,
    gap: 6,
  },
  title: { color: '#fff', fontWeight: '800', fontSize: 14 },
  body: { color: 'rgba(255,255,255,0.75)', lineHeight: 18, fontSize: 13 },
  btn: { alignSelf: 'flex-start', marginTop: 4 },
  btnText: { color: colors.coral, fontWeight: '800' },
});
