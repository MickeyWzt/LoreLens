import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCamera, IconHistory, IconSettings } from './Icons';
import { useAppContextStore } from '../store/useAppContextStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { backgroundQueryForLocation, trackBackgroundDownload } from '../services/backgroundService';
import { getAccentStyles } from '../utils/accent';
import { triggerHaptic } from '../utils';

interface HomeViewProps {
  onScanStart: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
}

const timeBucket = () => {
  const hour = new Date().getHours();
  if (hour < 5) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 20) return 'evening';
  return 'night';
};

export const HomeView: React.FC<HomeViewProps> = ({
  onScanStart,
  onOpenHistory,
  onOpenSettings,
}) => {
  const { t } = useTranslation();
  const { theme, language, accentColor, reduceMotion, locationEnabled } = useSettingsStore();
  const { records } = useHistoryStore();
  const {
    location,
    locationStatus,
    background,
    ensureBackground,
  } = useAppContextStore();
  const isDark = theme === 'dark';
  const accent = getAccentStyles(accentColor, isDark);
  const bucket = useMemo(timeBucket, []);
  const today = new Date().setHours(0, 0, 0, 0);
  const completed = records.filter((record) => record.status === 'complete');
  const todayCount = completed.filter((record) => record.createdAt >= today).length;

  useEffect(() => {
    if (locationEnabled && locationStatus !== 'ready') return;
    const activeLocation = locationEnabled ? location : undefined;
    const query = backgroundQueryForLocation(activeLocation?.label);
    void ensureBackground(query, bucket);
  }, [bucket, ensureBackground, location, locationEnabled, locationStatus]);

  const greetingKey = new Date().getHours() < 12
    ? 'greeting.morning'
    : new Date().getHours() < 18
      ? 'greeting.afternoon'
      : 'greeting.evening';

  const locationLabel = locationEnabled && locationStatus === 'loading'
    ? t('location.locating')
    : (locationEnabled ? location?.label : undefined) || t('location.unavailable');
  const precisionLabel = !locationEnabled || location?.source === 'none' || !location
    ? t('location.unavailableShort')
    : location.approximate
      ? t('location.approximate')
      : t('location.precise');

  const saveBackground = async () => {
    if (!background) return;
    triggerHaptic();
    void trackBackgroundDownload(background.downloadLocation);
    try {
      const response = await fetch(background.imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `LoreLens-${Date.now()}.jpg`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(background.imageUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <main className={`ll-grain relative h-full overflow-hidden ${isDark ? 'bg-[#0b0b0a] text-white' : 'bg-stone-100 text-stone-950'}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(199,114,66,0.24),transparent_40%),linear-gradient(155deg,#22211d,#0b0b0a_62%,#171611)]" />
      {background?.imageUrl && (
        <img
          src={background.imageUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover saturate-[0.82] ${reduceMotion ? '' : 'animate-fade-in'}`}
        />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,4,3,0.18)_0%,rgba(4,4,3,0.2)_30%,rgba(4,4,3,0.82)_76%,rgba(4,4,3,0.98)_100%)]" />
      <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.42)]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-lg flex-col px-5 pb-[max(1.1rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-7">
        <header className="flex items-center justify-between">
          <div className="ll-material min-w-0 max-w-[68%] rounded-2xl px-3.5 py-2.5">
            <p className="truncate text-[13px] font-semibold leading-tight text-white">{locationLabel}</p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-white/52">{precisionLabel}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={t('history.title')}
              onClick={onOpenHistory}
              className="ll-icon-button h-11 w-11 rounded-2xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <IconHistory className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={t('settings.title')}
              onClick={onOpenSettings}
              className="ll-icon-button h-11 w-11 rounded-2xl text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <IconSettings className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className={`mt-auto text-white ${reduceMotion ? '' : 'll-screen-enter'}`}>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-8 bg-white/55" aria-hidden="true" />
            <p className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/58">{t('home.localInsight')}</p>
          </div>
          <h1 className="max-w-sm font-serif text-[clamp(2.65rem,12vw,4.4rem)] font-normal leading-[0.92] tracking-[-0.045em] text-[#f4f0e6]">
            {t(greetingKey)}
          </h1>
          <p className="mt-4 max-w-sm text-[15px] font-medium leading-relaxed text-white/72">{t('home.subtitle')}</p>

          <blockquote className="mt-5 max-w-sm border-s border-white/28 ps-4 font-serif text-[15px] italic leading-relaxed text-white/72">
            {t('home.insight')}
          </blockquote>

          <div className="ll-material mt-6 overflow-hidden rounded-[1.65rem] p-2">
            <div className="flex items-center px-3 pb-2.5 pt-1.5">
              <div className="flex flex-1 items-baseline gap-2 border-e border-white/14 pe-4">
                <p className="font-mono text-xl font-medium text-[#f4f0e6]">{completed.length}</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/48">{t('home.totalDiscoveries')}</p>
              </div>
              <div className="flex flex-1 items-baseline gap-2 ps-4">
                <p className="font-mono text-xl font-medium text-[#f4f0e6]">{todayCount}</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/48">{t('home.today')}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => { triggerHaptic(); onScanStart(); }}
              className="ll-primary-action flex w-full items-center justify-between rounded-[1.2rem] bg-[#f2efe6] py-2.5 pe-4 ps-2.5 text-[#0b0b0a]"
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-[0.9rem] text-white ${accent.bg}`}>
                <IconCamera className="h-5 w-5" />
              </span>
              <span className="text-[15px] font-bold tracking-[-0.01em]">{t('home.scan')}</span>
              <span className="font-mono text-sm text-black/38" aria-hidden="true">↗</span>
            </button>
          </div>

          {background && (
            <div className="mt-2.5 flex items-center justify-between px-2 font-mono text-[8px] uppercase tracking-[0.08em] text-white/38">
              <span>
                {t('home.photoBy')}{' '}
                <a className="underline" href={background.photographerUrl} target="_blank" rel="noreferrer">{background.photographer}</a>
                {' '}{t('home.on')} Unsplash
              </span>
              <button type="button" onClick={() => void saveBackground()} className="underline">{t('common.save')}</button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};
