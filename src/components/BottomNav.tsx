import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatTabIcon, DiscoverTabIcon, MapTabIcon, ProfileTabIcon } from './TabIcons';
import { useTheme } from '../theme/ThemeContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';
import type { ColorTokens } from '../theme';
import type { Screen } from '../types';

type Props = {
  current: Exclude<Screen, 'chat'>;
  onChange: (s: Exclude<Screen, 'chat'>) => void;
  chatBadge?: number;
};

const items: {
  key: Exclude<Screen, 'chat'>;
  labelKey: 'nav.discover' | 'nav.map' | 'nav.chats' | 'nav.profile';
  Icon: typeof MapTabIcon;
}[] = [
  { key: 'discover', labelKey: 'nav.discover', Icon: DiscoverTabIcon },
  { key: 'map', labelKey: 'nav.map', Icon: MapTabIcon },
  { key: 'chats', labelKey: 'nav.chats', Icon: ChatTabIcon },
  { key: 'profile', labelKey: 'nav.profile', Icon: ProfileTabIcon },
];

export function BottomNav({ current, onChange, chatBadge = 0 }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingBottom: insets.bottom }]}>
      {items.map((item) => {
        const active = current === item.key;
        const color = active ? colors.ink : colors.muted;
        const label = t(item.labelKey);
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onChange(item.key)}
            style={styles.item}
          >
            <item.Icon color={color} filled={active} size={24} />
            <Text style={[styles.label, active && styles.active]}>{label}</Text>
            {item.key === 'chats' && chatBadge > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{chatBadge > 9 ? '9+' : chatBadge}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      backgroundColor: colors.paper,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      paddingHorizontal: 8,
      paddingTop: 8,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      position: 'relative',
      gap: 2,
      paddingVertical: 4,
    },
    label: {
      fontSize: 10,
      color: colors.muted,
      fontWeight: '700',
    },
    active: { color: colors.ink, fontWeight: '800' },
    badge: {
      position: 'absolute',
      top: -2,
      right: '28%',
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.coral,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: colors.paper,
    },
    badgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '800',
    },
  });
