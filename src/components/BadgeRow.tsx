import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BADGE_META } from '../data/play';
import { colors, radius } from '../theme';

export function BadgeRow({
  badges,
  socialLeader,
}: {
  badges?: string[];
  socialLeader?: boolean;
}) {
  const items = [
    ...(socialLeader ? [{ title: 'Sosyal lider', gold: true }] : []),
    ...(badges || []).map((id) => ({
      title: BADGE_META[id]?.title || id,
      gold: false,
    })),
  ];
  if (!items.length) return null;
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View key={item.title} style={[styles.chip, item.gold && styles.gold]}>
          <Text style={[styles.text, item.gold && styles.goldText]}>
            {item.gold ? '👑 ' : ''}
            {item.title}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
