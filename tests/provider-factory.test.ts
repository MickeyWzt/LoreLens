import { describe, expect, test, vi } from 'vitest';

async function loadProviders() {
  return import('../server/ai/providers').catch(() => null);
}

describe('AI provider factory', () => {
  test('routes vision to Qwen and recap text to DeepSeek', async () => {
    const module = await loadProviders();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({
          title: 'Temple guardian',
          essence: 'A protective roof figure.',
          mirrorInsight: 'It works like a gargoyle.',
          philosophy: 'Visibility expresses hierarchy.',
          quickAction: 'Count the figures.',
        }) } }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: JSON.stringify({
          journal: 'I noticed a city through its details.',
          score: 74,
          mood: 'Curious',
          tags: ['detail', 'history', 'city'],
          philosophicalTake: 'Attention turns travel into memory.',
          archetype: 'The Detail Seeker',
        }) } }] }),
      });

    const ai = module.createAiService({
      vision: {
        provider: 'qwen',
        apiKey: 'qwen-key',
        model: 'qwen-vl-max-latest',
        baseUrl: 'https://dashscope.example/v1',
      },
      text: {
        provider: 'deepseek',
        apiKey: 'deepseek-key',
        model: 'deepseek-chat',
        baseUrl: 'https://deepseek.example/v1',
      },
      timeoutMs: 1_000,
    }, fetchImpl as unknown as typeof fetch);

    const deciphered = await ai.decipher({
      base64Image: 'data:image/jpeg;base64,YQ==',
      language: 'en',
    });
    const recap = await ai.recap({ language: 'en', records: [{ title: deciphered.title }] });

    expect(deciphered.title).toBe('Temple guardian');
    expect(recap.score).toBe(74);
    expect(String(fetchImpl.mock.calls[0][0])).toContain('dashscope.example');
    expect(String(fetchImpl.mock.calls[1][0])).toContain('deepseek.example');
  });
});
