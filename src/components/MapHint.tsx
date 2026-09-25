import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export function MapHint({ visible, onDismiss }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!visible) {
      opacity.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    const hide = setTimeout(onDismiss, 8000);
    return () => clearTimeout(hide);
  }, [visible, onDismiss, opacity, lift]);

  if (!visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('map.hintClose')} onPress={onDismiss}>
        <Animated.View style={[styles.bubble, { opacity, transform: [{ translateY: lift }] }]}>
          <Text style={styles.kicker}>{t('map.hintKicker')}</Text>
          <Text style={styles.title}>{t('map.hintTitle')}</Text>
        </Animated.View>
      </Pressable>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      left: 24,
      right: 24,
      bottom: 88,
      alignItems: 'center',
      zIndex: 20,
    },
    bubble: {
      maxWidth: 320,
      backgroundColor: colors.paper,
      borderWidth: 1,
      borderColor: colors.line,
      borderRadius: radius.md,
      paddingHorizontal: 18,
      paddingVertical: 14,
      shadowColor: '#000',
      shadowOpacity: 0.16,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    kicker: {
      color: colors.coral,
      fontWeight: '800',
      fontSize: 11,
      letterSpacing: 0.7,
      textTransform: 'uppercase',
      textAlign: 'center',
    },
    title: {
      marginTop: 4,
      color: colors.ink,
      fontWeight: '800',
      fontSize: 15,
      lineHeight: 22,
      textAlign: 'center',
    },
  });
