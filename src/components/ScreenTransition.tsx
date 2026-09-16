import { type ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

type Props = {
  token: string;
  /** -1 soldan, 1 sağdan, 0 sadece fade */
  direction?: number;
  children: ReactNode;
};

export function ScreenTransition({ token, direction = 0, children }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(direction * 40)).current;

  useEffect(() => {
    opacity.setValue(0);
    shift.setValue(direction * 40);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(shift, {
        toValue: 0,
        duration: 340,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [token, direction, opacity, shift]);

  return (
    <Animated.View
      style={[
        styles.fill,
        { opacity, transform: [{ translateX: shift }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
