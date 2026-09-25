import { Platform } from 'react-native';

/** Design tokens. Screens and components read colours/spacing from here only. */
export const colors = {
  background: '#FFF6EC',
  surface: '#FFFFFF',
  surfaceMuted: '#FBEEDF',
  border: '#F0E0CC',
  text: '#2F2548',
  textMuted: '#8A7F9E',
  primary: '#7B5CFF',
  primaryDark: '#5E41E0',
  primarySoft: '#ECE6FF',
  coin: '#FFB938',
  coinDark: '#E09A12',
  happiness: '#FF6FA3',
  health: '#3FCB85',
  xp: '#4FA8FF',
  streak: '#FF7A45',
  danger: '#F2596B',
  roomWall: '#FDE9D2',
  roomFloor: '#F4D2AE',
  roomFloorShade: '#EAC096',
  white: '#FFFFFF',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const typography = {
  title: { fontSize: 28, fontWeight: '900' as const, color: colors.text, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '800' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '500' as const, color: colors.text },
  label: { fontSize: 13, fontWeight: '700' as const, color: colors.textMuted },
  number: { fontSize: 16, fontWeight: '800' as const, color: colors.text, fontVariant: ['tabular-nums' as const] },
};

export const shadow = Platform.select({
  web: { boxShadow: '0 6px 18px rgba(80, 50, 20, 0.10)' },
  default: {
    shadowColor: '#6B4A2A',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
});

/** The native driver is unavailable on web; Animated falls back to JS there. */
export const useNativeDriver = Platform.OS !== 'web';
