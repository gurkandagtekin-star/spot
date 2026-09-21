import { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ChatWallpaper } from './ChatWallpaper';
import { useTheme } from '../theme/ThemeContext';

export function AppShell({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  if (Platform.OS !== 'web') {
    return <ChatWallpaper>{children}</ChatWallpaper>;
  }
  return (
    <View style={[styles.webStage, { backgroundColor: colors.stage }]}>
      <View
        style={[
          styles.phone,
          {
            borderColor: colors.line,
            shadowColor: colors.coral,
          },
        ]}
      >
        <ChatWallpaper>{children}</ChatWallpaper>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webStage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  phone: {
    width: '100%',
    maxWidth: 430,
    height: '100%',
    maxHeight: 920,
    overflow: 'hidden',
    borderRadius: 28,
    borderWidth: 1,
    shadowOpacity: 0.22,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
});
