import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function ChatWallpaper({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.gradTop, colors.gradBottom]}
      start={{ x: 0.15, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.fill}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
