import type { AppAccentColor, AppTheme } from '../types';

export interface PaletteThemeColors {
  canvas: string;
  surface: string;
  text: string;
  accent: string;
  onAccent: string;
  secondary: string;
  highlight: string;
}

export interface PalettePreset {
  id: AppAccentColor;
  nameKey: string;
  sourceName: string;
  sourceUrl?: string;
  swatches: readonly string[];
  light: PaletteThemeColors;
  dark: PaletteThemeColors;
}

export const COLOR_PALETTES: readonly PalettePreset[] = [
  {
    id: 'archive',
    nameKey: 'settings.paletteArchive',
    sourceName: 'LoreLens Archive',
    swatches: ['#0B0B0A', '#171714', '#F2EFE6', '#C87648', '#6366F1'],
    light: {
      canvas: '#F2EFE6', surface: '#FFFDF8', text: '#171714', accent: '#4F46E5',
      onAccent: '#FFFFFF', secondary: '#C87648', highlight: '#D2CEC2',
    },
    dark: {
      canvas: '#0B0B0A', surface: '#151513', text: '#F4F0E6', accent: '#818CF8',
      onAccent: '#0B0B0A', secondary: '#C87648', highlight: '#D2CEC2',
    },
  },
  {
    id: 'olive',
    nameKey: 'settings.paletteOlive',
    sourceName: 'Olive Garden Feast',
    sourceUrl: 'https://coolors.co/606c38-283618-fefae0-dda15e-bc6c25',
    swatches: ['#606C38', '#283618', '#FEFAE0', '#DDA15E', '#BC6C25'],
    light: {
      canvas: '#FEFAE0', surface: '#FFFDF2', text: '#283618', accent: '#606C38',
      onAccent: '#FEFAE0', secondary: '#BC6C25', highlight: '#DDA15E',
    },
    dark: {
      canvas: '#283618', surface: '#344522', text: '#FEFAE0', accent: '#DDA15E',
      onAccent: '#283618', secondary: '#BC6C25', highlight: '#606C38',
    },
  },
  {
    id: 'coast',
    nameKey: 'settings.paletteCoast',
    sourceName: 'Sunny Beach Day',
    sourceUrl: 'https://coolors.co/264653-2a9d8f-e9c46a-f4a261-e76f51',
    swatches: ['#264653', '#2A9D8F', '#E9C46A', '#F4A261', '#E76F51'],
    light: {
      canvas: '#FDF8E8', surface: '#FFFDF4', text: '#264653', accent: '#264653',
      onAccent: '#FDF8E8', secondary: '#E76F51', highlight: '#2A9D8F',
    },
    dark: {
      canvas: '#264653', surface: '#315864', text: '#FFF8E8', accent: '#E9C46A',
      onAccent: '#264653', secondary: '#F4A261', highlight: '#2A9D8F',
    },
  },
  {
    id: 'sunset',
    nameKey: 'settings.paletteSunset',
    sourceName: 'Neutral Harmony Bliss',
    sourceUrl: 'https://coolors.co/f4f1de-e07a5f-3d405b-81b29a-f2cc8f',
    swatches: ['#F4F1DE', '#E07A5F', '#3D405B', '#81B29A', '#F2CC8F'],
    light: {
      canvas: '#F4F1DE', surface: '#FFFDF3', text: '#3D405B', accent: '#3D405B',
      onAccent: '#F4F1DE', secondary: '#E07A5F', highlight: '#81B29A',
    },
    dark: {
      canvas: '#3D405B', surface: '#494C68', text: '#F4F1DE', accent: '#F2CC8F',
      onAccent: '#3D405B', secondary: '#E07A5F', highlight: '#81B29A',
    },
  },
  {
    id: 'harbor',
    nameKey: 'settings.paletteHarbor',
    sourceName: 'Deep Sea',
    sourceUrl: 'https://coolors.co/0d1b2a-1b263b-415a77-778da9-e0e1dd',
    swatches: ['#0D1B2A', '#1B263B', '#415A77', '#778DA9', '#E0E1DD'],
    light: {
      canvas: '#E0E1DD', surface: '#F7F7F3', text: '#0D1B2A', accent: '#415A77',
      onAccent: '#F7F7F3', secondary: '#778DA9', highlight: '#1B263B',
    },
    dark: {
      canvas: '#0D1B2A', surface: '#1B263B', text: '#E0E1DD', accent: '#778DA9',
      onAccent: '#0D1B2A', secondary: '#415A77', highlight: '#E0E1DD',
    },
  },
] as const;

const paletteIds = new Set(COLOR_PALETTES.map((palette) => palette.id));
const legacyPaletteMap: Record<string, AppAccentColor> = {
  indigo: 'archive',
  teal: 'coast',
  amber: 'olive',
  violet: 'sunset',
};

export function normalizePaletteId(value: unknown): AppAccentColor {
  if (typeof value === 'string' && paletteIds.has(value as AppAccentColor)) return value as AppAccentColor;
  if (typeof value === 'string' && legacyPaletteMap[value]) return legacyPaletteMap[value];
  return 'archive';
}

export function getPalettePreset(value: unknown): PalettePreset {
  const id = normalizePaletteId(value);
  return COLOR_PALETTES.find((palette) => palette.id === id) || COLOR_PALETTES[0];
}

export function getPaletteThemeColors(value: unknown, theme: AppTheme): PaletteThemeColors {
  return getPalettePreset(value)[theme];
}

export function applyPaletteTheme(root: HTMLElement, value: unknown, theme: AppTheme): void {
  const palette = getPalettePreset(value);
  const colors = palette[theme];
  root.dataset.palette = palette.id;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.setProperty('--ll-canvas', colors.canvas);
  root.style.setProperty('--ll-surface-solid', colors.surface);
  root.style.setProperty('--ll-text', colors.text);
  root.style.setProperty('--ll-accent', colors.accent);
  root.style.setProperty('--ll-on-accent', colors.onAccent);
  root.style.setProperty('--ll-secondary', colors.secondary);
  root.style.setProperty('--ll-highlight', colors.highlight);
}
