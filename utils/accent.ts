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

export const getAccentStyles = (color: AppAccentColor, isDark: boolean): AccentSet => {
  switch (color) {
    case 'teal':
      return {
        primary: isDark ? 'teal-500' : 'teal-600',
        bg: isDark ? 'bg-teal-500' : 'bg-teal-600',
        text: isDark ? 'text-teal-400' : 'text-teal-600',
        textLight: isDark ? 'text-teal-300' : 'text-teal-700',
        btnActive: isDark ? 'bg-teal-500/20 border-teal-500/30' : 'bg-teal-50 border-teal-200',
        border: isDark ? 'border-teal-500/30' : 'border-teal-200',
        lightBg: isDark ? 'bg-teal-500/10' : 'bg-teal-50',
        shadow: isDark ? 'shadow-[0_0_15px_rgba(20,184,166,0.3)]' : 'shadow-[0_0_15px_rgba(13,148,136,0.2)]',
        dotPulse: isDark ? 'shadow-[0_0_10px_rgba(20,184,166,0.8)]' : 'shadow-[0_0_10px_rgba(13,148,136,0.6)]',
        gradientFrom: isDark ? 'via-teal-500/50' : 'via-teal-300',
      };
    case 'amber':
      return {
        primary: isDark ? 'amber-500' : 'amber-600',
        bg: isDark ? 'bg-amber-500' : 'bg-amber-600',
        text: isDark ? 'text-amber-400' : 'text-amber-600',
        textLight: isDark ? 'text-amber-300' : 'text-amber-700',
        btnActive: isDark ? 'bg-amber-500/20 border-amber-500/30' : 'bg-amber-50 border-amber-200',
        border: isDark ? 'border-amber-500/30' : 'border-amber-200',
        lightBg: isDark ? 'bg-amber-500/10' : 'bg-amber-50',
        shadow: isDark ? 'shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'shadow-[0_0_15px_rgba(217,119,6,0.2)]',
        dotPulse: isDark ? 'shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'shadow-[0_0_10px_rgba(217,119,6,0.6)]',
        gradientFrom: isDark ? 'via-amber-500/50' : 'via-amber-300',
      };
    case 'violet':
      return {
        primary: isDark ? 'violet-500' : 'violet-600',
        bg: isDark ? 'bg-violet-500' : 'bg-violet-600',
        text: isDark ? 'text-violet-400' : 'text-violet-600',
        textLight: isDark ? 'text-violet-300' : 'text-violet-700',
        btnActive: isDark ? 'bg-violet-500/20 border-violet-500/30' : 'bg-violet-50 border-violet-200',
        border: isDark ? 'border-violet-500/30' : 'border-violet-200',
        lightBg: isDark ? 'bg-violet-500/10' : 'bg-violet-50',
        shadow: isDark ? 'shadow-[0_0_15px_rgba(139,92,246,0.3)]' : 'shadow-[0_0_15px_rgba(124,58,237,0.2)]',
        dotPulse: isDark ? 'shadow-[0_0_10px_rgba(139,92,246,0.8)]' : 'shadow-[0_0_10px_rgba(124,58,237,0.6)]',
        gradientFrom: isDark ? 'via-violet-500/50' : 'via-violet-300',
      };
    case 'indigo':
    default:
      return {
        primary: isDark ? 'indigo-500' : 'indigo-600',
        bg: isDark ? 'bg-indigo-500' : 'bg-indigo-600',
        text: isDark ? 'text-indigo-400' : 'text-indigo-600',
        textLight: isDark ? 'text-indigo-300' : 'text-indigo-700',
        btnActive: isDark ? 'bg-indigo-500/20 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200',
        border: isDark ? 'border-indigo-500/30' : 'border-indigo-200',
        lightBg: isDark ? 'bg-indigo-500/10' : 'bg-indigo-50',
        shadow: isDark ? 'shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'shadow-[0_0_15px_rgba(79,70,229,0.2)]',
        dotPulse: isDark ? 'shadow-[0_0_10px_rgba(99,102,241,0.8)]' : 'shadow-[0_0_10px_rgba(79,70,229,0.6)]',
        gradientFrom: isDark ? 'via-indigo-500/50' : 'via-indigo-300',
      };
  }
};
