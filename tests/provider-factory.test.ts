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

  test('gives Qwen the complete photo location evidence and conflict guardrails', async () => {
    const module = await loadProviders();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        title: 'Replica tower',
        essence: 'A replica may be visible.',
        mirrorInsight: 'Context changes identity.',
        philosophy: 'Evidence should agree.',
        quickAction: 'Check nearby signs.',
      }) } }] }),
    });
    const ai = module.createAiService({
      vision: {
        provider: 'qwen',
        apiKey: 'qwen-key',
        model: 'qwen3.6-flash',
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

    await ai.decipher({
      base64Image: 'data:image/jpeg;base64,YQ==',
      language: 'en',
      location: {
        lat: 36.1147,
        lng: -115.1728,
        label: 'Las Vegas Strip, Nevada, USA',
        accuracy: 18,
        source: 'gps',
        approximate: false,
        capturedAt: 1_720_000_000_000,
      },
    });

    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    const text = request.messages[0].content.find((part: { type: string }) => part.type === 'text').text;
    expect(text).toContain('36.114700, -115.172800');
    expect(text).toContain('Las Vegas Strip, Nevada, USA');
    expect(text).toContain('18 meters');
    expect(text).toContain('device GPS');
    expect(text).toMatch(/replica/i);
    expect(text).toMatch(/mapUri.*agree/i);
  });

  test('treats an approximate GPS fix as weak evidence', async () => {
    const module = await loadProviders();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        title: 'City view', essence: 'A skyline.', mirrorInsight: 'Cities overlap.',
        philosophy: 'Uncertainty matters.', quickAction: 'Look for signs.',
      }) } }] }),
    });
    const ai = module.createAiService({
      vision: { provider: 'qwen', apiKey: 'q', model: 'qwen3.6-flash', baseUrl: 'https://q.example/v1' },
      text: { provider: 'deepseek', apiKey: 'd', model: 'deepseek-chat', baseUrl: 'https://d.example/v1' },
      timeoutMs: 1_000,
    }, fetchImpl as unknown as typeof fetch);

    await ai.decipher({
      base64Image: 'data:image/jpeg;base64,YQ==',
      language: 'en',
      location: { lat: 36.1, lng: -115.2, accuracy: 1_200, source: 'gps', approximate: true, capturedAt: 1 },
    });
    const request = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    const text = request.messages[0].content.find((part: { type: string }) => part.type === 'text').text;
    expect(text).toContain('Treat cached, approximate, or IP location only as weak evidence.');
  });

  test('removes a map link that conflicts with precise photo coordinates', async () => {
    const module = await loadProviders();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({
        title: 'Replica tower', essence: 'A tower.', mirrorInsight: 'Replicas travel.',
        philosophy: 'Context changes identity.', quickAction: 'Check the location.',
        mapUri: 'https://www.google.com/maps/place/Eiffel+Tower/@48.8584,2.2945,17z',
      }) } }] }),
    });
    const ai = module.createAiService({
      vision: { provider: 'qwen', apiKey: 'q', model: 'qwen3.6-flash', baseUrl: 'https://q.example/v1' },
      text: { provider: 'deepseek', apiKey: 'd', model: 'deepseek-chat', baseUrl: 'https://d.example/v1' },
      timeoutMs: 1_000,
    }, fetchImpl as unknown as typeof fetch);

    const result = await ai.decipher({
      base64Image: 'data:image/jpeg;base64,YQ==',
      language: 'en',
      location: { lat: 36.1147, lng: -115.1728, accuracy: 18, source: 'gps', approximate: false, capturedAt: 1 },
    });

    expect(result.mapUri).toBeUndefined();
  });
});
