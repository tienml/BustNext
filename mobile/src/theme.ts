import { useColorScheme } from 'react-native';

export type Palette = {
  primary: string;
  primaryContainer: string;
  primarySoft: string;
  onPrimary: string;
  secondary: string;
  secondarySoft: string;
  background: string;
  surface: string;
  surfaceMuted: string;
  ink: string;
  muted: string;
  border: string;
  skeleton: string;
  warning: string;
  warningSurface: string;
  danger: string;
  dangerSurface: string;
  shadow: string;
};

export const lightColors: Palette = {
  primary: '#006948',
  primaryContainer: '#00855D',
  primarySoft: '#D5F5E4',
  onPrimary: '#FFFFFF',
  secondary: '#0051D5',
  secondarySoft: '#E5EBFF',
  background: '#FAF8FF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F3F8',
  ink: '#131B2E',
  muted: '#5F6B7A',
  border: '#D9E0E8',
  skeleton: '#E6E8F0',
  warning: '#7A4C00',
  warningSurface: '#FFF3D6',
  danger: '#BA1B1B',
  dangerSurface: '#FFE8E6',
  shadow: '#131B2E',
};

export const darkColors: Palette = {
  primary: '#5FDBA7',
  primaryContainer: '#00A774',
  primarySoft: '#123B2C',
  onPrimary: '#00281A',
  secondary: '#9DB5FF',
  secondarySoft: '#1C2A52',
  background: '#0E131D',
  surface: '#171E2B',
  surfaceMuted: '#1F2736',
  ink: '#E7ECF5',
  muted: '#9AA6B8',
  border: '#2B3446',
  skeleton: '#252E3F',
  warning: '#FFCF7A',
  warningSurface: '#3A2C10',
  danger: '#FFB4AB',
  dangerSurface: '#4A1915',
  shadow: '#000000',
};

/** Kept for code that does not need theme switching. */
export const colors = lightColors;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 30,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
};

export function useTheme(): { colors: Palette; dark: boolean } {
  const dark = useColorScheme() === 'dark';
  return { colors: dark ? darkColors : lightColors, dark };
}
