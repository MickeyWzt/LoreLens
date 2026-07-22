
import React, { useEffect, useRef, useState } from 'react';
import { LazyMotion, useDragControls, useReducedMotion, type PanInfo, type TargetAndTransition } from 'motion/react';
import * as m from 'motion/react-m';
import { useTranslation } from 'react-i18next';
import { DecipherResult } from '../types';
import { triggerHaptic } from '../utils';
import { IconChevronDown, IconShare, IconSpeaker } from './Icons';
import { cancelSpeech, speakText } from '../services/speechService';
import { useSettingsStore } from '../store/useSettingsStore';

interface ResultDrawerProps {
  result: DecipherResult | null;
  isOpen: boolean;
  onClose: () => void;
  onShowNotification?: (msg: string) => void;
}

const loadMotionFeatures = () => import('../motionFeatures').then((module) => module.default);

const projectMomentum = (velocity: number, decelerationRate = 0.99) => (
  (velocity / 1000) * decelerationRate / (1 - decelerationRate)
);

export const shouldDismissResultDrawer = ({
  offsetY,
  velocityY,
  drawerHeight,
}: {
  offsetY: number;
  velocityY: number;
  drawerHeight: number;
}) => {
  if (offsetY <= 0 && velocityY <= 0) return false;
  const projectedY = Math.max(0, offsetY) + Math.max(0, projectMomentum(velocityY));
  const threshold = Math.min(160, Math.max(96, drawerHeight * 0.18));
  return projectedY >= threshold;
};

