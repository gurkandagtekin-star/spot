import { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { ChatWallpaper } from './ChatWallpaper';

export function AppShell({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <ChatWallpaper>{children}</ChatWallpaper>;
  }
  return (
    <View style={styles.webStage}>
      <View style={styles.phone}>
        <ChatWallpaper>{children}</ChatWallpaper>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webStage: {
    flex: 1,
    backgroundColor: '#E8DFD2',
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
    borderColor: colors.line,
    shadowColor: '#1F1A17',
    shadowOpacity: 0.16,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 18 },
  },
});
