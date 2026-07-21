import { afterEach, describe, expect, test, vi } from 'vitest';
import { createMimoTtsService, createQwenTtsService, createTtsService } from '../server/tts/service';

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

describe('Qwen TTS service', () => {
  afterEach(() => vi.unstubAllGlobals());

  const qwenConfig = {
    apiKey: 'qwen-secret',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1/',
    model: 'qwen3-tts-flash',
    timeoutMs: 2_000,
    voice: 'Cherry',
  };

  test('maps a supported language and decodes inline audio', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      output: { audio: { data: Buffer.from('RIFF-qwen').toString('base64'), url: '' } },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createQwenTtsService(qwenConfig).synthesize('Bienvenue.', 'fr');

    expect(result.audio.toString()).toBe('RIFF-qwen');
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation');
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      model: 'qwen3-tts-flash',
      input: { text: 'Bienvenue.', voice: 'Cherry', language_type: 'French' },
    });
    expect(String(options.body)).not.toContain('qwen-secret');
  });

  test('maps every official non-Xiaomi app language to Qwen', async () => {
    const fetchMock = vi.fn().mockImplementation(async () => new Response(JSON.stringify({
      output: { audio: { data: Buffer.from('RIFF-qwen').toString('base64') } },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = createQwenTtsService(qwenConfig);
    const cases = [
      ['ja', 'Japanese'],
      ['ko', 'Korean'],
      ['es', 'Spanish'],
      ['fr', 'French'],
      ['de', 'German'],
      ['it', 'Italian'],
      ['pt', 'Portuguese'],
      ['ru', 'Russian'],
    ] as const;

    for (const [language] of cases) {
      await service.synthesize('LoreLens', language);
    }

    expect(fetchMock).toHaveBeenCalledTimes(cases.length);
    const sentLanguages = fetchMock.mock.calls.map(([, options]) => (
      JSON.parse(String((options as RequestInit).body)).input.language_type
    ));
    expect(sentLanguages).toEqual(cases.map(([, languageType]) => languageType));
  });

  test('downloads only trusted Aliyun audio URLs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output: { audio: { data: '', url: 'http://dashscope-result.oss-cn-beijing.aliyuncs.com/audio.wav' } },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(Buffer.from('RIFF-url'), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createQwenTtsService(qwenConfig).synthesize('Hola.', 'es');

    expect(result.audio.toString()).toBe('RIFF-url');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('https://dashscope-result.oss-cn-beijing.aliyuncs.com/audio.wav');
  });

  test('routes Chinese and English to MiMo and the other official languages to Qwen', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { audio: { data: Buffer.from('RIFF-mimo').toString('base64') } } }],
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        output: { audio: { data: Buffer.from('RIFF-qwen').toString('base64') } },
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const service = createTtsService({ mimo: config, qwen: qwenConfig });

    expect((await service.synthesize('你好', 'zh')).audio.toString()).toBe('RIFF-mimo');
    expect((await service.synthesize('こんにちは', 'ja')).audio.toString()).toBe('RIFF-qwen');
  });

  test('rejects Arabic so the client can use its device voice', async () => {
    vi.stubGlobal('fetch', vi.fn());
    await expect(createQwenTtsService(qwenConfig).synthesize('مرحبًا', 'ar')).rejects.toMatchObject({
      status: 422,
      code: 'TTS_LANGUAGE_UNSUPPORTED',
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
