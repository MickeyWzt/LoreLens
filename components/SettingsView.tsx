
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppLanguage } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { getAccentStyles } from '../utils/accent';
import { exportRecords } from '../domain/records';
import { COLOR_PALETTES, getPaletteThemeColors } from '../utils/palettes';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const { t } = useTranslation();
  const { 
    theme, setTheme, 
    fontSize, setFontSize, 
    language, setLanguage, 
    saveToGallery, setSaveToGallery, 
    readAloudEnabled, setReadAloudEnabled,
    accentColor, setAccentColor,
    reduceMotion, setReduceMotion,
    locationEnabled, setLocationEnabled
  } = useSettingsStore();
  const { records, clearHistory, importJson } = useHistoryStore();
  const historyCount = records.length;
  
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dataMessage, setDataMessage] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);
  const isDark = theme === 'dark';
  const accent = getAccentStyles(accentColor, isDark);

  useEffect(() => {
      let timeout: ReturnType<typeof setTimeout>;
      if (confirmDelete) {
          timeout = setTimeout(() => setConfirmDelete(false), 3000);
      }
      return () => clearTimeout(timeout);
  }, [confirmDelete]);

  const handleClearClick = () => {
      if (confirmDelete) {
          clearHistory();
          setConfirmDelete(false);
      } else {
          setConfirmDelete(true);
      }
  };

  const handleExport = () => {
      const json = exportRecords(records, {
          theme, fontSize, language, saveToGallery, readAloudEnabled, accentColor, reduceMotion, locationEnabled,
      });
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `lorelens-backup-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setDataMessage(t('settings.exported'));
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
          const count = await importJson(await file.text());
          setDataMessage(t('settings.imported', { count }));
      } catch {
          setDataMessage(t('settings.importInvalid'));
      }
  };

  // Theme-based class helpers
  const bgClass = 'bg-[var(--ll-canvas)]';
  const textClass = 'text-[var(--ll-text)]';
  const subTextClass = 'text-[var(--ll-text-muted)]';
  const borderClass = 'border-[var(--ll-border)]';
  const surfaceClass = 'bg-[var(--ll-surface)]';
  const lightPreview = getPaletteThemeColors(accentColor, 'light');
  const darkPreview = getPaletteThemeColors(accentColor, 'dark');

  const languages: {code: AppLanguage, label: string}[] = [
      { code: 'en', label: 'English' },
      { code: 'zh', label: '简体中文' },
      { code: 'ja', label: '日本語' },
      { code: 'ko', label: '한국어' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
      { code: 'de', label: 'Deutsch' },
      { code: 'it', label: 'Italiano' },
      { code: 'pt', label: 'Português' },
      { code: 'ru', label: 'Русский' },
      { code: 'ar', label: 'العربية' }
  ];

  return (
    <div role="region" aria-label={t('settings.title')} className={`absolute inset-0 z-50 flex h-full flex-col ${bgClass} ${textClass}`}>
      {/* Header - Fixed */}
      <div className={`shrink-0 border-b px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] ${borderClass}`}>
        <div className="mx-auto flex max-w-lg items-center gap-4">
        <button aria-label={t('common.back')} onClick={onBack} className={`ll-pressable flex h-10 w-10 items-center justify-center rounded-xl border transition-transform duration-150 ${borderClass} ${accent.text}`}>
          <svg className="w-6 h-64" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ height: '24px', width: '24px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <p className={`font-mono text-[9px] uppercase tracking-[0.2em] ${subTextClass}`}>LoreLens · 7.14</p>
          <h1 className="mt-0.5 font-serif text-3xl leading-none tracking-[-0.03em]">{t('settings.title')}</h1>
        </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col space-y-8 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
            
            {/* Language Section */}
            <div className="space-y-3">
                <h2 className={`font-mono text-[9px] font-semibold uppercase tracking-[0.2em] ${subTextClass}`}>01 · {t('settings.language')}</h2>
                <div className={`grid grid-cols-2 gap-2 rounded-[1.5rem] border p-2 ${borderClass} ${surfaceClass}`}>
                    {languages.map((lang) => (
                         <button 
                            key={lang.code}
                            onClick={() => setLanguage(lang.code)} 
                            className={`ll-pressable rounded-[0.95rem] border px-3 py-3 text-sm font-semibold transition-[transform,background-color,color,border-color] duration-150 ${language === lang.code ? `${accent.lightBg} ${accent.border} ${accent.text}` : `border-transparent ${subTextClass}`}`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Appearance Section */}
            <div className="space-y-3">
                <h2 className={`font-mono text-[9px] font-semibold uppercase tracking-[0.2em] ${subTextClass}`}>02 · {t('settings.appearance')}</h2>
                
                {/* Theme Toggle */}
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => setTheme('dark')} 
                        className={`ll-pressable flex min-h-24 flex-col items-start justify-between gap-3 rounded-[1.35rem] border p-4 text-start transition-[transform,background-color,border-color] duration-150 ${theme === 'dark' ? `${accent.border} ${accent.lightBg} ${accent.text}` : `${borderClass} ${surfaceClass} ${subTextClass}`}`}
                    >
                        <div aria-hidden="true" className="flex h-8 w-full overflow-hidden rounded-lg border border-black/10 shadow-sm">
                            <span className="w-1/2" style={{ backgroundColor: darkPreview.canvas }} />
                            <span className="w-1/3" style={{ backgroundColor: darkPreview.surface }} />
                            <span className="flex-1" style={{ backgroundColor: darkPreview.accent }} />
                        </div>
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'font-bold' : ''}`}>{t('settings.midnight')}</span>
                    </button>
                    <button 
                        onClick={() => setTheme('light')} 
                        className={`ll-pressable flex min-h-24 flex-col items-start justify-between gap-3 rounded-[1.35rem] border p-4 text-start transition-[transform,background-color,border-color] duration-150 ${theme === 'light' ? `${accent.border} ${accent.lightBg} ${accent.text}` : `${borderClass} ${surfaceClass} ${subTextClass}`}`}
                    >
                        <div aria-hidden="true" className="flex h-8 w-full overflow-hidden rounded-lg border border-black/10 shadow-sm">
                            <span className="w-1/2" style={{ backgroundColor: lightPreview.canvas }} />
                            <span className="w-1/3" style={{ backgroundColor: lightPreview.surface }} />
                            <span className="flex-1" style={{ backgroundColor: lightPreview.accent }} />
                        </div>
                        <span className={`text-sm font-medium ${theme === 'light' ? 'font-bold' : ''}`}>{t('settings.porcelain')}</span>
                    </button>
                </div>

                {/* Full palette picker */}
                <div className={`rounded-[1.35rem] border p-4 ${borderClass} ${surfaceClass}`}>
                    <span className={`mb-4 block text-xs font-semibold ${subTextClass}`}>{t('settings.accentColor')}</span>
                    <div className="grid grid-cols-2 gap-2">
                        {COLOR_PALETTES.map((palette) => {
                            const isSelected = accentColor === palette.id;
                            return (
                                <button
                                    key={palette.id}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setAccentColor(palette.id)}
                                    className={`ll-pressable min-w-0 rounded-[1rem] border p-2.5 text-start transition-[transform,background-color,border-color] duration-150 ${isSelected ? `${accent.border} ${accent.lightBg}` : borderClass}`}
                                    title={palette.sourceName}
                                >
                                    <span aria-hidden="true" className="flex h-7 overflow-hidden rounded-lg border border-black/10 shadow-sm">
                                        {palette.swatches.map((swatch) => (
                                            <span key={swatch} className="flex-1" style={{ backgroundColor: swatch }} />
                                        ))}
                                    </span>
                                    <span className="mt-2 flex items-center justify-between gap-2 px-0.5 text-xs font-semibold">
                                        <span className="truncate">{t(palette.nameKey)}</span>
                                        {isSelected && <span aria-hidden="true" className={accent.text}>✓</span>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Font Size Toggle */}
                <div className={`flex items-center justify-between rounded-[1.35rem] border p-1.5 ${borderClass} ${surfaceClass}`}>
                    <button
                        aria-label={t('settings.fontSmall')}
                        onClick={() => setFontSize('small')}
                        className={`ll-pressable flex-1 rounded-[0.95rem] py-3 text-xs transition-[transform,background-color,color] duration-150 ${fontSize === 'small' ? `${accent.lightBg} ${accent.text} font-bold` : subTextClass}`}
                    >
                        Aa
                    </button>
                    <div className="h-6 w-px bg-[var(--ll-border)]"></div>
                    <button
                        aria-label={t('settings.fontMedium')}
                        onClick={() => setFontSize('medium')}
                        className={`ll-pressable flex-1 rounded-[0.95rem] py-3 text-base transition-[transform,background-color,color] duration-150 ${fontSize === 'medium' ? `${accent.lightBg} ${accent.text} font-bold` : subTextClass}`}
                    >
                        Aa
                    </button>
                    <div className="h-6 w-px bg-[var(--ll-border)]"></div>
                    <button
                        aria-label={t('settings.fontLarge')}
                        onClick={() => setFontSize('large')}
                        className={`ll-pressable flex-1 rounded-[0.95rem] py-3 text-xl transition-[transform,background-color,color] duration-150 ${fontSize === 'large' ? `${accent.lightBg} ${accent.text} font-bold` : subTextClass}`}
                    >
                        Aa
                    </button>
                </div>
            </div>

            {/* Preferences Section */}
            <div className="space-y-3">
                <h2 className={`font-mono text-[9px] font-semibold uppercase tracking-[0.2em] ${subTextClass}`}>03 · {t('settings.preferences')}</h2>
                <div className={`overflow-hidden rounded-[1.5rem] border px-4 ${borderClass} ${surfaceClass}`}>
                
                {/* Location-assisted identification */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={locationEnabled}
                    onClick={() => setLocationEnabled(!locationEnabled)}
                    className={`ll-pressable flex w-full cursor-pointer items-center justify-between border-b py-4 text-start transition-transform duration-150 ${borderClass}`}
                >
                    <div className="flex min-w-0 flex-col pe-4">
                        <span className="text-lg font-light">{t('settings.locationEnabled')}</span>
                        <span className={`text-xs ${subTextClass}`}>{t('settings.locationEnabledDesc')}</span>
                    </div>
                    <div className={`relative h-6 w-12 shrink-0 rounded-full transition-colors duration-200 ${locationEnabled ? accent.bg : 'bg-[var(--ll-border-strong)]'}`}>
                        <div className={`absolute start-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 [transition-timing-function:var(--ll-ease-out)] ${locationEnabled ? 'translate-x-6 rtl:-translate-x-6' : ''}`}></div>
                    </div>
                </button>

                {/* Save Photos to Gallery */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={saveToGallery}
                    onClick={() => setSaveToGallery(!saveToGallery)}
                    className={`ll-pressable flex w-full cursor-pointer items-center justify-between border-b py-4 text-start transition-transform duration-150 ${borderClass}`}
                >
                    <span className="min-w-0 pe-4 text-lg font-light">{t('settings.saveGallery')}</span>
                    <div 
                        className={`relative h-6 w-12 shrink-0 rounded-full transition-colors duration-200 ${saveToGallery ? accent.bg : 'bg-[var(--ll-border-strong)]'}`}
                    >
                        <div className={`absolute start-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 [transition-timing-function:var(--ll-ease-out)] ${saveToGallery ? 'translate-x-6 rtl:-translate-x-6' : ''}`}></div>
                    </div>
                </button>

                {/* Browser read aloud */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={readAloudEnabled}
                    onClick={() => setReadAloudEnabled(!readAloudEnabled)}
                    className={`ll-pressable flex w-full cursor-pointer items-center justify-between border-b py-4 text-start transition-transform duration-150 ${borderClass}`}
                >
                    <div className="flex min-w-0 flex-col pe-4">
                        <span className="text-lg font-light">{t('settings.readAloud')}</span>
                        <span className={`text-xs ${subTextClass}`}>{t('settings.readAloudDesc')}</span>
                    </div>
                    <div 
                    className={`relative h-6 w-12 shrink-0 rounded-full transition-colors duration-200 ${readAloudEnabled ? accent.bg : 'bg-[var(--ll-border-strong)]'}`}
                    >
                        <div className={`absolute start-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 [transition-timing-function:var(--ll-ease-out)] ${readAloudEnabled ? 'translate-x-6 rtl:-translate-x-6' : ''}`}></div>
                    </div>
                </button>

                {/* Reduce Motion Toggle */}
                <button
                    type="button"
                    role="switch"
                    aria-checked={reduceMotion}
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className="ll-pressable flex w-full cursor-pointer items-center justify-between py-4 text-start transition-transform duration-150"
                >
                    <div className="flex min-w-0 flex-col pe-4">
                        <span className="text-lg font-light">{t('settings.reduceMotion')}</span>
                        <span className={`text-xs ${subTextClass}`}>{t('settings.reduceMotionDesc')}</span>
                    </div>
                    <div 
                        className={`relative h-6 w-12 shrink-0 rounded-full transition-colors duration-200 ${reduceMotion ? accent.bg : 'bg-[var(--ll-border-strong)]'}`}
                    >
                        <div className={`absolute start-1 top-1 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 [transition-timing-function:var(--ll-ease-out)] ${reduceMotion ? 'translate-x-6 rtl:-translate-x-6' : ''}`}></div>
                    </div>
                </button>
                </div>
            </div>

            {/* Data Section */}
            <div className="space-y-3">
            <h2 className={`font-mono text-[9px] font-semibold uppercase tracking-[0.2em] ${subTextClass}`}>04 · {t('settings.data')}</h2>
            <div className="grid grid-cols-2 gap-3">
                <button
                    type="button"
                    onClick={handleExport}
                    className={`ll-pressable rounded-[1.1rem] border py-3 font-semibold transition-transform duration-150 ${borderClass} ${surfaceClass}`}
                >
                    {t('settings.exportData')}
                </button>
                <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className={`ll-pressable rounded-[1.1rem] border py-3 font-semibold transition-transform duration-150 ${borderClass} ${surfaceClass}`}
                >
                    {t('settings.importData')}
                </button>
                <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json,.json"
                    onChange={(event) => void handleImport(event)}
                    className="hidden"
                />
            </div>
            <button 
                onClick={handleClearClick}
                disabled={historyCount === 0}
                className={`ll-pressable w-full rounded-[1.1rem] border py-4 font-semibold transition-[transform,background-color,border-color] duration-150
                    ${confirmDelete
                        ? 'border-red-600 bg-red-600 text-white'
                        : historyCount === 0 
                            ? `${borderClass} ${subTextClass} cursor-not-allowed`
                            : `${isDark ? 'border-red-900 bg-black' : 'border-red-200 bg-red-50'} text-red-500 hover:bg-red-500/10`
                    }
                `}
            >
                {confirmDelete ? t('settings.confirmClear') : t('settings.clearHistory')}
            </button>
            {historyCount > 0 && (
                <p className={`text-center text-xs ${subTextClass}`}>{historyCount} {t('settings.itemsInStorage')}</p>
            )}
            {dataMessage && <p role="status" className={`text-center text-xs ${subTextClass}`}>{dataMessage}</p>}
            </div>

            <details className={`group rounded-[1.35rem] border px-4 py-3 ${borderClass} ${surfaceClass}`}>
                <summary className="cursor-pointer list-none text-sm font-semibold marker:content-none">
                    <span className="flex items-center justify-between gap-4">
                        {t('settings.privacy')}
                        <span aria-hidden="true" className={`text-lg transition-transform duration-150 group-open:rotate-45 ${accent.text}`}>+</span>
                    </span>
                </summary>
                <div className={`space-y-2 border-t pt-3 text-xs leading-relaxed ${borderClass} ${subTextClass}`}>
                    <p>{t('settings.privacyPhotos')}</p>
                    <p>{t('settings.privacyLocation')}</p>
                    <p>{t('settings.privacyStorage')}</p>
                </div>
            </details>

            <div className={`mt-auto border-t pt-6 text-center font-mono text-[9px] uppercase tracking-[0.12em] ${borderClass} ${subTextClass}`}>
                <p>LoreLens · v7.14 · {t('settings.publicBeta')}</p>
                <p className="mt-1 normal-case tracking-normal">{t('settings.aiDescription')}</p>
            </div>
        </div>
      </div>
    </div>
  );
};
