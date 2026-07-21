import { z } from 'zod';
import type { AppLanguage } from '../../types';

export interface MimoTtsConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  voices: Partial<Record<AppLanguage, string>>;
}

export interface QwenTtsConfig {
  apiKey?: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  voice: string;
}

export interface TtsConfig {
  mimo: MimoTtsConfig;
  qwen: QwenTtsConfig;
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

const qwenResponseSchema = z.object({
  output: z.object({
    audio: z.object({
      data: z.string().nullable().optional(),
      url: z.string().nullable().optional(),
    }),
  }),
});

const STYLE_INSTRUCTIONS: Partial<Record<AppLanguage, string>> = {
  zh: '像一位亲切、见多识广的旅行向导一样自然讲述。语气温暖从容，节奏适中，地名清晰，不要夸张表演。',
  en: 'Speak like a warm, knowledgeable travel guide. Sound natural and composed, use a moderate pace, and pronounce place names clearly without theatrical exaggeration.',
};

const QWEN_LANGUAGE: Partial<Record<AppLanguage, string>> = {
  zh: 'Chinese',
  en: 'English',
  ja: 'Japanese',
  ko: 'Korean',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
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

export function createMimoTtsService(config: MimoTtsConfig): TtsService {
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

function trustedQwenAudioUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const trustedHost = (
      url.hostname === 'aliyuncs.com'
      || url.hostname.endsWith('.aliyuncs.com')
    );
    if (!trustedHost || (url.protocol !== 'https:' && url.protocol !== 'http:')) return null;
    // DashScope currently returns a signed HTTP OSS URL. Upgrade it before download.
    url.protocol = 'https:';
    return url.toString();
  } catch {
    return null;
  }
}

export function createQwenTtsService(config: QwenTtsConfig): TtsService {
  return {
    async synthesize(text, language) {
      if (!config.apiKey) {
        throw new MimoTtsError('Qwen TTS is not configured.', 503, 'TTS_NOT_CONFIGURED');
      }
      const languageType = QWEN_LANGUAGE[language];
      if (!languageType) {
        throw new MimoTtsError(
          'Qwen3-TTS-Flash does not officially support this language.',
          422,
          'TTS_LANGUAGE_UNSUPPORTED',
        );
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
      try {
        const response = await fetch(
          `${normalizeBaseUrl(config.baseUrl)}/services/aigc/multimodal-generation/generation`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${config.apiKey}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: config.model,
              input: {
                text,
                voice: config.voice,
                language_type: languageType,
              },
            }),
            signal: controller.signal,
          },
        );
        if (!response.ok) {
          const status = response.status === 429 ? 429 : response.status >= 500 ? 502 : 502;
          throw new MimoTtsError('Qwen TTS request failed.', status, 'TTS_UPSTREAM_ERROR');
        }
        const parsed = qwenResponseSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new MimoTtsError('Qwen returned an invalid audio response.', 502, 'INVALID_TTS_RESPONSE');
        }

        const { data, url } = parsed.data.output.audio;
        let audio: Buffer;
        if (data?.trim()) {
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
            throw new MimoTtsError('Qwen returned invalid audio data.', 502, 'INVALID_TTS_RESPONSE');
          }
          audio = Buffer.from(data, 'base64');
        } else if (url && trustedQwenAudioUrl(url)) {
          const audioResponse = await fetch(trustedQwenAudioUrl(url)!, { signal: controller.signal });
          if (!audioResponse.ok) {
            throw new MimoTtsError('Qwen audio download failed.', 502, 'TTS_UPSTREAM_ERROR');
          }
          audio = Buffer.from(await audioResponse.arrayBuffer());
        } else {
          throw new MimoTtsError('Qwen returned no trusted audio.', 502, 'INVALID_TTS_RESPONSE');
        }
        if (audio.length === 0 || audio.length > 12 * 1024 * 1024) {
          throw new MimoTtsError('Qwen returned an invalid audio size.', 502, 'INVALID_TTS_RESPONSE');
        }
        return { audio, contentType: 'audio/wav' };
      } catch (error) {
        if (controller.signal.aborted) {
          const timeoutError = new MimoTtsError('Qwen TTS timed out.', 504, 'TTS_TIMEOUT');
          timeoutError.name = 'TimeoutError';
          throw timeoutError;
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

export function createTtsService(config: TtsConfig): TtsService {
  const mimo = createMimoTtsService(config.mimo);
  const qwen = createQwenTtsService(config.qwen);
  return {
    synthesize(text, language) {
      if (language === 'zh' || language === 'en') {
        return mimo.synthesize(text, language);
      }
      return qwen.synthesize(text, language);
    },
  };
}
