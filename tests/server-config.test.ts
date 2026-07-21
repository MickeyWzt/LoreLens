import { describe, expect, test } from 'vitest';

async function loadConfig() {
  return import('../server/config').catch(() => null);
}

describe('server config', () => {
  test('uses env-selected providers and supports a custom port', async () => {
    const module = await loadConfig();
    expect(module).not.toBeNull();
    if (!module) return;

    const config = module.readServerConfig({
      PORT: '4312',
      VISION_PROVIDER: 'gemini',
      TEXT_PROVIDER: 'deepseek',
      GEMINI_API_KEY: 'gemini-key',
      DEEPSEEK_API_KEY: 'deepseek-key',
      MIMO_API_KEY: 'mimo-key',
    });

    expect(config.port).toBe(4312);
    expect(config.ai.vision.provider).toBe('gemini');
    expect(config.ai.text.provider).toBe('deepseek');
    expect(config.capabilities).toMatchObject({ vision: true, text: true, tts: true });
    expect(config.tts).toMatchObject({
      mimo: {
        model: 'mimo-v2.5-tts',
        baseUrl: 'https://api.xiaomimimo.com/v1',
        voices: { zh: '茉莉', en: 'Mia' },
      },
      qwen: {
        model: 'qwen3-tts-flash',
        voice: 'Cherry',
      },
    });
  });

  test('reads proxy and public beta rate limits from the environment', async () => {
    const module = await loadConfig();
    expect(module).not.toBeNull();
    if (!module) return;

    const config = module.readServerConfig({
      TRUST_PROXY_HOPS: '1',
      API_RATE_LIMIT_PER_MINUTE: '120',
      AI_RATE_LIMIT_PER_DAY: '30',
      TTS_RATE_LIMIT_PER_DAY: '100',
    });

    expect(config.trustProxyHops).toBe(1);
    expect(config.rateLimits).toEqual({
      apiPerMinute: 120,
      aiPerDay: 30,
      ttsPerDay: 100,
    });
  });
});
