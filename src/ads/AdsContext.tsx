import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePro } from '../pro/usePro';
import { useTranslation } from 'react-i18next';

type AdsValue = {
  adsEnabled: boolean;
  showRewarded: () => Promise<boolean>;
  showInterstitial: () => Promise<void>;
};

const AdsContext = createContext<AdsValue | null>(null);

export function AdsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { adsEnabled } = usePro();
  const [rewardOpen, setRewardOpen] = useState(false);
  const [interOpen, setInterOpen] = useState(false);
  const [seconds, setSeconds] = useState(5);
  const rewardRef = useRef<{
    resolve: (ok: boolean) => void;
    timer?: ReturnType<typeof setInterval>;
  } | null>(null);
  const interRef = useRef<{
    resolve: () => void;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);

  const finishReward = useCallback((ok: boolean) => {
    const gate = rewardRef.current;
    if (gate?.timer) clearInterval(gate.timer);
    rewardRef.current = null;
    setRewardOpen(false);
    gate?.resolve(ok);
  }, []);

  const finishInter = useCallback(() => {
    const gate = interRef.current;
    if (gate?.timer) clearTimeout(gate.timer);
    interRef.current = null;
    setInterOpen(false);
    gate?.resolve();
  }, []);

  const showRewarded = useCallback(() => {
    if (!adsEnabled) return Promise.resolve(false);
    finishReward(false);
    setSeconds(5);
    setRewardOpen(true);
    return new Promise<boolean>((resolve) => {
      let left = 5;
      const timer = setInterval(() => {
        left -= 1;
        setSeconds(left);
        if (left <= 0) finishReward(true);
      }, 1000);
      rewardRef.current = { resolve, timer };
    });
  }, [adsEnabled, finishReward]);

  const showInterstitial = useCallback(() => {
    if (!adsEnabled) return Promise.resolve();
    finishInter();
    setInterOpen(true);
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => finishInter(), 2200);
      interRef.current = { resolve, timer };
    });
  }, [adsEnabled, finishInter]);

  const value = useMemo(
    () => ({ adsEnabled, showRewarded, showInterstitial }),
    [adsEnabled, showRewarded, showInterstitial],
  );

  return (
    <AdsContext.Provider value={value}>
      {children}
      <Modal visible={rewardOpen} transparent animationType="fade">
        <View style={styles.shade}>
          <View style={styles.card}>
            <Text style={styles.kicker}>{t('ads.rewardedKicker')}</Text>
            <Text style={styles.title}>{t('ads.rewardedTitle')}</Text>
            <Text style={styles.body}>
              {seconds > 0
                ? t('ads.rewardedWait', { seconds })
                : t('ads.rewardedDone')}
            </Text>
            <Pressable onPress={() => finishReward(false)} style={styles.ghost}>
              <Text style={styles.ghostTxt}>{t('ads.skip')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={interOpen} transparent animationType="fade">
        <View style={styles.shade}>
          <View style={styles.card}>
            <Text style={styles.kicker}>{t('ads.kicker')}</Text>
            <Text style={styles.title}>Mark Date</Text>
            <Text style={styles.body}>{t('ads.interBody')}</Text>
            <Pressable onPress={finishInter} style={styles.ghost}>
              <Text style={styles.ghostTxt}>{t('common.close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </AdsContext.Provider>
  );
}

export function useAds() {
  const ctx = useContext(AdsContext);
  if (!ctx) throw new Error('useAds must be used inside AdsProvider');
  return ctx;
}

export function AdBanner() {
  const { adsEnabled } = useAds();
  const { t } = useTranslation();
  if (!adsEnabled) return null;
  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.bannerKicker}>{t('ads.kicker')}</Text>
      <Text style={styles.bannerTxt}>{t('ads.banner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  shade: {
    flex: 1,
    backgroundColor: 'rgba(10,10,10,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    backgroundColor: '#1A1224',
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  kicker: {
    color: '#C084FC',
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  title: { color: '#fff', fontWeight: '900', fontSize: 20 },
  body: { color: 'rgba(255,255,255,0.7)', lineHeight: 20, fontWeight: '600' },
  ghost: { marginTop: 8, alignSelf: 'flex-start' },
  ghostTxt: { color: '#FF8A4C', fontWeight: '800' },
  banner: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(28,18,52,0.88)',
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.35)',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bannerKicker: {
    color: '#C084FC',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bannerTxt: { color: '#F5F0EA', fontWeight: '700', marginTop: 2, fontSize: 13 },
});
