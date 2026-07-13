import { GoogleGenAI } from '@google/genai';
import {
  parseDailyRecap,
  parseDecipherResult,
  type AppLanguage,
  type DailyRecapResult,
  type DecipherResult,
} from '../../domain/model';
import type { AiConfig, ProviderConfig } from '../config';
import { runWithFallback } from './orchestrator';

export interface DecipherInput {
  base64Image: string;
  language: AppLanguage;
  locationLabel?: string;
  location?: unknown;
}

export interface RecapInput {
  language: AppLanguage;
  records: unknown[];
}

export interface AiService {
  decipher(input: DecipherInput): Promise<DecipherResult>;
  recap(input: RecapInput): Promise<DailyRecapResult>;
}

const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: 'English',
  zh: 'Simplified Chinese',
  ja: 'Japanese',
  es: 'Spanish',
  fr: 'French',
  ru: 'Russian',
  ar: 'Arabic',
};

function providerError(status: number, payload: unknown): Error & { status: number; code?: string } {
  const code = payload && typeof payload === 'object'
    ? String((payload as { error?: { code?: string }; code?: string }).error?.code
      || (payload as { code?: string }).code || '')
    : '';
  return Object.assign(new Error(`AI provider request failed with status ${status}`), {
    status,
    code: code || undefined,
  });
}

function parseJsonObject(content: unknown): unknown {
  if (content && typeof content === 'object') return content;
  if (typeof content !== 'string') throw new Error('AI provider returned no JSON content');
  const trimmed = content.trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('AI provider returned malformed JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}

async function postOpenAiJson(
  config: ProviderConfig,
  body: unknown,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  if (!config.apiKey || !config.baseUrl) {
    throw Object.assign(new Error('AI provider is not configured'), { status: 503, code: 'NOT_CONFIGURED' });
  }
  const response = await fetchImpl(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw providerError(response.status, payload);
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message?.content;
  return parseJsonObject(content);
}

function visionPrompt(language: AppLanguage, locationLabel?: string): string {
  const locationHint = locationLabel
    ? `The traveler reports this location: ${locationLabel}. Treat it only as a hint.`
    : 'No reliable location is available. Do not invent one.';
  return `You are LoreLens, a cross-cultural travel interpreter. Identify and explain the visible subject. ${locationHint}
Return only one JSON object in ${LANGUAGE_NAMES[language]} with these keys: title, essence, mirrorInsight, philosophy, quickAction, and optional mapUri. Do not assume the image is from China or Beijing.`;
}

function recapPrompt(input: RecapInput): string {
  return `You are LoreLens, summarizing a traveler's observations without inventing facts. Write in ${LANGUAGE_NAMES[input.language]}.
Return only JSON with journal, score (0-100 based on the supplied evidence), mood, tags (1-8), philosophicalTake, and archetype.
Observations: ${JSON.stringify(input.records).slice(0, 24_000)}`;
}

function makeOpenAiVision(
  config: ProviderConfig,
  timeoutMs: number,
  fetchImpl: typeof fetch,
) {
  return async (input: DecipherInput) => parseDecipherResult(await postOpenAiJson(config, {
    model: config.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: input.base64Image } },
        { type: 'text', text: visionPrompt(input.language, input.locationLabel) },
      ],
    }],
    response_format: { type: 'json_object' },
    temperature: 0.2,
  }, timeoutMs, fetchImpl));
}

function makeOpenAiText(
  config: ProviderConfig,
  timeoutMs: number,
  fetchImpl: typeof fetch,
) {
  return async (input: RecapInput) => parseDailyRecap(await postOpenAiJson(config, {
    model: config.model,
    messages: [{ role: 'user', content: recapPrompt(input) }],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  }, timeoutMs, fetchImpl));
}

function makeGeminiVision(config: ProviderConfig) {
  return async (input: DecipherInput) => {
    if (!config.apiKey) {
      throw Object.assign(new Error('Gemini is not configured'), { status: 503, code: 'NOT_CONFIGURED' });
    }
    const match = input.base64Image.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) throw Object.assign(new Error('Invalid image data'), { status: 400 });
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: config.model,
      contents: [{ parts: [
        { inlineData: { mimeType: match[1], data: match[2] } },
        { text: visionPrompt(input.language, input.locationLabel) },
      ] }],
      config: { responseMimeType: 'application/json' },
    });
    return parseDecipherResult(parseJsonObject(response.text));
  };
}

function makeGeminiText(config: ProviderConfig) {
  return async (input: RecapInput) => {
    if (!config.apiKey) {
      throw Object.assign(new Error('Gemini is not configured'), { status: 503, code: 'NOT_CONFIGURED' });
    }
    const ai = new GoogleGenAI({ apiKey: config.apiKey });
    const response = await ai.models.generateContent({
      model: config.model,
      contents: recapPrompt(input),
      config: { responseMimeType: 'application/json' },
    });
    return parseDailyRecap(parseJsonObject(response.text));
  };
}

function visionTask(config: ProviderConfig, timeoutMs: number, fetchImpl: typeof fetch) {
  return config.provider === 'gemini'
    ? makeGeminiVision(config)
    : makeOpenAiVision(config, timeoutMs, fetchImpl);
}

function textTask(config: ProviderConfig, timeoutMs: number, fetchImpl: typeof fetch) {
  return config.provider === 'gemini'
    ? makeGeminiText(config)
    : makeOpenAiText(config, timeoutMs, fetchImpl);
}

export function createAiService(config: AiConfig, fetchImpl: typeof fetch = fetch): AiService {
  const primaryVision = visionTask(config.vision, config.timeoutMs, fetchImpl);
  const fallbackVision = config.visionFallback
    ? visionTask(config.visionFallback, config.timeoutMs, fetchImpl)
    : undefined;
  const primaryText = textTask(config.text, config.timeoutMs, fetchImpl);
  const fallbackText = config.textFallback
    ? textTask(config.textFallback, config.timeoutMs, fetchImpl)
    : undefined;

  return {
    decipher: (input) => runWithFallback(
      () => primaryVision(input),
      fallbackVision ? () => fallbackVision(input) : undefined,
    ),
    recap: (input) => runWithFallback(
      () => primaryText(input),
      fallbackText ? () => fallbackText(input) : undefined,
    ),
  };
}
