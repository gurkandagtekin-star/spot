import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

export function Accordion({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={styles.head}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.chev}>{open ? '⌃' : '⌄'}</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.paper,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 10,
    },
    title: { flex: 1, fontWeight: '800', color: colors.ink, fontSize: 16 },
    chev: { color: colors.muted, fontWeight: '600', fontSize: 16 },
    body: {
      paddingHorizontal: 16,
      paddingBottom: 14,
      gap: 8,
      borderTopWidth: 1,
      borderTopColor: colors.line,
      paddingTop: 12,
    },
  });
