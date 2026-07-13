import { describe, expect, test } from 'vitest';

async function loadDomain() {
  return import('../domain/model').catch(() => null);
}

describe('domain model', () => {
  test('validates a complete decipher result', async () => {
    const domain = await loadDomain();
    expect(domain).not.toBeNull();
    if (!domain) return;

    const result = domain.parseDecipherResult({
      title: 'Temple roof guardian',
      essence: 'A symbolic protector placed along an imperial roof ridge.',
      mirrorInsight: 'It works like heraldic figures on European cathedrals.',
      philosophy: 'The ordering of figures made hierarchy visible.',
      quickAction: 'Count the figures from the outer edge inward.',
      mapUri: 'https://maps.google.com/?q=39.9,116.4',
    });

    expect(result.title).toBe('Temple roof guardian');
  });

  test('rejects an incomplete decipher result', async () => {
    const domain = await loadDomain();
    expect(domain).not.toBeNull();
    if (!domain) return;

    expect(() => domain.parseDecipherResult({ title: 'Incomplete' })).toThrow();
  });

  test('migrates legacy history without inventing a location label', async () => {
    const domain = await loadDomain();
    expect(domain).not.toBeNull();
    if (!domain) return;

    const [record] = domain.migrateLegacyHistory([
      {
        id: 'legacy-1',
        timestamp: 100,
        title: 'Gate',
        essence: 'An old gate.',
        mirrorInsight: 'A civic threshold.',
        philosophy: 'It separated spaces.',
        quickAction: 'Look at the hinges.',
        location: { lat: 48.85, lng: 2.35 },
      },
    ]);

    expect(record.status).toBe('complete');
    expect(record.location?.label).toBeUndefined();
    expect(record.location?.source).toBe('cache');
    expect(record.createdAt).toBe(100);
  });

  test('merges imported records by id and keeps the newest update', async () => {
    const domain = await loadDomain();
    expect(domain).not.toBeNull();
    if (!domain) return;

    const existing = [{ id: 'same', updatedAt: 10, title: 'Old' }];
    const incoming = [
      { id: 'same', updatedAt: 20, title: 'New' },
      { id: 'added', updatedAt: 15, title: 'Added' },
    ];
    const merged = domain.mergeRecordsByNewest(existing, incoming);

    expect(merged).toHaveLength(2);
    expect(merged.find((item: { id: string }) => item.id === 'same')?.title).toBe('New');
  });
});
