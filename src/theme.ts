export type ColorTokens = {
  bg: string;
  paper: string;
  paperSoft: string;
  ink: string;
  muted: string;
  line: string;
  coral: string;
  coralSoft: string;
  teal: string;
  tealSoft: string;
  instagram: string;
  warning: string;
  gold: string;
  goldSoft: string;
  overlay: string;
  bubbleMine: string;
  bubbleOther: string;
  gradTop: string;
  gradBottom: string;
  stage: string;
  chipBg: string;
  chipText: string;
  chipOnBg: string;
  chipOnText: string;
};

export const lightColors: ColorTokens = {
  bg: '#F6F0E6',
  paper: '#FFFCF7',
  paperSoft: '#FBF6EE',
  ink: '#1F1A17',
  muted: '#7A7168',
  line: '#E8DCCE',
  coral: '#E35D4A',
  coralSoft: '#FBE4DF',
  teal: '#2A9D8F',
  tealSoft: '#DCEFED',
  instagram: '#C13584',
  warning: '#C2410C',
  gold: '#C9A227',
  goldSoft: '#F7F0D8',
  overlay: 'rgba(31, 26, 23, 0.38)',
  bubbleMine: '#E35D4A',
  bubbleOther: '#FFFCF7',
  gradTop: '#F7F1E8',
  gradBottom: '#F0D4C8',
  stage: '#E8DFD2',
  chipBg: '#EFE6DA',
  chipText: '#7A7168',
  chipOnBg: '#FF5E97',
  chipOnText: '#FFFFFF',
};

export const darkColors: ColorTokens = {
  bg: '#14121C',
  paper: '#1E1B2C',
  paperSoft: '#2A2438',
  ink: '#F7F0F5',
  muted: '#B7A8C4',
  line: '#3A3348',
  coral: '#F47CA8',
  coralSoft: 'rgba(244, 124, 168, 0.2)',
  teal: '#8EC5E8',
  tealSoft: 'rgba(142, 197, 232, 0.16)',
  instagram: '#E85A9B',
  warning: '#FF8A9B',
  gold: '#F4C16E',
  goldSoft: 'rgba(244, 193, 110, 0.16)',
  overlay: 'rgba(12, 10, 22, 0.55)',
  bubbleMine: '#E85A9B',
  bubbleOther: '#2A2438',
  gradTop: '#17141F',
  gradBottom: '#6B3A55',
  stage: '#0E0C14',
  chipBg: '#262238',
  chipText: '#A0A0B0',
  chipOnBg: '#FF5E97',
  chipOnText: '#FFFFFF',
};

export const radius = {
  sm: 12,
  md: 18,
  lg: 28,
  pill: 999,
};

export type ThemeScheme = 'light' | 'dark';
