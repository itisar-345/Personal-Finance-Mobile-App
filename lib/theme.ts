import { useColorScheme } from 'react-native';
import type { Settings } from './types';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  success: string;
  warning: string;
  danger: string;
  /** Text on a solid `danger` background. */
  dangerText: string;
  accent: string;
  chart: string[];
}

// Text colours are chosen to meet WCAG AA contrast (4.5:1) against bg, surface and surfaceAlt.
export const LIGHT: Palette = {
  bg: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  border: '#E2E8F0',
  text: '#0F172A',
  textMuted: '#475569',
  primary: '#0F766E',
  primaryText: '#FFFFFF',
  success: '#15803D',
  warning: '#B45309',
  danger: '#B91C1C',
  dangerText: '#FFFFFF',
  accent: '#0EA5E9',
  chart: ['#0F766E', '#0EA5E9', '#D97706', '#7C3AED', '#DC2626', '#16A34A', '#64748B'],
};

export const DARK: Palette = {
  bg: '#0B1220',
  surface: '#111A2E',
  surfaceAlt: '#1B2540',
  border: '#2A3556',
  text: '#F1F5F9',
  textMuted: '#94A3B8',
  primary: '#2DD4BF',
  primaryText: '#062026',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  dangerText: '#2A0A0A',
  accent: '#38BDF8',
  chart: ['#2DD4BF', '#38BDF8', '#FBBF24', '#A78BFA', '#F87171', '#4ADE80', '#94A3B8'],
};

export function useTheme(settings: Settings): Palette {
  const scheme = useColorScheme();
  if (settings.theme === 'dark') return DARK;
  if (settings.theme === 'light') return LIGHT;
  return scheme === 'dark' ? DARK : LIGHT;
}
