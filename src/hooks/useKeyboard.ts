import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

export const KEYBOARD_SCROLL_PAD = 120;

function liftFromEvent(e: KeyboardEvent) {
  const h = Math.round(e.endCoordinates.height || 0);
  if (h < 80) return 0;
  return h + (Platform.OS === 'android' ? 16 : 6);
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

export function keyboardOffset(topBarHeight: number) {
  return Math.max(0, Math.round(topBarHeight));
}
