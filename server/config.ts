import path from 'node:path';
import dotenv from 'dotenv';
import type { AppLanguage } from '../types';
import type { TtsConfig } from './tts/service';

export type VisionProviderName = 'qwen' | 'gemini';
export type TextProviderName = 'deepseek' | 'gemini';

export interface ProviderConfig<TProvider extends string = string> {
  provider: TProvider;
  apiKey?: string;
  model: string;
  baseUrl?: string;
}

export interface AiConfig {
  vision: ProviderConfig<VisionProviderName>;
  visionFallback?: ProviderConfig<VisionProviderName>;
  text: ProviderConfig<TextProviderName>;
  textFallback?: ProviderConfig<TextProviderName>;
  timeoutMs: number;
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  ai: AiConfig;
  tts: TtsConfig;
  unsplashAccessKey?: string;
  ipLocationUrl?: string;
  capabilities: { vision: boolean; text: boolean; tts: boolean; background: boolean; ipLocation: boolean };
}

const numberInRange = (value: string | undefined, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

const visionProvider = (value: string | undefined): VisionProviderName => (
  value?.toLowerCase() === 'gemini' ? 'gemini' : 'qwen'
);

const textProvider = (value: string | undefined): TextProviderName => (
  value?.toLowerCase() === 'gemini' ? 'gemini' : 'deepseek'
);

function visionConfig(provider: VisionProviderName, env: NodeJS.ProcessEnv) {
  if (provider === 'gemini') {
    return {
      provider,
      apiKey: env.GEMINI_API_KEY || env.API_KEY,
      model: env.GEMINI_VISION_MODEL || 'gemini-2.5-flash',
    };
  }
  return {
    provider,
    apiKey: env.QWEN_API_KEY || env.DASHSCOPE_API_KEY,
    model: env.QWEN_VISION_MODEL || 'qwen-vl-max-latest',
    baseUrl: env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  };
}

function textConfig(provider: TextProviderName, env: NodeJS.ProcessEnv) {
  if (provider === 'gemini') {
    return {
      provider,
      apiKey: env.GEMINI_API_KEY || env.API_KEY,
      model: env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash',
    };
  }
  return {
    provider,
    apiKey: env.DEEPSEEK_API_KEY,
    model: env.DEEPSEEK_TEXT_MODEL || 'deepseek-chat',
    baseUrl: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
  };
}

export function loadEnvironment(cwd = process.cwd()): void {
  dotenv.config({
    path: [path.join(cwd, '.env.local'), path.join(cwd, '.env')],
    override: false,
    quiet: true,
  });
}

export function readServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const selectedVision = visionProvider(env.VISION_PROVIDER);
  const selectedText = textProvider(env.TEXT_PROVIDER);
  const vision = visionConfig(selectedVision, env);
  const text = textConfig(selectedText, env);
  const requestedVisionFallback = env.VISION_FALLBACK_PROVIDER
    ? visionProvider(env.VISION_FALLBACK_PROVIDER)
    : 'gemini';
  const requestedTextFallback = env.TEXT_FALLBACK_PROVIDER
    ? textProvider(env.TEXT_FALLBACK_PROVIDER)
    : 'gemini';
  const candidateVisionFallback = visionConfig(requestedVisionFallback, env);
  const candidateTextFallback = textConfig(requestedTextFallback, env);
  const visionFallback = candidateVisionFallback.provider !== vision.provider
    && candidateVisionFallback.apiKey
    ? candidateVisionFallback
    : undefined;
  const textFallback = candidateTextFallback.provider !== text.provider
    && candidateTextFallback.apiKey
    ? candidateTextFallback
    : undefined;
  const mimoVoices: Partial<Record<AppLanguage, string>> = {
    zh: env.MIMO_TTS_VOICE_ZH || '茉莉',
    en: env.MIMO_TTS_VOICE_EN || 'Mia',
  };

  return {
    port: numberInRange(env.PORT, 3000, 1, 65_535),
    nodeEnv: env.NODE_ENV || 'development',
    ai: {
      vision,
      visionFallback,
      text,
      textFallback,
      timeoutMs: numberInRange(env.AI_TIMEOUT_MS, 30_000, 1_000, 120_000),
    },
    tts: {
      apiKey: env.MIMO_API_KEY,
      model: env.MIMO_TTS_MODEL || 'mimo-v2.5-tts',
      baseUrl: env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1',
      timeoutMs: numberInRange(env.MIMO_TTS_TIMEOUT_MS, 30_000, 1_000, 120_000),
      voices: mimoVoices,
    },
    unsplashAccessKey: env.UNSPLASH_ACCESS_KEY,
    ipLocationUrl: env.IP_LOCATION_URL,
    capabilities: {
      vision: Boolean(vision.apiKey),
      text: Boolean(text.apiKey),
      tts: Boolean(env.MIMO_API_KEY),
      background: Boolean(env.UNSPLASH_ACCESS_KEY),
      ipLocation: Boolean(env.IP_LOCATION_URL),
    },
  };
}

export function loadServerConfig(cwd = process.cwd()): ServerConfig {
  loadEnvironment(cwd);
  return readServerConfig(process.env);
}
