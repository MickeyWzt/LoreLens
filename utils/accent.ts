import { AppAccentColor } from '../types';

export interface AccentSet {
  primary: string; // e.g., bg-indigo-500 or bg-indigo-600 depending on standard use
  bg: string; // Tailwind class
  text: string;
  textLight: string;
  btnActive: string;
  border: string;
  lightBg: string;
  shadow: string;
  dotPulse: string;
  gradientFrom: string;
}

export const getAccentStyles = (_color: AppAccentColor, _isDark: boolean): AccentSet => ({
  primary: 'var(--ll-accent)',
  bg: 'bg-[var(--ll-accent)] text-[var(--ll-on-accent)]',
  text: 'text-[var(--ll-accent)]',
  textLight: 'text-[var(--ll-accent)]',
  btnActive: 'bg-[var(--ll-accent-soft)] border-[var(--ll-accent-border)] text-[var(--ll-accent)]',
  border: 'border-[var(--ll-accent-border)]',
  lightBg: 'bg-[var(--ll-accent-soft)]',
  shadow: 'shadow-[0_0_18px_var(--ll-accent-glow)]',
  dotPulse: 'shadow-[0_0_12px_var(--ll-accent-glow)]',
  gradientFrom: 'via-[var(--ll-accent-glow)]',
});
