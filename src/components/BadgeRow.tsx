import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BADGE_META, normalizeBadgeId } from '../data/play';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';

export function BadgeRow({
  badges,
  socialLeader,
  neon,
  onPress,
}: {
  badges?: string[];
  socialLeader?: boolean;
  neon?: boolean;
  onPress?: () => void;
}) {
  const { t } = useTranslation();
  const items = [
    ...(socialLeader
      ? [{ key: 'socialLeader', title: t('badges.socialLeader.title'), gold: true }]
      : []),
    ...Array.from(new Set((badges || []).map(normalizeBadgeId))).map((id) => ({
      key: id,
      title: t(`badges.${id}.title`, { defaultValue: BADGE_META[id]?.title || id }),
      gold: false,
    })),
  ];
  const styles = useThemedStyles(createStyles);
  if (!items.length) return null;
  const Wrap = onPress ? Pressable : View;
  return (
    <Wrap
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? t('badges.guideA11y') : undefined}
      onPress={onPress}
      style={styles.row}
    >
      {items.map((item) => (
        <View
          key={item.key}
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
    </Wrap>
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
