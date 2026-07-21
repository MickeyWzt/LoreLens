import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';

const languages = ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar'];

const flatten = (value: unknown, prefix = ''): string[] => {
  if (!value || typeof value !== 'object') return [prefix];
  return Object.entries(value).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key));
};

describe('translations', () => {
  test('all eleven languages contain exactly the same visible keys', () => {
    const keySets = languages.map((language) => {
      const file = path.join(process.cwd(), 'public', 'locales', language, 'translation.json');
      return flatten(JSON.parse(fs.readFileSync(file, 'utf8'))).sort();
    });
    for (const keys of keySets.slice(1)) expect(keys).toEqual(keySets[0]);
  });

  test('contains the new location, offline, import and accessibility copy', () => {
    const english = JSON.parse(fs.readFileSync(
      path.join(process.cwd(), 'public', 'locales', 'en', 'translation.json'),
      'utf8',
    ));
    const keys = new Set(flatten(english));
    for (const key of [
      'common.retry',
      'location.unavailable',
      'scan.choosePhoto',
      'settings.exportData',
      'crop.useFullImage',
      'history.pending',
    ]) expect(keys.has(key)).toBe(true);
  });
});
