import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const KEYBOARD_SCROLL_PAD = 120;

function liftFromEvent(e: KeyboardEvent) {
  const h = Math.round(e.endCoordinates.height || 0);
  if (h < 80) return 0;
  return h + (Platform.OS === 'ios' ? 6 : 0);
}

export function useKeyboardHeight() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = (e: KeyboardEvent) => setHeight(liftFromEvent(e));
    const onHide = () => setHeight(0);
    const show = Keyboard.addListener(showEvt, onShow);
    const hide = Keyboard.addListener(hideEvt, onHide);
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}

/** Bottom inset that keeps 3-button nav height while the IME is open. */
export function useStableBottomInset() {
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const held = useRef(0);
  if (kbHeight === 0) held.current = insets.bottom;
  return Math.max(insets.bottom, kbHeight > 0 ? held.current : 0);
}

export function keyboardOffset(topBarHeight: number) {
  return Math.max(0, Math.round(topBarHeight));
}
