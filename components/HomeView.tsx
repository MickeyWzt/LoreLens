import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { IconCamera, IconHistory, IconSettings } from './Icons';
import { useAppContextStore } from '../store/useAppContextStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { trackBackgroundDownload } from '../services/backgroundService';
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
    ensureLocation,
    ensureBackground,
  } = useAppContextStore();
  const isDark = theme === 'dark';
  const accent = getAccentStyles(accentColor, isDark);
  const bucket = useMemo(timeBucket, []);
  const today = new Date().setHours(0, 0, 0, 0);
  const completed = records.filter((record) => record.status === 'complete');
  const todayCount = completed.filter((record) => record.createdAt >= today).length;

  useEffect(() => {
    if (locationEnabled) void ensureLocation(language);
  }, [ensureLocation, language, locationEnabled]);

  useEffect(() => {
    if (locationEnabled && locationStatus !== 'ready') return;
    const activeLocation = locationEnabled ? location : undefined;
    const query = activeLocation?.label || (activeLocation?.lat !== undefined ? 'travel city' : 'world travel');
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
    <main className={`relative h-full overflow-hidden ${isDark ? 'bg-black text-white' : 'bg-stone-100 text-stone-950'}`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(99,102,241,0.36),transparent_46%),radial-gradient(circle_at_85%_80%,rgba(168,85,247,0.25),transparent_44%),linear-gradient(160deg,#15131d,#050505_58%,#111827)]" />
      {background?.imageUrl && (
        <img
          src={background.imageUrl}
          alt=""
          className={`absolute inset-0 h-full w-full object-cover ${reduceMotion ? '' : 'animate-fade-in'}`}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/35 to-black/95" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <div className="min-w-0 rounded-full border border-white/15 bg-black/25 px-4 py-2 backdrop-blur-xl">
            <p className="truncate text-sm font-medium text-white">{locationLabel}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-white/60">{precisionLabel}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label={t('history.title')}
              onClick={onOpenHistory}
              className="rounded-full border border-white/15 bg-black/25 p-3 text-white backdrop-blur-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <IconHistory className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label={t('settings.title')}
              onClick={onOpenSettings}
              className="rounded-full border border-white/15 bg-black/25 p-3 text-white backdrop-blur-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <IconSettings className="h-5 w-5" />
            </button>
          </div>
        </header>

        <section className="mt-auto text-white">
          <p className="text-sm font-medium tracking-wide text-white/65">{t(greetingKey)}</p>
          <h1 className="mt-2 text-5xl font-extralight tracking-[-0.04em]">LoreLens</h1>
          <p className="mt-3 max-w-sm text-base leading-relaxed text-white/72">{t('home.subtitle')}</p>

          <div className="mt-7 grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-white/12 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-3xl font-light">{completed.length}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">{t('home.totalDiscoveries')}</p>
            </div>
            <div className="rounded-3xl border border-white/12 bg-white/8 p-4 backdrop-blur-xl">
              <p className="text-3xl font-light">{todayCount}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/55">{t('home.today')}</p>
            </div>
          </div>

          <div className="mt-3 rounded-3xl border border-white/12 bg-black/25 p-5 backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/50">{t('home.localInsight')}</p>
            <p className="mt-2 font-serif text-lg italic leading-relaxed text-white/88">{t('home.insight')}</p>
          </div>

          <button
            type="button"
            onClick={() => { triggerHaptic(); onScanStart(); }}
            className={`mt-5 flex w-full items-center justify-center gap-3 rounded-full px-6 py-4 text-base font-semibold text-white shadow-2xl transition-transform active:scale-[0.98] ${accent.bg}`}
          >
            <IconCamera className="h-6 w-6" />
            {t('home.scan')}
          </button>

          {background && (
            <div className="mt-3 flex items-center justify-between px-2 text-[10px] text-white/50">
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
