import request from 'supertest';
import { describe, expect, test, vi } from 'vitest';

async function loadApp() {
  return import('../server/app').catch(() => null);
}

describe('server API', () => {
  test('returns a structured validation error for an invalid decipher request', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const app = module.createApiApp({
      ai: { decipher: vi.fn(), recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: true, text: true, background: false },
    });
    const response = await request(app).post('/api/ai/decipher').send({});

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      retryable: false,
    });
    expect(response.body.error.requestId).toEqual(expect.any(String));
  });

  test('normalizes a successful decipher response', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const decipher = vi.fn().mockResolvedValue({
      title: 'Roof guardian',
      essence: 'A protector.',
      mirrorInsight: 'Like a gargoyle.',
      philosophy: 'A visible hierarchy.',
      quickAction: 'Count the figures.',
    });
    const app = module.createApiApp({
      ai: { decipher, recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: true, text: true, background: false },
    });
    const response = await request(app).post('/api/ai/decipher').send({
      base64Image: 'data:image/jpeg;base64,YQ==',
      language: 'en',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.title).toBe('Roof guardian');
    expect(decipher).toHaveBeenCalledTimes(1);
  });

  test('returns no-content instead of an error when backgrounds are not configured', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const app = module.createApiApp({
      ai: { decipher: vi.fn(), recap: vi.fn() },
      background: { getBackground: vi.fn().mockResolvedValue(null), trackDownload: vi.fn() },
      capabilities: { vision: false, text: false, background: false },
    });
    const response = await request(app).get('/api/background?query=Paris&timeBucket=evening');

    expect(response.status).toBe(204);
  });
});
