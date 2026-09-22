import { useCallback, useEffect, useState } from 'react';
import { useAndroidBack } from '../hooks/useAndroidBack';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRO_FEATURES } from '../data/pro';
import { iapEnabledOnThisDevice, type ProPlanId } from '../iap';
import { useIap } from '../iap/IapProvider';
import { useSpot } from '../store/SpotContext';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';

type Props = {
  onBack: () => void;
};

export function ProScreen({ onBack }: Props) {
  const spot = useSpot();
  const iap = useIap();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  useAndroidBack(
    useCallback(() => {
      onBack();
      return true;
    }, [onBack]),
  );
  const [planId, setPlanId] = useState<ProPlanId>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = Boolean(spot.me.isPro) || iap.hasPro;
  const plans = iap.plans;
  const selected = plans.find((p) => p.id === planId) || plans[0] || null;
  const canBuy = iapEnabledOnThisDevice() && Boolean(selected) && !iap.loading;

  useEffect(() => {
    void iap.refresh();
  }, []);

  useEffect(() => {
    if (selected && selected.id !== planId) setPlanId(selected.id);
  }, [selected, planId]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('pro.back')} onPress={onBack}>
        <Text style={styles.back}>← {t('pro.back')}</Text>
      </Pressable>
      <Text style={styles.kicker}>{t('pro.kicker')}</Text>
      <Text style={styles.title}>{t('pro.title')}</Text>
      <Text style={styles.lead}>{t('pro.lead')}</Text>

      {active ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>{t('pro.activeTitle')}</Text>
          <Text style={styles.activeText}>{t('pro.activeText')}</Text>
        </View>
      ) : (
        <View style={styles.plans}>
          {iap.loading && !plans.length ? (
            <Text style={styles.planNote}>{t('pro.priceLoading')}</Text>
          ) : null}
          {plans.map((plan) => {
            const on = plan.id === (selected?.id || planId);
            return (
              <Pressable
                key={plan.productId}
                onPress={() => setPlanId(plan.id)}
                style={[styles.plan, on && styles.planOn]}
              >
                <Text style={styles.planName}>
                  {t(plan.id === 'monthly' ? 'pro.monthly' : 'pro.yearly')}
                </Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planNote}>
                  / {t(plan.id === 'monthly' ? 'pro.perMonth' : 'pro.perYear')} ·{' '}
                  {t(plan.id === 'monthly' ? 'pro.cancelAnytime' : 'pro.twoMonths')}
                </Text>
              </Pressable>
            );
          })}
          {!iap.loading && !plans.length ? (
            <Text style={styles.planNote}>{t('pro.priceUnavailable')}</Text>
          ) : null}
        </View>
      )}

      <Text style={styles.section}>{t('pro.section')}</Text>
      {PRO_FEATURES.map((feat, i) => {
        const n = i + 1;
        return (
          <View key={feat.key} style={styles.feat}>
            <Text style={styles.featTitle}>{t(`pro.f${n}t`)}</Text>
            <Text style={styles.featText}>{t(`pro.f${n}d`)}</Text>
          </View>
        );
      })}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {active ? null : iapEnabledOnThisDevice() && iap.loading && !selected ? (
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{t('pro.priceLoading')}</Text>
        </View>
      ) : active ? null : canBuy ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('pro.buyA11y')}
          style={styles.cta}
          disabled={busy}
          onPress={async () => {
            if (!selected) return;
            setBusy(true);
            setError(null);
            const res = await iap.purchase(selected.id);
            setBusy(false);
            if (!res.ok && !res.cancelled) {
              setError(res.reason === 'empty' ? t('pro.priceUnavailable') : res.reason);
            }
          }}
        >
          <Text style={styles.ctaText}>
            {busy ? t('pro.buying') : `${t('pro.buy')} · ${selected.price}`}
          </Text>
        </Pressable>
      ) : (
        <View style={styles.cta}>
          <Text style={styles.ctaText}>
            {iapEnabledOnThisDevice() ? t('pro.priceUnavailable') : t('pro.soon')}
          </Text>
        </View>
      )}
      {active || !iapEnabledOnThisDevice() ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            setBusy(true);
            setError(null);
            const res = await iap.restore();
            setBusy(false);
            if (!res.ok) setError(res.reason);
          }}
          style={styles.restore}
          disabled={busy}
        >
          <Text style={styles.restoreText}>{t('pro.restore')}</Text>
        </Pressable>
      )}
      <Text style={styles.fine}>
        {iapEnabledOnThisDevice() ? t('pro.fineOn') : t('pro.fineOff')}
      </Text>
    </ScrollView>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
  page: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 20, paddingBottom: 40 },
  back: { color: colors.coral, fontWeight: '700', marginBottom: 10 },
  kicker: {
    color: colors.gold,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.ink,
    marginTop: 6,
    lineHeight: 34,
  },
  lead: { color: colors.muted, lineHeight: 22, marginTop: 10, marginBottom: 18 },
  plans: { gap: 10, marginBottom: 18 },
  plan: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 16,
  },
  planOn: { borderColor: colors.gold, backgroundColor: colors.goldSoft },
  planName: { fontWeight: '800', color: colors.ink },
  planPrice: { fontSize: 22, fontWeight: '900', color: colors.ink, marginTop: 4 },
  planNote: { color: colors.muted, marginTop: 4, fontWeight: '600' },
  section: { fontWeight: '800', fontSize: 16, color: colors.ink, marginBottom: 8 },
  feat: {
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
  },
  featTitle: { fontWeight: '800', color: colors.ink },
  featText: { color: colors.muted, marginTop: 4, lineHeight: 20 },
  cta: {
    marginTop: 12,
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  restore: { marginTop: 10, alignItems: 'center', paddingVertical: 8 },
  restoreText: { color: colors.coral, fontWeight: '700' },
  fine: {
    marginTop: 12,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  error: { color: colors.warning, fontWeight: '700', marginTop: 8 },
  activeCard: {
    backgroundColor: colors.goldSoft,
    borderRadius: radius.md,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.gold,
    marginBottom: 18,
  },
  activeTitle: { fontWeight: '900', color: colors.ink, fontSize: 18 },
  activeText: { color: colors.muted, marginTop: 6, lineHeight: 20 },
});
