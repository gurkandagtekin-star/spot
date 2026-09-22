import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

export function LiveClock() {
  const styles = useThemedStyles(createStyles);
  const { i18n } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const loc = String(i18n.language || '').startsWith('tr') ? 'tr-TR' : 'en-US';
  const d = new Date(now);
  const time = d.toLocaleTimeString(loc, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = d.toLocaleDateString(loc, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.time}>{time}</Text>
      <Text style={styles.day}>{day}</Text>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  wrap: { alignItems: 'flex-end' },
  time: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  day: {
    marginTop: 0,
    color: colors.muted,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'capitalize',
  },
});
