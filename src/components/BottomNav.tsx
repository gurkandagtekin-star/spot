import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../theme';
import type { Screen } from '../types';

type Props = {
  current: Exclude<Screen, 'chat'>;
  onChange: (s: Exclude<Screen, 'chat'>) => void;
  chatBadge?: number;
};

const items: { key: Exclude<Screen, 'chat'>; label: string }[] = [
  { key: 'map', label: 'Harita' },
  { key: 'chats', label: 'Eşleşme' },
  { key: 'profile', label: 'Profil' },
];

export function BottomNav({ current, onChange, chatBadge = 0 }: Props) {
  return (
    <View style={styles.wrap}>
      {items.map((item) => {
        const active = current === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={() => onChange(item.key)}
            style={styles.item}
          >
            <View style={styles.itemInner}>
              <Text style={[styles.label, active && styles.active]}>{item.label}</Text>
              {active ? <View style={styles.dot} /> : null}
            </View>
            {item.key === 'chats' && chatBadge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{chatBadge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 18,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: radius.md,
    position: 'relative',
  },
  itemInner: { alignItems: 'center', gap: 5 },
  label: {
    fontSize: 13,
    color: colors.muted,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  active: {
    color: colors.ink,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.coral,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: '28%',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
