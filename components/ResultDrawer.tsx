
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { DecipherResult } from '../types';
import { triggerHaptic } from '../utils';
import { IconChevronDown, IconShare, IconSpeaker } from './Icons';
import { generateSpeech } from '../services/geminiService';
import { useSettingsStore } from '../store/useSettingsStore';

interface ResultDrawerProps {
  result: DecipherResult | null;
  isOpen: boolean;
  onClose: () => void;
  onShowNotification?: (msg: string) => void;
}

// Helper: Decode Base64 to Uint8Array
const base64ToUint8Array = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

// Helper: Convert PCM Data to WAV Blob
const createWavBlob = (data: Uint8Array, sampleRate: number): Blob => {
  const numChannels = 1;
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = new ArrayBuffer(44 + dataInt16.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataInt16.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataInt16.length * 2, true);

  let offset = 44;
  for (let i = 0; i < dataInt16.length; i++) {
      view.setInt16(offset, dataInt16[i], true);
      offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
};

export const ResultDrawer: React.FC<ResultDrawerProps> = ({ 
    result, 
    isOpen, 
    onClose, 
    onShowNotification
}) => {
  const { t } = useTranslation();
  const { theme, highResAudio: showAudioPlayer, language } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = () => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsLoadingAudio(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopAudio();
      if (audioUrl) {
          URL.revokeObjectURL(audioUrl);
          setAudioUrl(null);
      }
    } else {
      triggerHaptic(50);
    }
  }, [isOpen]);

  const handlePlayAudio = async () => {
    if (!result) return;
    if (isPlaying || isLoadingAudio) {
      if (audioRef.current) {
         if (isPlaying) {
             audioRef.current.pause();
             setIsPlaying(false);
         } else {
             audioRef.current.play().catch(err => {
                 if (err.name !== 'AbortError') console.error("Play error:", err);
             });
             setIsPlaying(true);
         }
      }
      return;
    }

    if (audioUrl && audioRef.current) {
       audioRef.current.play().catch(err => {
           if (err.name !== 'AbortError') console.error("Play error:", err);
       });
       setIsPlaying(true);
       return;
    }

    setIsLoadingAudio(true);
    try {
      const text = `${result.title}. ${result.essence}. ${t('result.mirror')}: ${result.mirrorInsight}.`;
      const base64Audio = await generateSpeech(text);
      const audioBytes = base64ToUint8Array(base64Audio);
      const wavBlob = createWavBlob(audioBytes, 24000);
      const blobUrl = URL.createObjectURL(wavBlob);
      setAudioUrl(blobUrl);

      if (audioRef.current) {
          audioRef.current.src = blobUrl;
          
          if ('mediaSession' in navigator) {
              navigator.mediaSession.metadata = new MediaMetadata({
                  title: result.title,
                  artist: "Context Lens",
                  artwork: [
                      { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml' }
                  ]
              });
              
              navigator.mediaSession.setActionHandler('play', () => {
                  audioRef.current?.play().catch(() => {});
                  setIsPlaying(true);
              });
              navigator.mediaSession.setActionHandler('pause', () => {
                  audioRef.current?.pause();
                  setIsPlaying(false);
              });
          }

          audioRef.current.play().then(() => {
              setIsPlaying(true);
              setIsLoadingAudio(false);
          }).catch(err => {
              if (err.name !== 'AbortError') {
                  console.error("Playback failed", err);
              }
              setIsLoadingAudio(false);
          });
      }
    } catch (error) {
      console.error("Failed to play audio:", error);
      setIsLoadingAudio(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const text = `${result.title}\n\n${result.essence}\n\n"${result.mirrorInsight}"\n\n- via Context Lens`;
    const url = result.mapUri || window.location.href;
    const shareData = { title: `Context Lens: ${result.title}`, text: text, url: url };

    if (navigator.share) {
        try {
            await navigator.share(shareData);
            return;
        } catch (e) {
            if ((e as Error).name === 'AbortError') return;
        }
    }
    try {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        onShowNotification?.(t('result.share'));
    } catch (e) {
        onShowNotification?.(t('result.shareError'));
    }
  };

  if (!result) return null;
  const isDark = theme === 'dark';
  
  // Dynamic Styles
  const cardBg = isDark ? 'bg-[#121212] border-white/10' : 'bg-white border-gray-200';
  const textMain = isDark ? 'text-white' : 'text-gray-900';
  const textSub = isDark ? 'text-gray-300' : 'text-gray-600';
  const textMuted = isDark ? 'text-gray-400' : 'text-gray-500';
  const iconBtn = isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700';
  
  // Section Styles
  const essenceBg = isDark ? 'bg-zinc-900/50' : 'bg-gray-50';
  const mirrorBg = isDark ? 'bg-indigo-950/30 border-indigo-500/30' : 'bg-indigo-50 border-indigo-100';
  const mirrorText = isDark ? 'text-indigo-200' : 'text-indigo-900';
  const actionBg = isDark ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200';
  const actionText = isDark ? 'text-emerald-200' : 'text-emerald-900';

  return (
    <div 
      className={`fixed inset-x-0 bottom-0 z-40 transform transition-transform duration-[600ms] cubic-bezier(0.19, 1, 0.22, 1) ${
        isOpen ? 'translate-y-0' : 'translate-y-[110%]'
      }`}
    >
      <div className="relative mx-auto w-full max-w-md">
        {/* Drawer Handle */}
        <div 
            className={`absolute -top-14 inset-x-0 flex justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100 delay-300' : 'opacity-0'}`}
        >
            <button 
                onClick={onClose}
                className="glass-panel rounded-full p-2.5 text-white active:scale-90 transition-transform duration-200"
            >
                <IconChevronDown className="w-6 h-6" />
            </button>
        </div>

        {/* Card Content */}
        <div className={`rounded-t-[2.5rem] border-t shadow-[0_-10px_40px_rgba(0,0,0,0.3)] overflow-hidden h-[85vh] overflow-y-auto no-scrollbar ${cardBg}`}>
            {/* Background Glow */}
            {isDark && (
                <div className="absolute top-0 start-1/2 rtl:translate-x-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/10 blur-[60px] pointer-events-none" />
            )}

            <audio 
                ref={audioRef} 
                src={audioUrl || undefined} 
                onEnded={() => setIsPlaying(false)} 
                className="hidden" 
            />

            <div className="p-8 pb-16 space-y-8 relative">
                
                {/* Header: Title & Actions */}
                <div className="flex justify-between items-start animate-fade-in-up delay-100">
                    <h2 className={`text-4xl font-extralight tracking-tight pe-4 leading-tight ${textMain}`}>
                        {result.title}
                    </h2>
                    <div className="flex gap-3 shrink-0 mt-1">
                        {showAudioPlayer && (
                            <button 
                                onClick={handlePlayAudio}
                                disabled={isLoadingAudio}
                                className={`p-2.5 rounded-full transition-all duration-300 active:scale-90 ${
                                    isPlaying ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 
                                    isLoadingAudio ? 'bg-indigo-900/50 text-indigo-200' :
                                    iconBtn
                                }`}
                            >
                                {isLoadingAudio ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <IconSpeaker className={`w-5 h-5 ${isPlaying ? 'fill-current' : ''}`} />
                                )}
                            </button>
                        )}
                        <button 
                            onClick={handleShare}
                            className={`transition-all duration-200 p-2.5 rounded-full active:scale-90 ${iconBtn}`}
                        >
                            <IconShare className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* The Essence */}
                <div className={`p-6 rounded-3xl border border-white/5 animate-fade-in-up delay-200 ${essenceBg}`}>
                    <h3 className={`text-xs font-bold uppercase tracking-[0.2em] mb-3 opacity-60 ${textMain}`}>{t('result.essence')}</h3>
                    <p className={`text-xl font-medium leading-relaxed ${textMain}`}>
                        {result.essence}
                    </p>
                </div>

                {/* Mirror Insight (Feature Highlight) */}
                <div className={`relative overflow-hidden p-6 rounded-3xl border animate-fade-in-up delay-300 group ${mirrorBg}`}>
                    {/* Shimmer Effect */}
                    <div className="absolute inset-0 animate-shimmer opacity-10 pointer-events-none"></div>
                    
                    <div className="relative z-10">
                        <h3 className={`text-xs font-bold uppercase tracking-[0.2em] mb-3 flex items-center gap-2 ${mirrorText}`}>
                            <span className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] animate-pulse"></span>
                            {t('result.mirror')}
                        </h3>
                        <p className={`text-lg italic font-serif leading-relaxed opacity-90 ${mirrorText}`}>
                            "{result.mirrorInsight}"
                        </p>
                    </div>
                </div>

                {/* Philosophy */}
                <div className="animate-fade-in-up delay-400 ps-2 border-s-2 border-white/10">
                    <h3 className={`text-xs font-bold uppercase tracking-[0.2em] mb-2 ps-4 ${textMuted}`}>{t('result.philosophy')}</h3>
                    <p className={`text-base font-light leading-relaxed ps-4 ${textSub}`}>
                        {result.philosophy}
                    </p>
                </div>

                {/* Quick Action */}
                <div className={`mt-8 p-5 rounded-2xl border flex items-start gap-4 animate-fade-in-up delay-500 ${actionBg}`}>
                    <div className="mt-1 w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-500">
                         <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div>
                        <h3 className={`text-sm font-bold uppercase tracking-wide mb-1 opacity-80 ${actionText}`}>{t('result.action')}</h3>
                        <p className={`text-base ${actionText}`}>{result.quickAction}</p>
                        {result.mapUri && (
                            <a 
                                href={result.mapUri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={`inline-block mt-3 text-sm font-medium underline underline-offset-4 ${actionText} hover:opacity-80`}
                            >
                                {t('map.openMaps')}
                            </a>
                        )}
                    </div>
                </div>
                
                {/* Spacer for bottom safe area */}
                <div className="h-8"></div>
            </div>
        </div>
      </div>
    </div>
  );
};
