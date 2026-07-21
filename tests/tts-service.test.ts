import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMimoTtsService } from '../server/tts/service';

const config = {
  apiKey: 'test-secret',
  baseUrl: 'https://api.xiaomimimo.com/v1/',
  model: 'mimo-v2.5-tts',
  timeoutMs: 2_000,
  voices: { zh: '茉莉', en: 'Mia' },
};

describe('MiMo TTS service', () => {
  afterEach(() => vi.unstubAllGlobals());

  test('calls the V2.5 API without exposing the key in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { audio: { data: Buffer.from('RIFF-test').toString('base64') } } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createMimoTtsService(config).synthesize('欢迎来到故宫。', 'zh');

    expect(result.audio.toString()).toBe('RIFF-test');
    expect(result.contentType).toBe('audio/wav');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.xiaomimimo.com/v1/chat/completions');
    expect(options.headers).toMatchObject({ 'api-key': 'test-secret' });
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      model: 'mimo-v2.5-tts',
      audio: { format: 'wav', voice: '茉莉' },
    });
    expect(body.messages[1]).toEqual({ role: 'assistant', content: '欢迎来到故宫。' });
    expect(String(options.body)).not.toContain('test-secret');
  });

  test('rejects languages without an official built-in voice before making a request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(createMimoTtsService(config).synthesize('Bonjour', 'fr')).rejects.toMatchObject({
      status: 422,
      code: 'TTS_LANGUAGE_UNSUPPORTED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects malformed upstream audio instead of forwarding it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { audio: { data: 'not base64!' } } }],
    }), { status: 200 })));

    await expect(createMimoTtsService(config).synthesize('Hello', 'en')).rejects.toMatchObject({
      status: 502,
      code: 'INVALID_TTS_RESPONSE',
    });
  });
});
