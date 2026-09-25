import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DragSheet } from './DragSheet';
import { BADGE_CATALOG, BADGE_META, normalizeBadgeId } from '../data/play';
import type { ColorTokens } from '../theme';
import { radius } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';

const GUIDE = ['socialLeader', ...BADGE_CATALOG] as const;

export function BadgeGuideSheet({
  visible,
  badges,
  socialLeader,
  mine,
  name,
  onClose,
}: {
  visible: boolean;
  badges?: string[];
  socialLeader?: boolean;
  mine?: boolean;
  name?: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const earned = new Set((badges || []).map(normalizeBadgeId));
  if (socialLeader) earned.add('socialLeader');

  if (!visible) return null;

  const rows = mine ? GUIDE : GUIDE.filter((id) => earned.has(id));
  const who = (name || '').trim();

  return (
    <DragSheet visible onClose={onClose} expanded>
      <Text style={styles.kicker}>{t('badges.guideKicker')}</Text>
      <Text style={styles.title}>
        {mine
          ? t('badges.guideTitle')
          : t('badges.otherTitle', { name: who || t('common.someone') })}
      </Text>
      <Text style={styles.lead}>
        {mine
          ? t('badges.guideLead')
          : rows.length
            ? t('badges.otherLead', { name: who || t('common.someone') })
            : t('badges.otherEmpty')}
      </Text>
      <View style={styles.list}>
        {rows.map((id) => {
          const on = earned.has(id);
          const gold = id === 'socialLeader';
          return (
            <View
              key={id}
              style={[styles.card, on && styles.cardOn, gold && on && styles.cardGold]}
            >
              <View style={styles.cardHead}>
                <Text style={[styles.cardTitle, gold && styles.cardTitleGold]}>
                  {gold ? '👑 ' : ''}
                  {t(`badges.${id}.title`, { defaultValue: BADGE_META[id]?.title || id })}
                </Text>
                {mine ? (
                  <Text style={[styles.mark, on ? styles.markOn : styles.markOff]}>
                    {on
                      ? gold
                        ? t('badges.earnedLeader')
                        : t('badges.earned')
                      : t('badges.locked')}
                  </Text>
                ) : (
                  <Text style={[styles.mark, gold ? styles.markGold : styles.markOn]}>
                    {t('badges.theirs')}
                  </Text>
                )}
              </View>
              <Text style={styles.how}>{t(`badges.${id}.how`)}</Text>
              {mine ? <Text style={styles.need}>{t(`badges.${id}.need`)}</Text> : null}
            </View>
          );
        })}
      </View>
      {mine ? (
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.done}>
          <Text style={styles.doneTxt}>{t('common.ok')}</Text>
        </Pressable>
      ) : null}
    </DragSheet>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    kicker: {
      color: colors.muted,
      fontWeight: '800',
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    title: { color: colors.ink, fontWeight: '900', fontSize: 22, marginTop: 4 },
    lead: { color: colors.muted, fontWeight: '600', fontSize: 13, lineHeight: 18, marginTop: 6 },
    list: { gap: 10, marginTop: 14 },
    card: {
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.paperSoft,
      borderRadius: 16,
      padding: 12,
      gap: 6,
    },
    cardOn: {
      borderColor: '#FF5E97',
      backgroundColor: 'rgba(255,94,151,0.1)',
    },
    cardGold: {
      borderColor: colors.gold,
      backgroundColor: 'rgba(244,193,110,0.12)',
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    cardTitle: { color: colors.ink, fontWeight: '900', fontSize: 15, flex: 1 },
    cardTitleGold: { color: colors.gold },
    mark: { fontWeight: '800', fontSize: 11 },
    markOn: { color: '#FF5E97' },
    markOff: { color: colors.muted },
    markGold: { color: colors.gold },
    how: { color: colors.ink, fontWeight: '600', fontSize: 13, lineHeight: 18 },
    need: { color: colors.muted, fontWeight: '700', fontSize: 12 },
    done: {
      marginTop: 12,
      backgroundColor: '#FF5E97',
      borderRadius: radius.pill,
      paddingVertical: 12,
      alignItems: 'center',
    },
    doneTxt: { color: '#fff', fontWeight: '900', fontSize: 14 },
  });