export const ResultDrawer: React.FC<ResultDrawerProps> = ({ 
    result, 
    isOpen, 
    onClose, 
    onShowNotification
}) => {
  const { t } = useTranslation();
  const { readAloudEnabled: showAudioPlayer, language, reduceMotion } = useSettingsStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [animationTarget, setAnimationTarget] = useState<TargetAndTransition>({
    y: 0,
    opacity: 1,
    transition: { type: 'spring', bounce: 0, duration: 0.32 },
  });
  const drawerRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();
  const prefersReducedMotion = useReducedMotion();
  const shouldReduceMotion = reduceMotion || prefersReducedMotion;
  const stopAudio = () => {
    cancelSpeech();
    setIsPlaying(false);
    setIsLoadingAudio(false);
  };

  useEffect(() => {
    if (!isOpen) {
      stopAudio();
    } else {
      setIsDismissing(false);
      setAnimationTarget({
        y: 0,
        opacity: 1,
        transition: shouldReduceMotion
          ? { duration: 0.14, ease: 'easeOut' }
          : { type: 'spring', bounce: 0, duration: 0.32 },
      });
      triggerHaptic(50);
    }
    return () => cancelSpeech();
  }, [isOpen, shouldReduceMotion]);

  const dismissDrawer = (velocity = 0, hasMomentum = false) => {
    setIsDismissing(true);
    if (shouldReduceMotion) {
      setAnimationTarget({ opacity: 0, transition: { duration: 0.14, ease: 'easeOut' } });
    } else {
      const dismissalY = Math.max(window.innerHeight, drawerRef.current?.offsetHeight || 0);
      setAnimationTarget({
        y: dismissalY,
        opacity: 0.9,
        transition: {
          type: 'spring',
          bounce: hasMomentum ? 0.18 : 0,
          duration: 0.32,
          velocity,
        },
      });
    }
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const drawerHeight = drawerRef.current?.getBoundingClientRect().height || window.innerHeight;
    if (shouldDismissResultDrawer({ offsetY: info.offset.y, velocityY: info.velocity.y, drawerHeight })) {
      dismissDrawer(info.velocity.y, true);
      return;
    }

    setAnimationTarget({
      y: 0,
      opacity: 1,
      transition: { type: 'spring', bounce: 0, duration: 0.32, velocity: info.velocity.y },
    });
  };

  const handlePlayAudio = async () => {
    if (!result) return;
    if (isPlaying || isLoadingAudio) {
      stopAudio();
      return;
    }

    setIsLoadingAudio(true);
    try {
      const text = `${result.title}. ${result.essence}. ${t('result.mirror')}: ${result.mirrorInsight}.`;
      setIsPlaying(true);
      setIsLoadingAudio(false);
      await speakText(text, language);
    } catch (error) {
      onShowNotification?.(error instanceof Error ? error.message : t('result.shareError'));
    } finally {
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  const handleShare = async () => {
    if (!result) return;
    const text = `${result.title}\n\n${result.essence}\n\n"${result.mirrorInsight}"\n\n- via LoreLens`;
    const url = result.mapUri || window.location.href;
    const shareData = { title: `LoreLens: ${result.title}`, text: text, url: url };

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

  if (!result || !isOpen) return null;
  // Dynamic Styles
  const cardBg = 'bg-[var(--ll-surface-strong)] border-[var(--ll-border)]';
  const textMain = 'text-[var(--ll-text)]';
  const textSub = 'text-[var(--ll-text-sub)]';
  const textMuted = 'text-[var(--ll-text-muted)]';
  const iconBtn = 'border-[var(--ll-border)] bg-[var(--ll-surface-soft)] text-[var(--ll-text)]';
  
  // Section Styles
  const mirrorBg = 'bg-[var(--ll-text)] border-[var(--ll-text)]';
  const mirrorText = 'text-[var(--ll-canvas)]';
  const actionBg = 'bg-[var(--ll-accent-soft)] border-[var(--ll-accent-border)]';
  const actionText = 'text-[var(--ll-accent)]';

  return (
    <LazyMotion features={loadMotionFeatures} strict>
    <m.div
      ref={drawerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lorelens-result-title"
      className="fixed inset-x-0 bottom-0 z-40"
      initial={shouldReduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0.92 }}
      animate={animationTarget}
      drag={shouldReduceMotion || isDismissing ? false : 'y'}
      dragControls={dragControls}
      dragListener={false}
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0, bottom: 0.28 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onAnimationComplete={() => {
        if (!isDismissing) return;
        triggerHaptic(24);
        onClose();
      }}
    >
      <div className="relative mx-auto w-full max-w-lg">
        <div 
            className="absolute -top-14 inset-x-0 flex justify-center"
        >
            <button 
                aria-label={t('aria.close')}
                onClick={() => dismissDrawer()}
                className="ll-icon-button h-11 w-11 rounded-2xl text-white"
            >
                <IconChevronDown className="w-6 h-6" />
            </button>
        </div>

        <div className={`ll-sheet-material relative h-[88dvh] overflow-hidden rounded-t-[2rem] border-t ${cardBg}`}>
            <div
                data-result-drawer-handle
                className="ll-drag-handle absolute inset-x-0 top-0 z-10 flex h-9 cursor-grab items-center justify-center active:cursor-grabbing"
                onPointerDown={(event) => {
                  if (!shouldReduceMotion) dragControls.start(event);
                }}
                aria-hidden="true"
            >
                <div className="h-1 w-10 rounded-full bg-[var(--ll-border-strong)]" />
            </div>

            <div className="no-scrollbar h-full overflow-y-auto overflow-x-hidden overscroll-contain">
              <div className="relative space-y-7 px-6 pb-[max(3rem,env(safe-area-inset-bottom))] pt-10 sm:px-8">
                
                {/* Header: Title & Actions */}
                <div className="flex items-start justify-between gap-5">
                    <div className="min-w-0">
                        <p className={`mb-3 font-mono text-[9px] uppercase tracking-[0.22em] ${textMuted}`}>01 · {t('result.essence')}</p>
                        <h2 id="lorelens-result-title" className={`font-serif text-[clamp(2.65rem,11vw,4rem)] font-normal leading-[0.94] tracking-[-0.04em] ${textMain}`}>
                            {result.title}
                        </h2>
                    </div>
                    <div className="mt-1 flex shrink-0 gap-2">
                        {showAudioPlayer && (
                            <button 
                                aria-label={t('aria.readAloud')}
                                onClick={handlePlayAudio}
                                disabled={isLoadingAudio}
                                className={`ll-pressable flex h-10 w-10 items-center justify-center rounded-xl border transition-[transform,background-color] duration-150 ${
                                    isPlaying ? 'border-[var(--ll-accent)] bg-[var(--ll-accent)] text-[var(--ll-on-accent)]' :
                                    isLoadingAudio ? 'border-[var(--ll-accent-border)] bg-[var(--ll-accent-soft)] text-[var(--ll-accent)]' :
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
                            aria-label={t('aria.share')}
                            onClick={handleShare}
                            className={`ll-pressable flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-150 ${iconBtn}`}
                        >
                            <IconShare className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* The Essence */}
                <div className="border-y border-[var(--ll-border)] py-5">
                    <p className={`text-[19px] font-semibold leading-relaxed tracking-[-0.015em] ${textMain}`}>
                        {result.essence}
                    </p>
                </div>

                {/* Mirror Insight (Feature Highlight) */}
                <div className={`relative overflow-hidden rounded-[1.7rem] border p-6 ${mirrorBg}`}>
                    <div className="relative z-10">
                        <h3 className={`mb-5 flex items-center gap-3 font-mono text-[9px] font-medium uppercase tracking-[0.22em] ${mirrorText}`}>
                            <span className="h-px w-7 bg-current opacity-45"></span>
                            02 · {t('result.mirror')}
                        </h3>
                        <p className={`font-serif text-[1.45rem] italic leading-[1.38] tracking-[-0.02em] ${mirrorText}`}>
                            “{result.mirrorInsight}”
                        </p>
                    </div>
                </div>

                {/* Philosophy */}
                <div className="grid grid-cols-[2.6rem_1fr] gap-3">
                    <p className={`pt-1 font-mono text-[9px] tracking-[0.16em] ${textMuted}`}>03</p>
                    <div>
                    <h3 className={`mb-2 text-[11px] font-bold uppercase tracking-[0.16em] ${textMuted}`}>{t('result.philosophy')}</h3>
                    <p className={`text-[15px] leading-relaxed ${textSub}`}>
                        {result.philosophy}
                    </p>
                    </div>
                </div>

                {/* Quick Action */}
                <div className={`mt-8 flex items-start gap-4 rounded-[1.45rem] border p-5 ${actionBg}`}>
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/20">
                         <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                    </div>
                    <div>
                        <h3 className={`mb-1 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] opacity-70 ${actionText}`}>04 · {t('result.action')}</h3>
                        <p className={`text-[15px] font-semibold leading-relaxed ${actionText}`}>{result.quickAction}</p>
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
                
              </div>
            </div>
        </div>
      </div>
    </m.div>
    </LazyMotion>
  );
};
