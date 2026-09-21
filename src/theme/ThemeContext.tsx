import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  darkColors,
  lightColors,
  type ColorTokens,
  type ThemeScheme,
} from '../theme';
import { loadTheme, saveTheme } from './persist';

type ThemeContextValue = {
  scheme: ThemeScheme;
  colors: ColorTokens;
  setScheme: (next: ThemeScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ThemeScheme>('light');

  useEffect(() => {
    void loadTheme().then((saved) => {
      if (saved) setSchemeState(saved);
    });
  }, []);

  const setScheme = (next: ThemeScheme) => {
    setSchemeState(next);
    saveTheme(next);
  };

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === 'dark' ? darkColors : lightColors,
      setScheme,
      toggleScheme: () => setScheme(scheme === 'dark' ? 'light' : 'dark'),
    }),
    [scheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
