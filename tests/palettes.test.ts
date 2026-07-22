// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';
import { applyPaletteTheme, COLOR_PALETTES, getPaletteThemeColors, normalizePaletteId } from '../utils/palettes';

const luminance = (hex: string) => {
  const channels = hex.slice(1).match(/../g)!.map((channel) => Number.parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
};

const contrast = (foreground: string, background: string) => {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
};

describe('color palettes', () => {
  test('offers five unique palettes with light and dark variants', () => {
    expect(COLOR_PALETTES).toHaveLength(5);
    expect(new Set(COLOR_PALETTES.map((palette) => palette.id)).size).toBe(5);
    for (const palette of COLOR_PALETTES) {
      expect(palette.swatches).toHaveLength(5);
      expect(palette.light.canvas).toMatch(/^#[0-9A-F]{6}$/);
      expect(palette.dark.canvas).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  test('keeps primary text and filled controls at WCAG AA contrast', () => {
    for (const palette of COLOR_PALETTES) {
      for (const theme of ['light', 'dark'] as const) {
        const colors = palette[theme];
        expect(contrast(colors.text, colors.canvas), `${palette.id}/${theme} text`).toBeGreaterThanOrEqual(4.5);
        expect(contrast(colors.onAccent, colors.accent), `${palette.id}/${theme} accent`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('maps legacy accent choices onto the closest full palette', () => {
    expect(normalizePaletteId('indigo')).toBe('archive');
    expect(normalizePaletteId('teal')).toBe('coast');
    expect(normalizePaletteId('amber')).toBe('olive');
    expect(normalizePaletteId('violet')).toBe('sunset');
    expect(normalizePaletteId('not-a-palette')).toBe('archive');
  });

  test('applies semantic tokens and theme metadata to the document root', () => {
    const root = document.createElement('div');
    applyPaletteTheme(root, 'harbor', 'dark');
    const colors = getPaletteThemeColors('harbor', 'dark');

    expect(root.dataset.palette).toBe('harbor');
    expect(root.dataset.theme).toBe('dark');
    expect(root.style.getPropertyValue('--ll-canvas')).toBe(colors.canvas);
    expect(root.style.getPropertyValue('--ll-accent')).toBe(colors.accent);
  });
});
