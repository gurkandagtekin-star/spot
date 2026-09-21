import { useMemo } from 'react';
import type { ColorTokens } from '../theme';
import { useTheme } from './ThemeContext';

export function useThemedStyles<T>(factory: (colors: ColorTokens) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
