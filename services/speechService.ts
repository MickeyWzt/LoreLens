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

export function cancelSpeech(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function speakText(text: string, language: AppLanguage): Promise<void> {
  if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
    return Promise.reject(new Error('Speech synthesis is unavailable'));
  }

  cancelSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANGUAGE[language];
  const languagePrefix = utterance.lang.split('-')[0].toLowerCase();
  const voice = window.speechSynthesis.getVoices().find((candidate) => (
    candidate.lang.toLowerCase().startsWith(languagePrefix)
  ));
  if (voice) utterance.voice = voice;

  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve();
    utterance.onerror = (event) => reject(new Error(event.error || 'Speech synthesis failed'));
    window.speechSynthesis.speak(utterance);
  });
}
