import { GoogleGenAI } from '@google/genai';
import {
  parseDailyRecap,
  parseDecipherResult,
  type AppLanguage,
  type DailyRecapResult,
  type DecipherResult,
  type LocationSnapshot,
} from '../../domain/model';
import type { AiConfig, ProviderConfig } from '../config';
import { runWithFallback } from './orchestrator';

export interface DecipherInput {
  base64Image: string;
  language: AppLanguage;
  locationLabel?: string;
  location?: LocationSnapshot;
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

const LOCATION_SOURCE_LABELS: Record<LocationSnapshot['source'], string> = {
  gps: 'device GPS',
  exif: 'photo EXIF GPS',
  cache: 'cached device location',
  ip: 'coarse IP location',
  none: 'unavailable',
};

function locationEvidence(location?: LocationSnapshot, locationLabel?: string): string {
  if (!location || location.source === 'none') {
    return locationLabel
      ? `The traveler reports this location: ${locationLabel}. Treat it only as a weak hint.`
      : 'No reliable location is available. Do not invent one.';
  }
  const evidence = [
    location.label ? `label: ${location.label}` : undefined,
    location.lat !== undefined && location.lng !== undefined
      ? `coordinates: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
      : undefined,
    location.accuracy !== undefined ? `accuracy: ${Math.round(location.accuracy)} meters` : undefined,
    `source: ${LOCATION_SOURCE_LABELS[location.source]}`,
    `precision: ${location.approximate ? 'approximate' : 'precise'}`,
    `location captured at: ${new Date(location.capturedAt).toISOString()}`,
  ].filter(Boolean).join('; ');
  const strength = (location.source === 'gps' || location.source === 'exif')
    && !location.approximate
    && (location.accuracy === undefined || location.accuracy <= 500)
    ? 'Treat precise GPS or EXIF as strong evidence.'
    : 'Treat cached, approximate, or IP location only as weak evidence.';
  return `Photo location evidence (${evidence}). ${strength}`;
}

function visionPrompt(
  language: AppLanguage,
  location?: LocationSnapshot,
  locationLabel?: string,
): string {
  const locationHint = locationEvidence(location, locationLabel);
  return `You are LoreLens, a cross-cultural travel interpreter. Identify and explain the visible subject. ${locationHint}
Cross-check visual evidence with location evidence. If they conflict, or the subject may be a replica, say that the exact identity is uncertain instead of inventing a place. Only return mapUri when visual identification and location evidence agree.
Return only one JSON object in ${LANGUAGE_NAMES[language]} with these keys: title, essence, mirrorInsight, philosophy, quickAction, and optional mapUri. Do not assume the image is from China or Beijing.`;
}

function recapPrompt(input: RecapInput): string {
  return `You are LoreLens, summarizing a traveler's observations without inventing facts. Write in ${LANGUAGE_NAMES[input.language]}.
Return only JSON with journal, score (0-100 based on the supplied evidence), mood, tags (1-8), philosophicalTake, and archetype.
Observations: ${JSON.stringify(input.records).slice(0, 24_000)}`;
}

function mapCoordinates(mapUri: string): { lat: number; lng: number } | undefined {
  const direct = mapUri.match(/(?:@|geo:)(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (direct) return { lat: Number(direct[1]), lng: Number(direct[2]) };
  try {
    const url = new URL(mapUri);
    const candidate = url.searchParams.get('query')
      || url.searchParams.get('q')
      || url.searchParams.get('ll');
    const match = candidate?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    return match ? { lat: Number(match[1]), lng: Number(match[2]) } : undefined;
  } catch {
    return undefined;
  }
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const dLat = radians(b.lat - a.lat);
  const dLng = radians(b.lng - a.lng);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const value = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function enforceLocationConsistency(
  result: DecipherResult,
  location?: LocationSnapshot,
): DecipherResult {
  if (
    !location
    || location.lat === undefined
    || location.lng === undefined
    || location.approximate
    || (location.source !== 'gps' && location.source !== 'exif')
    || (location.accuracy !== undefined && location.accuracy > 500)
    || !result.mapUri
  ) return result;
  const mapped = mapCoordinates(result.mapUri);
  if (!mapped || distanceKm({ lat: location.lat, lng: location.lng }, mapped) <= 25) return result;
  const { mapUri: _conflictingMapUri, ...safeResult } = result;
  return safeResult;
}

function makeOpenAiVision(
  config: ProviderConfig,
  timeoutMs: number,
  fetchImpl: typeof fetch,
) {
  return async (input: DecipherInput) => {
    const result = parseDecipherResult(await postOpenAiJson(config, {
      model: config.model,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: input.base64Image } },
          { type: 'text', text: visionPrompt(input.language, input.location, input.locationLabel) },
        ],
      }],
      response_format: { type: 'json_object' },
      temperature: 0.2,
    }, timeoutMs, fetchImpl));
    return enforceLocationConsistency(result, input.location);
  };
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
        { text: visionPrompt(input.language, input.location, input.locationLabel) },
      ] }],
      config: { responseMimeType: 'application/json' },
    });
    return enforceLocationConsistency(
      parseDecipherResult(parseJsonObject(response.text)),
      input.location,
    );
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
