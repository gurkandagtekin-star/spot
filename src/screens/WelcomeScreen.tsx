import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAndroidBack } from '../hooks/useAndroidBack';

const BG = '#0A0A0A';
const GLOW = '#FF5E97';
const MUTED = 'rgba(255,255,255,0.58)';

const SLIDE_KEYS = [
  { title: 'welcome.s1t', body: 'welcome.s1b' },
  { title: 'welcome.s2t', body: 'welcome.s2b' },
  { title: 'welcome.s3t', body: 'welcome.s3b' },
] as const;

function MarkIcon() {
  return (
    <View style={styles.iconStage}>
      <View style={styles.radar} />
      <View style={styles.radarInner} />
      <View style={styles.pinHead} />
      <View style={styles.pinTip} />
    </View>
  );
}

function MomentIcon() {
  return (
    <View style={styles.iconStage}>
      <View style={styles.clockRing} />
      <View style={styles.clockHand} />
      <View style={styles.clockHour} />
    </View>
  );
}

function ApproveIcon() {
  return (
    <View style={styles.iconStage}>
      <View style={styles.circleA} />
      <View style={styles.circleB} />
      <View style={styles.checkStem} />
      <View style={styles.checkArm} />
    </View>
  );
}

function SlideIcon({ index }: { index: number }) {
  if (index === 1) return <MomentIcon />;
  if (index === 2) return <ApproveIcon />;
  return <MarkIcon />;
}

export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const last = step === SLIDE_KEYS.length - 1;
  const slide = SLIDE_KEYS[step];

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const showStep = (next: number) => {
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setStep(next);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  const finish = useCallback(() => {
    onDone();
  }, [onDone]);

  useAndroidBack(
    useCallback(() => {
      if (step > 0) {
        showStep(step - 1);
        return true;
      }
      return true;
    }, [step]),
  );

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowOp = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.7] });

  return (
    <View
      style={[
        styles.page,
        { paddingTop: insets.top + 18, paddingBottom: Math.max(insets.bottom, 20) },
      ]}
    >
      <View style={styles.bars}>
        {SLIDE_KEYS.map((_, i) => (
          <View key={i} style={styles.barTrack}>
            {i <= step ? (
              <LinearGradient
                colors={['#FF5E97', '#FF8A6A']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.barFill}
              />
            ) : null}
          </View>
        ))}
      </View>

      <Animated.View style={[styles.center, { opacity: fade }]}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
          <Animated.View style={[styles.iconGlow, { opacity: glowOp }]} />
          <SlideIcon index={step} />
        </Animated.View>
        <Text style={styles.title}>{t(slide.title)}</Text>
        <Text style={styles.body}>{t(slide.body)}</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Pressable onPress={finish} hitSlop={12} style={styles.skipHit}>
          <Text style={styles.skip}>{t('welcome.skip')}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (last) finish();
            else showStep(step + 1);
          }}
          style={styles.ctaWrap}
        >
          <LinearGradient
            colors={['#FF5E97', '#FF7A59']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>{last ? t('welcome.start') : t('welcome.next')}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BG, paddingHorizontal: 24 },
  bars: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  barTrack: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  barFill: { ...StyleSheet.absoluteFillObject },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  iconWrap: {
    width: 168,
    height: 168,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  iconGlow: {
    position: 'absolute',
    width: 168,
    height: 168,
    borderRadius: 84,
    backgroundColor: GLOW,
  },
  iconStage: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radar: {
    position: 'absolute',
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  radarInner: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(255,94,151,0.45)',
  },
  pinHead: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GLOW,
    marginTop: -8,
  },
  pinTip: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: GLOW,
  },
  clockRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 5,
    borderColor: GLOW,
  },
  clockHand: {
    position: 'absolute',
    width: 3,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 2,
    top: 34,
  },
  clockHour: {
    position: 'absolute',
    width: 18,
    height: 3,
    backgroundColor: '#fff',
    borderRadius: 2,
    top: 58,
    left: 60,
  },
  circleA: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    left: 18,
  },
  circleB: {
    position: 'absolute',
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 3,
    borderColor: GLOW,
    right: 18,
  },
  checkStem: {
    position: 'absolute',
    width: 4,
    height: 16,
    backgroundColor: '#fff',
    borderRadius: 2,
    transform: [{ rotate: '-45deg' }],
    left: 50,
    top: 58,
  },
  checkArm: {
    position: 'absolute',
    width: 4,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
    left: 62,
    top: 48,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.7,
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 340,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  skipHit: { paddingVertical: 14, paddingRight: 8 },
  skip: { color: 'rgba(255,255,255,0.38)', fontWeight: '700', fontSize: 16 },
  ctaWrap: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: GLOW,
    shadowOpacity: 0.55,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  cta: {
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 18,
    minWidth: 148,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
