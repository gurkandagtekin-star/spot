import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PRO_FEATURES, PRO_PLANS } from '../data/pro';
import { useSpot } from '../store/SpotContext';
import { colors, radius } from '../theme';

type Props = {
  onBack: () => void;
};

export function ProScreen({ onBack }: Props) {
  const spot = useSpot();
  const [planId, setPlanId] = useState<(typeof PRO_PLANS)[number]['id']>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = Boolean(spot.me.isPro);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={onBack}>
        <Text style={styles.back}>← Geri</Text>
      </Pressable>
      <Text style={styles.kicker}>Mark Date Pro</Text>
      <Text style={styles.title}>Daha çok çık, daha görünür ol</Text>
      <Text style={styles.lead}>
        Ücretsiz hesapta günde 2 mark. Pro, haritayı ve eşleşmeyi günlük kota
        olmadan kullanman için.
      </Text>

      {active ? (
        <View style={styles.activeCard}>
          <Text style={styles.activeTitle}>Pro açık</Text>
          <Text style={styles.activeText}>
            Sınırsız mark ve öne çıkarma bu hesapta. Mağaza ödemesi gelince
            abonelik buradan yönetilir.
          </Text>
        </View>
      ) : (
        <View style={styles.plans}>
          {PRO_PLANS.map((plan) => {
            const on = plan.id === planId;
            return (
              <Pressable
                key={plan.id}
                onPress={() => setPlanId(plan.id)}
                style={[styles.plan, on && styles.planOn]}
              >
                <Text style={styles.planName}>{plan.name}</Text>
                <Text style={styles.planPrice}>{plan.price}</Text>
                <Text style={styles.planNote}>
                  / {plan.period} · {plan.note}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.section}>Neler var</Text>
      {PRO_FEATURES.map((item) => (
        <View key={item.title} style={styles.feat}>
          <Text style={styles.featTitle}>{item.title}</Text>
          <Text style={styles.featText}>{item.text}</Text>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {active ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pro satın al"
          style={styles.cta}
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            const res = await spot.activatePro(planId);
            setBusy(false);
            if (!res.ok) setError(res.reason);
          }}
        >
          <Text style={styles.ctaText}>
            {busy ? 'İşleniyor…' : 'Satın al (önizleme)'}
          </Text>
        </Pressable>
      )}
      <Text style={styles.fine}>
        Gerçek tahsilat yok. App Store / Google Play bağlanınca ödeme oradan
        alınır. Bu ekran paketleri ve özellikleri gösterir; önizlemede Pro
        hesabına işlenir.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
