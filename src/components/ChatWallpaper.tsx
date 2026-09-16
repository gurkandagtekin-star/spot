import { createElement, type ReactNode } from 'react';
import { ImageBackground, Platform, StyleSheet } from 'react-native';
import { colors } from '../theme';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="168" height="168" viewBox="0 0 168 168">
  <rect width="168" height="168" fill="#F6F0E6"/>
  <g fill="none" stroke="#C4B4A2" stroke-width="1.15" stroke-linecap="round" opacity="0.42">
    <path d="M22 28c8-9 22-8 28 2 5 9-2 18-11 16"/>
    <path d="M38 34c4 6 3 14-3 18"/>
    <circle cx="118" cy="26" r="3.2"/>
    <circle cx="128" cy="34" r="1.6"/>
    <path d="M96 48c12 4 18 16 12 26-7 11-22 8-24-4"/>
    <path d="M148 62c-10 2-16 12-12 22 5 12 20 14 26 4"/>
    <path d="M18 86h14M25 79v14"/>
    <path d="M58 92c8-14 28-12 30 4 1 12-10 18-20 14"/>
    <path d="M132 98l8 8M140 98l-8 8"/>
    <circle cx="44" cy="128" r="2.2"/>
    <path d="M70 124c10-6 22 2 20 14-2 9-14 12-20 6"/>
    <path d="M12 142c16 4 22 18 10 26"/>
    <path d="M154 132c-8 10-6 24 8 28"/>
    <path d="M88 16c6 8 4 18-6 20"/>
    <path d="M160 18c-7 6-6 16 2 20"/>
  </g>
</svg>`;

const TILE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

export function ChatWallpaper({ children }: { children: ReactNode }) {
  if (Platform.OS === 'web') {
    return createElement(
      'div',
      {
        style: {
          flex: 1,
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: colors.bg,
          backgroundImage: `url("${TILE}")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '168px 168px',
        },
      },
      children,
    );
  }

  return (
    <ImageBackground
      source={{ uri: TILE }}
      style={styles.fill}
      imageStyle={styles.tile}
      resizeMode="repeat"
    >
      {children}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.bg },
  tile: { resizeMode: 'repeat', width: 168, height: 168 },
});
