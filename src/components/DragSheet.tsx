import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Dimensions,
  Keyboard,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { KeyboardGate } from './KeyboardGate';
import { KEYBOARD_SCROLL_PAD, useKeyboardHeight, useStableBottomInset } from '../hooks/useKeyboard';
import { radius, type ColorTokens } from '../theme';
import { useThemedStyles } from '../theme/useThemedStyles';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  keyboard?: boolean;
  dragEnabled?: boolean;
  lockScroll?: boolean;
  expanded?: boolean;
};

export function DragSheet({
  visible,
  onClose,
  children,
  footer,
  keyboard,
  dragEnabled = true,
  lockScroll = false,
  expanded = false,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const scrollY = useRef(0);
  const dragOn = useRef(dragEnabled);
  dragOn.current = dragEnabled;
  const lockRef = useRef(lockScroll);
  lockRef.current = lockScroll;
  const kbHeight = useKeyboardHeight();
  const navBottom = useStableBottomInset();
  const screenH = Dimensions.get('window').height;
  const open = Boolean(keyboard && kbHeight > 0);
  const maxHeight = screenH * (expanded ? 0.84 : 0.58);

  const dismiss = () => {
    Keyboard.dismiss();
    Animated.timing(translateY, {
      toValue: screenH,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onCloseRef.current();
    });
  };

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(Math.min(420, screenH * 0.4));
    Animated.spring(translateY, {
      toValue: 0,
      damping: 24,
      stiffness: 260,
      mass: 0.82,
      useNativeDriver: true,
    }).start();
  }, [visible, screenH, translateY]);

  const bodyPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          dragOn.current &&
          (lockRef.current || scrollY.current <= 4) &&
          g.dy > 6 &&
          g.dy > Math.abs(g.dx) * 1.1,
        onMoveShouldSetPanResponderCapture: (_, g) =>
          dragOn.current &&
          (lockRef.current || scrollY.current <= 4) &&
          g.dy > 8 &&
          g.dy > Math.abs(g.dx) * 1.2,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => Keyboard.dismiss(),
        onPanResponderMove: (_, g) => {
          if (g.dy > 0) translateY.setValue(g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (g.dy > 72 || g.vy > 0.95) {
            Keyboard.dismiss();
            Animated.timing(translateY, {
              toValue: screenH,
              duration: 220,
              useNativeDriver: true,
            }).start(({ finished }) => {
              if (finished) onCloseRef.current();
            });
            return;
          }
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 280,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, {
            toValue: 0,
            damping: 22,
            stiffness: 280,
            useNativeDriver: true,
          }).start();
        },
      }),
    [screenH, translateY],
  );

  const backdropOp = translateY.interpolate({
    inputRange: [0, 280],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: backdropOp }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
      </Animated.View>
      <KeyboardGate offset={0} style={styles.sheetDock}>
        <View {...bodyPan.panHandlers}>
          <Animated.View
            style={[
              styles.sheet,
              {
                maxHeight,
                transform: [{ translateY }],
              },
            ]}
          >
            <View style={styles.grab} pointerEvents="none">
              <View style={styles.handle} />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={!lockScroll}
              scrollEnabled={!lockScroll}
              nestedScrollEnabled={!lockScroll}
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
              contentContainerStyle={[
                styles.inner,
                { paddingBottom: open ? KEYBOARD_SCROLL_PAD : 16 },
              ]}
            >
              {children}
            </ScrollView>
            {footer ? (
              <View style={[styles.footer, { paddingBottom: Math.max(navBottom, 10) }]}>
                {footer}
              </View>
            ) : null}
          </Animated.View>
        </View>
      </KeyboardGate>
    </View>
  );
}

const createStyles = (colors: ColorTokens) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 50,
      elevation: 50,
    },
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.overlay,
    },
    sheetDock: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: colors.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderColor: colors.line,
      overflow: 'hidden',
      paddingBottom: 12,
    },
    grab: {
      alignItems: 'center',
      paddingTop: 10,
      paddingBottom: 8,
    },
    handle: {
      width: 40,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.muted,
      opacity: 0.45,
    },
    inner: { paddingHorizontal: 22, paddingTop: 4, gap: 10 },
    footer: {
      paddingHorizontal: 22,
      paddingTop: 8,
      paddingBottom: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.line,
      gap: 10,
    },
  });
