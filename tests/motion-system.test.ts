import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

const uiSourceFiles = [
  'App.tsx',
  'components/CropView.tsx',
  'components/HistoryView.tsx',
  'components/HomeView.tsx',
  'components/MapView.tsx',
  'components/ResultDrawer.tsx',
  'components/SettingsView.tsx',
];

describe('motion system', () => {
  test('keeps frequent screen navigation free of legacy entrance keyframes', () => {
    const source = uiSourceFiles.map(read).join('\n');

    expect(source).not.toMatch(/animate-(?:fade-in|fade-in-up|scale-in)/);
    expect(source).not.toContain('ll-screen-enter');
  });

  test('uses bounded motion primitives and physical entrance scales', () => {
    const css = read('index.css');

    expect(css).toContain('animation: ll-sheet-enter 240ms');
    expect(css).toContain('animation: ll-modal-enter 220ms');
    expect(css).not.toMatch(/transition:\s*all\b/);
    expect(css).not.toMatch(/scale\(0\)/);
  });

  test('reduces movement to opacity for both system and app preferences', () => {
    const css = read('index.css');

    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css.match(/animation-name: ll-opacity-enter !important/g)).toHaveLength(2);
  });
});
