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

  test('returns a structured error after the public beta AI quota is exhausted', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const decipher = vi.fn().mockResolvedValue({
      title: 'Tower',
      essence: 'A landmark.',
      mirrorInsight: 'Location adds context.',
      philosophy: 'Evidence should converge.',
      quickAction: 'Look for signs.',
    });
    const app = module.createApiApp({
      ai: { decipher, recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: true, text: false, background: false },
      rateLimits: { apiPerMinute: 100, aiPerDay: 1, ttsPerDay: 100 },
    });
    const body = { base64Image: 'data:image/jpeg;base64,YQ==', language: 'en' };

    expect((await request(app).post('/api/ai/decipher').send(body)).status).toBe(200);
    const limited = await request(app).post('/api/ai/decipher').send(body);

    expect(limited.status).toBe(429);
    expect(limited.body.error).toMatchObject({ code: 'RATE_LIMITED', retryable: true });
    expect(limited.body.error.requestId).toEqual(expect.any(String));
    expect(decipher).toHaveBeenCalledTimes(1);
  });

  test('preserves the full location snapshot sent with a photo', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const decipher = vi.fn().mockResolvedValue({
      title: 'Tower',
      essence: 'A landmark.',
      mirrorInsight: 'Location adds context.',
      philosophy: 'Evidence should converge.',
      quickAction: 'Look for signs.',
    });
    const app = module.createApiApp({
      ai: { decipher, recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: true, text: true, background: false },
    });
    const location = {
      lat: 36.1147,
      lng: -115.1728,
      label: 'Las Vegas Strip, Nevada, USA',
      accuracy: 18,
      source: 'gps',
      approximate: false,
      capturedAt: 1_720_000_000_000,
    };
    const response = await request(app).post('/api/ai/decipher').send({
      base64Image: 'data:image/jpeg;base64,YQ==',
      language: 'en',
      location,
    });

    expect(response.status).toBe(200);
    expect(decipher).toHaveBeenCalledWith(expect.objectContaining({ location }));
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

  test('allows the configured map tiles and remote travel photos in the CSP', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const app = module.createApiApp({
      ai: { decipher: vi.fn(), recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: false, text: false, background: false },
    });
    const response = await request(app).get('/api/health');
    const policy = response.headers['content-security-policy'];

    expect(policy).toContain('https://a.basemaps.cartocdn.com');
    expect(policy).toContain('https://d.basemaps.cartocdn.com');
    expect(policy).toContain('https://images.unsplash.com');
    expect(policy).toContain("connect-src 'self' https://images.unsplash.com");
  });

  test('allows generated cloud narration audio blobs in the CSP', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const app = module.createApiApp({
      ai: { decipher: vi.fn(), recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: false, text: false, background: false },
    });
    const response = await request(app).get('/api/health');

    expect(response.headers['content-security-policy']).toContain("media-src 'self' blob:");
  });

  test('does not send a CSP while Vite development middleware is active', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const app = module.createApiApp({
      ai: { decipher: vi.fn(), recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: false, text: false, background: false },
      developmentMode: true,
    });
    const response = await request(app).get('/api/health');

    expect(response.headers['content-security-policy']).toBeUndefined();
  });

  test('returns cloud speech audio without caching it', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const synthesize = vi.fn().mockResolvedValue({
      audio: Buffer.from('RIFF-test'),
      contentType: 'audio/wav',
    });
    const app = module.createApiApp({
      ai: { decipher: vi.fn(), recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      tts: { synthesize },
      capabilities: { vision: false, text: false, tts: true, background: false },
    });
    const response = await request(app).post('/api/tts/speech').send({
      text: 'Welcome to LoreLens.',
      language: 'en',
    });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('audio/wav');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(synthesize).toHaveBeenCalledWith('Welcome to LoreLens.', 'en');
  });

  test('returns a structured error when cloud speech is not configured', async () => {
    const module = await loadApp();
    expect(module).not.toBeNull();
    if (!module) return;

    const app = module.createApiApp({
      ai: { decipher: vi.fn(), recap: vi.fn() },
      background: { getBackground: vi.fn(), trackDownload: vi.fn() },
      capabilities: { vision: false, text: false, tts: false, background: false },
    });
    const response = await request(app).post('/api/tts/speech').send({ text: 'Hello', language: 'en' });

    expect(response.status).toBe(503);
    expect(response.body.error).toMatchObject({ code: 'TTS_NOT_CONFIGURED', retryable: false });
  });
});
