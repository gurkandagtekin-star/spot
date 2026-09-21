import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BADGE_META } from '../data/play';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

export function BadgeRow({
  badges,
  socialLeader,
  neon,
}: {
  badges?: string[];
  socialLeader?: boolean;
  neon?: boolean;
}) {
  const items = [
    ...(socialLeader ? [{ title: 'Sosyal lider', gold: true }] : []),
    ...(badges || []).map((id) => ({
      title: BADGE_META[id]?.title || id,
      gold: false,
    })),
  ];
  const styles = useThemedStyles(createStyles);
  if (!items.length) return null;
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View
          key={item.title}
          style={[
            styles.chip,
            neon && styles.neon,
            item.gold && (neon ? styles.neonGold : styles.gold),
          ]}
        >
          <Text
            style={[
              styles.text,
              neon && styles.neonText,
              item.gold && (neon ? styles.neonGoldText : styles.goldText),
            ]}
          >
            {item.gold ? '👑 ' : ''}
            {item.title}
          </Text>
        </View>
      ))}
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.paperSoft,
  },
  gold: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  text: { fontSize: 11, fontWeight: '800', color: colors.ink },
  goldText: { color: colors.gold },
  neon: {
    backgroundColor: 'rgba(255,94,151,0.14)',
    borderColor: '#FF5E97',
  },
  neonGold: {
    backgroundColor: 'rgba(244,193,110,0.16)',
    borderColor: colors.gold,
  },
  neonText: { color: '#FF5E97' },
  neonGoldText: { color: colors.gold },
});
