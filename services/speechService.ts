import type { AppLanguage } from '../types';

const SPEECH_LANGUAGE: Record<AppLanguage, string> = {
  en: 'en-US',
  zh: 'zh-CN',
  ja: 'ja-JP',
  es: 'es-ES',
  fr: 'fr-FR',
  ru: 'ru-RU',
  ar: 'ar-SA',
};

const CLOUD_TTS_LANGUAGES = new Set<AppLanguage>(['zh', 'en', 'ja', 'es', 'fr', 'ru']);

let activeAudio: HTMLAudioElement | null = null;
let activeRequest: AbortController | null = null;
let activeObjectUrl: string | null = null;
let settleCancellation: (() => void) | null = null;

function releaseCloudAudio(): void {
  activeAudio = null;
  activeRequest = null;
  settleCancellation = null;
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
}

export function cancelSpeech(): void {
  const finishCancellation = settleCancellation;
  settleCancellation = null;
  activeRequest?.abort();
  activeRequest = null;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.removeAttribute('src');
    activeAudio.load();
  }
  releaseCloudAudio();
  finishCancellation?.();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function speakWithBrowser(text: string, language: AppLanguage): Promise<void> {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return Promise.reject(new Error('Speech synthesis is unavailable'));
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANGUAGE[language];
  const languagePrefix = utterance.lang.split('-')[0].toLowerCase();
  const voice = window.speechSynthesis.getVoices().find((candidate) => (
    candidate.lang.toLowerCase().startsWith(languagePrefix)
  ));
  if (voice) utterance.voice = voice;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      settleCancellation = null;
      if (error) reject(error);
      else resolve();
    };
    settleCancellation = () => finish();
    utterance.onend = () => finish();
    utterance.onerror = (event) => finish(new Error(event.error || 'Speech synthesis failed'));
    window.speechSynthesis.speak(utterance);
  });
}

async function speakWithMimo(text: string, language: AppLanguage): Promise<void> {
  const controller = new AbortController();
  activeRequest = controller;
  const response = await fetch('/api/tts/speech', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text, language }),
    signal: controller.signal,
  });
  activeRequest = null;
  if (!response.ok) throw new Error(`Cloud read aloud failed (${response.status})`);

  const audioBlob = await response.blob();
  if (!audioBlob.size) throw new Error('Cloud read aloud returned empty audio');
  activeObjectUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(activeObjectUrl);
  activeAudio = audio;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      releaseCloudAudio();
      if (error) reject(error);
      else resolve();
    };
    settleCancellation = () => finish();
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error('Cloud audio playback failed'));
    void audio.play().catch((error: unknown) => {
      finish(error instanceof Error ? error : new Error('Cloud audio playback failed'));
    });
  });
}

export async function speakText(text: string, language: AppLanguage): Promise<void> {
  cancelSpeech();
  if (CLOUD_TTS_LANGUAGES.has(language) && navigator.onLine !== false) {
    try {
      await speakWithMimo(text, language);
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      releaseCloudAudio();
    }
  }
  await speakWithBrowser(text, language);
}
