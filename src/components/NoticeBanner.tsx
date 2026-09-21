import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import type { AppNotice } from '../types';

type Props = {
  notice: AppNotice;
  onOpen: () => void;
  onDismiss: () => void;
};

export function NoticeBanner({ notice, onOpen, onDismiss }: Props) {
  const styles = useThemedStyles(createStyles);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const id = setTimeout(() => onDismissRef.current(), 7000);
    return () => clearTimeout(id);
  }, [notice.id]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable style={styles.card} onPress={onOpen}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>
            {notice.type === 'message'
              ? 'Mesaj'
              : notice.type === 'accepted'
                ? 'Onay'
                : notice.type === 'filled'
                  ? 'Kadro'
                  : notice.type === 'follow_mark'
                    ? 'Radar'
                    : 'Selam'}
          </Text>
          <Text style={styles.title}>{notice.title}</Text>
          <Text style={styles.body} numberOfLines={2}>
            {notice.body}
          </Text>
        </View>
        <Pressable onPress={onDismiss} hitSlop={10}>
          <Text style={styles.close}>Kapat</Text>
        </Pressable>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    zIndex: 80,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    borderLeftColor: colors.coral,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 10,
  },
  kicker: {
    color: colors.coral,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: { color: colors.ink, fontWeight: '800', fontSize: 15 },
  body: { color: colors.muted, marginTop: 4, lineHeight: 18 },
  close: { color: colors.muted, fontWeight: '700', fontSize: 12 },
});
