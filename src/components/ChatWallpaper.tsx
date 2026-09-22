import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function ChatWallpaper({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={[colors.gradTop, colors.gradBottom]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
