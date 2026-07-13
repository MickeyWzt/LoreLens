import { describe, expect, test } from 'vitest';

async function loadRecords() {
  return import('../domain/records').catch(() => null);
}

describe('versioned records', () => {
  test('creates an offline pending record that keeps the cropped image', async () => {
    const module = await loadRecords();
    expect(module).not.toBeNull();
    if (!module) return;

    const record = module.createPendingRecord({
      id: 'pending-1',
      image: 'data:image/jpeg;base64,YQ==',
      thumbnail: 'data:image/webp;base64,Yg==',
      language: 'en',
      createdAt: 100,
    });

    expect(record).toMatchObject({ schemaVersion: 2, status: 'pending', updatedAt: 100 });
    expect(record.image).toContain('base64');
  });

  test('validates imports and keeps the newest record for each id', async () => {
    const module = await loadRecords();
    expect(module).not.toBeNull();
    if (!module) return;

    const older = module.createPendingRecord({
      id: 'same', image: 'old', language: 'en', createdAt: 10,
    });
    const newer = { ...older, image: 'new', updatedAt: 20 };
    const json = JSON.stringify({ schemaVersion: 2, exportedAt: 30, records: [newer] });

    const merged = module.importRecords(json, [older]);
    expect(merged[0].image).toBe('new');
    expect(() => module.importRecords('{"schemaVersion":1}', [])).toThrow();
  });

  test('defers a failed analysis without losing its local image', async () => {
    const module = await loadRecords();
    expect(module).not.toBeNull();
    if (!module) return;

    const failed = {
      ...module.createPendingRecord({
        id: 'failed-1', image: 'local-image', language: 'en', createdAt: 10,
      }),
      status: 'failed' as const,
      error: { code: 'RATE_LIMITED', message: 'Busy', retryable: true, requestId: 'req-1' },
    };

    expect(module.deferAnalysisRecord(failed, 20)).toMatchObject({
      id: 'failed-1', status: 'pending', image: 'local-image', updatedAt: 20,
    });
    expect(module.deferAnalysisRecord(failed, 20).error).toBeUndefined();
  });
});
