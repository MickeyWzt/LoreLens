// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

class MockUtterance {
  text: string;
  lang = '';
  voice: SpeechSynthesisVoice | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

describe('speech service', () => {
  const browserSpeak = vi.fn((utterance: MockUtterance) => queueMicrotask(() => utterance.onend?.()));

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel: vi.fn(), getVoices: vi.fn(() => []), speak: browserSpeak },
    });
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:mimo') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    browserSpeak.mockClear();
  });

  afterEach(() => vi.unstubAllGlobals());

  test('plays MiMo audio for English without invoking browser TTS', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      blob: vi.fn().mockResolvedValue(new Blob(['RIFF'], { type: 'audio/wav' })),
    }));
    class MockAudio {
      onended: (() => void) | null = null;
      onerror: (() => void) | null = null;
      pause = vi.fn();
      load = vi.fn();
      removeAttribute = vi.fn();
      play = vi.fn(async () => queueMicrotask(() => this.onended?.()));
    }
    vi.stubGlobal('Audio', MockAudio);

    const { speakText } = await import('../services/speechService');
    await speakText('Welcome to the old city.', 'en');

    expect(fetch).toHaveBeenCalledWith('/api/tts/speech', expect.objectContaining({ method: 'POST' }));
    expect(browserSpeak).not.toHaveBeenCalled();
  });

  test('uses browser TTS directly for languages outside the configured cloud providers', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { speakText } = await import('../services/speechService');

    await speakText('مرحبًا بكم في المدينة القديمة.', 'ar');

    expect(fetch).not.toHaveBeenCalled();
    expect(browserSpeak).toHaveBeenCalledOnce();
  });

  test('uses cloud TTS for newly added official Qwen languages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { speakText } = await import('../services/speechService');

    await speakText('Willkommen in der Altstadt.', 'de');

    expect(fetch).toHaveBeenCalledOnce();
    expect(browserSpeak).toHaveBeenCalledOnce();
  });

  test('falls back to browser TTS when the cloud request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { speakText } = await import('../services/speechService');

    await speakText('Welcome back.', 'en');

    expect(fetch).toHaveBeenCalledOnce();
    expect(browserSpeak).toHaveBeenCalledOnce();
  });
});
