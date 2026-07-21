import { z } from 'zod';
import type { AppLanguage } from '../../types';

export interface TtsConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  voices: Partial<Record<AppLanguage, string>>;
}

export interface SpeechAudio {
  audio: Buffer;
  contentType: 'audio/wav';
}

export interface TtsService {
  synthesize(text: string, language: AppLanguage): Promise<SpeechAudio>;
}

const mimoResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      audio: z.object({
        data: z.string().trim().min(1).max(16 * 1024 * 1024),
      }),
    }),
  })).min(1),
});

const STYLE_INSTRUCTIONS: Partial<Record<AppLanguage, string>> = {
  zh: '像一位亲切、见多识广的旅行向导一样自然讲述。语气温暖从容，节奏适中，地名清晰，不要夸张表演。',
  en: 'Speak like a warm, knowledgeable travel guide. Sound natural and composed, use a moderate pace, and pronounce place names clearly without theatrical exaggeration.',
};

class MimoTtsError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'MimoTtsError';
    this.status = status;
    this.code = code;
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function createMimoTtsService(config: TtsConfig): TtsService {
  return {
    async synthesize(text, language) {
      if (!config.apiKey) {
        throw new MimoTtsError('MiMo TTS is not configured.', 503, 'TTS_NOT_CONFIGURED');
      }
      const voice = config.voices[language];
      const style = STYLE_INSTRUCTIONS[language];
      if (!voice || !style) {
        throw new MimoTtsError(
          'MiMo built-in voices currently support Chinese and English only.',
          422,
          'TTS_LANGUAGE_UNSUPPORTED',
        );
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      let response: globalThis.Response;
      try {
        response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/chat/completions`, {
          method: 'POST',
          headers: {
            'api-key': config.apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'user', content: style },
              { role: 'assistant', content: text },
            ],
            audio: { format: 'wav', voice },
            stream: false,
          }),
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          const timeoutError = new MimoTtsError('MiMo TTS timed out.', 504, 'TTS_TIMEOUT');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 502;
        throw new MimoTtsError('MiMo TTS request failed.', status, 'TTS_UPSTREAM_ERROR');
      }

      const parsed = mimoResponseSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new MimoTtsError('MiMo returned an invalid audio response.', 502, 'INVALID_TTS_RESPONSE');
      }
      const encoded = parsed.data.choices[0].message.audio.data;
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        throw new MimoTtsError('MiMo returned invalid audio data.', 502, 'INVALID_TTS_RESPONSE');
      }
      const audio = Buffer.from(encoded, 'base64');
      if (audio.length === 0 || audio.length > 12 * 1024 * 1024) {
        throw new MimoTtsError('MiMo returned an invalid audio size.', 502, 'INVALID_TTS_RESPONSE');
      }
      return { audio, contentType: 'audio/wav' };
    },
  };
}
