import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const OFFSET = Platform.OS === 'ios' ? 90 : 0;

/** KeyboardAvoidingView wrapper — iOS padding; Android uses window resize. */
export function KeyboardGate({
  children,
  style,
  offset = OFFSET,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  offset?: number;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={style ?? { flex: 1 }}
      keyboardVerticalOffset={offset}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
