
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppTheme, AppFontSize, AppLanguage, AppAccentColor } from '../types';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { getAccentStyles } from '../utils/accent';

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
    highResAudio, setHighResAudio,
    accentColor, setAccentColor,
    reduceMotion, setReduceMotion
  } = useSettingsStore();
  const { history, clearHistory } = useHistoryStore();
  const historyCount = history.length;
  
  const [confirmDelete, setConfirmDelete] = useState(false);
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

  // Theme-based class helpers
  const bgClass = isDark ? 'bg-black' : 'bg-gray-50';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const subTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderClass = isDark ? 'border-gray-800' : 'border-gray-200';
  const hoverTextClass = isDark ? 'hover:text-white' : 'hover:text-black';
  const iconClass = isDark ? 'text-gray-400' : 'text-gray-500';

  const languages: {code: AppLanguage, label: string}[] = [
      { code: 'en', label: 'English' },
      { code: 'zh', label: '简体中文' },
      { code: 'ja', label: '日本語' },
      { code: 'es', label: 'Español' },
      { code: 'fr', label: 'Français' },
      { code: 'ru', label: 'Русский' },
      { code: 'ar', label: 'العربية' }
  ];

  return (
    <div className={`absolute inset-0 z-50 flex flex-col h-full animate-fade-in ${bgClass} ${textClass}`}>
      {/* Header - Fixed */}
      <div className="flex items-center p-6 pb-4 shrink-0">
        <button onClick={onBack} className={`p-2 -ms-2 opacity-80 hover:opacity-100 transition-opacity ${accent.text}`}>
          <svg className="w-6 h-64" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ height: '24px', width: '24px' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 className="text-2xl font-light ms-4">{t('settings.title')}</h1>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="p-6 pt-2 flex flex-col min-h-full space-y-8">
            
            {/* Language Section */}
            <div className="space-y-4">
                <h2 className={`text-sm font-bold uppercase tracking-wider ${subTextClass}`}>{t('settings.language')}</h2>
                <div className="grid grid-cols-2 gap-3">
                    {languages.map((lang) => (
                         <button 
                            key={lang.code}
                            onClick={() => setLanguage(lang.code)} 
                            className={`p-3 rounded-xl border text-sm font-medium transition-all duration-200 ${language === lang.code ? `${accent.lightBg} ${accent.border} ${accent.text} font-semibold` : `${borderClass} ${subTextClass} hover:opacity-85`}`}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Appearance Section */}
            <div className="space-y-4">
                <h2 className={`text-sm font-bold uppercase tracking-wider ${subTextClass}`}>{t('settings.appearance')}</h2>
                
                {/* Theme Toggle */}
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setTheme('dark')} 
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all duration-200 ${theme === 'dark' ? `${accent.border} ${accent.lightBg} ${accent.text} ring-1 ${accent.border}` : `${borderClass} ${isDark ? 'bg-gray-900' : 'bg-white text-gray-500'}`}`}
                    >
                        <div className={`w-6 h-6 rounded-full bg-gray-950 border ${theme === 'dark' ? 'border-current' : 'border-gray-700'} shadow-sm`}></div>
                        <span className={`text-sm font-medium ${theme === 'dark' ? 'font-bold' : ''}`}>{t('settings.midnight')}</span>
                    </button>
                    <button 
                        onClick={() => setTheme('light')} 
                        className={`p-4 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all duration-200 ${theme === 'light' ? `${accent.border} ${accent.lightBg} ${accent.text} ring-1 ${accent.border}` : `${borderClass} ${isDark ? 'bg-gray-900 text-gray-400' : 'bg-white text-gray-500'}`}`}
                    >
                        <div className={`w-6 h-6 rounded-full bg-white border ${theme === 'light' ? 'border-current' : 'border-gray-200'} shadow-sm`}></div>
                        <span className={`text-sm font-medium ${theme === 'light' ? 'font-bold' : ''}`}>{t('settings.porcelain')}</span>
                    </button>
                </div>

                {/* Accent Color Picker */}
                <div className="pt-4">
                    <span className={`block text-sm font-bold uppercase tracking-wider ${subTextClass} mb-6`}>{t('settings.accentColor')}</span>
                    <div className="flex gap-5">
                        {(['indigo', 'teal', 'amber', 'violet'] as const).map((color) => {
                            const isSelected = accentColor === color;
                            const colorDotMap = {
                                indigo: 'bg-indigo-500 border-indigo-600',
                                teal: 'bg-teal-500 border-teal-600',
                                amber: 'bg-amber-500 border-amber-600',
                                violet: 'bg-violet-500 border-violet-600'
                            };

                            const ringColorClass = isDark
                                ? {
                                      indigo: 'ring-indigo-400 ring-offset-black',
                                      teal: 'ring-teal-400 ring-offset-black',
                                      amber: 'ring-amber-400 ring-offset-black',
                                      violet: 'ring-violet-400 ring-offset-black',
                                  }[color]
                                : {
                                      indigo: 'ring-indigo-500 ring-offset-white',
                                      teal: 'ring-teal-500 ring-offset-white',
                                      amber: 'ring-amber-500 ring-offset-white',
                                      violet: 'ring-violet-500 ring-offset-white',
                                  }[color];

                            return (
                                <button
                                    key={color}
                                    onClick={() => setAccentColor(color)}
                                    className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all shadow-sm ${colorDotMap[color]} ${isSelected ? `ring-2 ring-offset-1 scale-110 ${ringColorClass}` : 'scale-100 opacity-60 hover:opacity-100'}`}
                                    title={t(`settings.${color}`)}
                                >
                                    {isSelected && (
                                        <svg className="absolute w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Font Size Toggle */}
                <div className={`flex items-center justify-between p-2 rounded-xl border ${borderClass} ${isDark ? 'bg-gray-900' : 'bg-white'}`}>
                    <button
                        onClick={() => setFontSize('small')}
                        className={`flex-1 py-3 rounded-lg text-xs transition-colors duration-200 ${fontSize === 'small' ? `${accent.lightBg} ${accent.text} font-bold shadow-sm` : `${subTextClass} hover:opacity-80`}`}
                    >
                        Aa
                    </button>
                    <div className={`w-px h-6 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
                    <button
                        onClick={() => setFontSize('medium')}
                        className={`flex-1 py-3 rounded-lg text-base transition-colors duration-200 ${fontSize === 'medium' ? `${accent.lightBg} ${accent.text} font-bold shadow-sm` : `${subTextClass} hover:opacity-80`}`}
                    >
                        Aa
                    </button>
                    <div className={`w-px h-6 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}></div>
                    <button
                        onClick={() => setFontSize('large')}
                        className={`flex-1 py-3 rounded-lg text-xl transition-colors duration-200 ${fontSize === 'large' ? `${accent.lightBg} ${accent.text} font-bold shadow-sm` : `${subTextClass} hover:opacity-80`}`}
                    >
                        Aa
                    </button>
                </div>
            </div>

            {/* Preferences Section */}
            <div className="space-y-4">
                <h2 className={`text-sm font-bold uppercase tracking-wider ${subTextClass}`}>{t('settings.preferences')}</h2>
                
                {/* Save Photos to Gallery */}
                <div 
                    onClick={() => setSaveToGallery(!saveToGallery)}
                    className={`flex items-center justify-between py-4 border-b cursor-pointer transition-colors ${borderClass} ${isDark ? 'active:bg-gray-900' : 'active:bg-gray-100'}`}
                >
                    <span className="text-lg font-light">{t('settings.saveGallery')}</span>
                    <div 
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${saveToGallery ? accent.bg : isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${saveToGallery ? 'start-[calc(100%-1.25rem)]' : 'start-1'}`}></div>
                    </div>
                </div>

                {/* High-Res Audio */}
                <div 
                    onClick={() => setHighResAudio(!highResAudio)}
                    className={`flex items-center justify-between py-4 border-b cursor-pointer transition-colors ${borderClass} ${isDark ? 'active:bg-gray-900' : 'active:bg-gray-100'}`}
                >
                    <div className="flex flex-col">
                        <span className="text-lg font-light">{t('settings.highResAudio')}</span>
                        <span className={`text-xs ${subTextClass}`}>{t('settings.highResDesc')}</span>
                    </div>
                    <div 
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${highResAudio ? accent.bg : isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${highResAudio ? 'start-[calc(100%-1.25rem)]' : 'start-1'}`}></div>
                    </div>
                </div>

                {/* Reduce Motion Toggle */}
                <div 
                    onClick={() => setReduceMotion(!reduceMotion)}
                    className={`flex items-center justify-between py-4 border-b cursor-pointer transition-colors ${borderClass} ${isDark ? 'active:bg-gray-900' : 'active:bg-gray-100'}`}
                >
                    <div className="flex flex-col pe-4">
                        <span className="text-lg font-light">{t('settings.reduceMotion')}</span>
                        <span className={`text-xs ${subTextClass}`}>{t('settings.reduceMotionDesc')}</span>
                    </div>
                    <div 
                        className={`w-12 h-6 rounded-full relative transition-colors duration-200 ${reduceMotion ? accent.bg : isDark ? 'bg-gray-700' : 'bg-gray-300'}`}
                    >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${reduceMotion ? 'start-[calc(100%-1.25rem)]' : 'start-1'}`}></div>
                    </div>
                </div>
            </div>

            {/* Data Section */}
            <div className="space-y-4">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${subTextClass}`}>{t('settings.data')}</h2>
            <button 
                onClick={handleClearClick}
                disabled={historyCount === 0}
                className={`w-full py-4 border rounded-xl transition-all shadow-lg duration-200 font-medium
                    ${confirmDelete
                        ? 'border-red-600 bg-red-600 text-white shadow-red-900/40 scale-[1.02]' 
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
            </div>

            <div className={`mt-auto pt-10 text-center text-sm ${subTextClass}`}>
                <p>Context Lens v1.5.0</p>
                <p>Powered by Gemini 2.0 Flash</p>
            </div>
        </div>
      </div>
    </div>
  );
};
