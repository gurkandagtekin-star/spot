import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export type AlertType = 'default' | 'danger';

export type AlertAction = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export type AlertOptions = {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  type?: AlertType;
  actions?: AlertAction[];
};

type AlertContextValue = {
  showAlert: (options: AlertOptions) => void;
  hideAlert: () => void;
};

const AlertContext = createContext<AlertContextValue | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<AlertOptions | null>(null);

  const hideAlert = useCallback(() => setOptions(null), []);

  const showAlert = useCallback((next: AlertOptions) => {
    setOptions(next);
  }, []);

  const close = (fn?: () => void) => {
    setOptions(null);
    fn?.();
  };

  const value = useMemo(() => ({ showAlert, hideAlert }), [showAlert, hideAlert]);

  const actions =
    options?.actions && options.actions.length
      ? options.actions
      : options
        ? [
            ...(options.cancelText
              ? [{ text: options.cancelText, style: 'cancel' as const, onPress: options.onCancel }]
              : []),
            {
              text: options.confirmText || 'Tamam',
              style: (options.type === 'danger' ? 'destructive' : 'default') as const,
              onPress: options.onConfirm,
            },
          ]
        : [];

  const pair = !options?.actions && actions.length <= 2;

  return (
    <AlertContext.Provider value={value}>
      {children}
      <Modal
        visible={Boolean(options)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close(options?.onCancel)}
      >
        <View style={styles.frame}>
          {Platform.OS === 'web' ? (
            <View style={styles.dim} />
          ) : (
            <BlurView intensity={48} tint="dark" style={StyleSheet.absoluteFill} />
          )}
          <Pressable style={StyleSheet.absoluteFill} onPress={() => close(options?.onCancel)} />
          <View style={styles.card} accessibilityRole="alert">
            <Text style={styles.title}>{options?.title}</Text>
            {options?.message ? <Text style={styles.message}>{options.message}</Text> : null}
            <View style={[styles.actions, pair && styles.actionsRow]}>
              {actions.map((action, i) => {
                const danger = action.style === 'destructive';
                const cancel = action.style === 'cancel';
                return (
                  <Pressable
                    key={`${action.text}-${i}`}
                    onPress={() => close(action.onPress)}
                    style={[pair && styles.actionFlex, cancel && pair && styles.actionFlex]}
                  >
                    {cancel ? (
                      <View style={styles.cancelBtn}>
                        <Text style={styles.cancelText}>{action.text}</Text>
                      </View>
                    ) : (
                      <LinearGradient
                        colors={danger ? ['#E23D4A', '#FF6B6B'] : ['#FF5E97', '#FF7A59']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.confirmBtn}
                      >
                        <Text style={styles.confirmText}>{action.text}</Text>
                      </LinearGradient>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert, AlertProvider içinde kullanılmalı.');
  return ctx;
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 18,
    zIndex: 2,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  message: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 4,
  },
  actions: { marginTop: 20, gap: 10 },
  actionsRow: { flexDirection: 'row', alignItems: 'center' },
  actionFlex: { flex: 1 },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#1A1A1A',
  },
  cancelText: { color: 'rgba(255,255,255,0.7)', fontWeight: '700', fontSize: 15 },
  confirmBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 16,
  },
  confirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
