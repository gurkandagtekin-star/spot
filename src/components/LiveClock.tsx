import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

export function LiveClock() {
  const styles = useThemedStyles(createStyles);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const d = new Date(now);
  const time = d.toLocaleTimeString('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const day = d.toLocaleDateString('tr-TR', {
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
