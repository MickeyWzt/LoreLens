
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryItem, DailyRecapResult } from '../types';
import { IconChevronDown, IconJournal } from './Icons';
import { decipherImage, generateDailyRecap } from '../services/aiService';
import type { ApiError, AnalysisRecordV2 } from '../types';
import { localizeApiError } from '../services/errorMessages';
import { useSettingsStore } from '../store/useSettingsStore';
import { useHistoryStore } from '../store/useHistoryStore';
import { getAccentStyles } from '../utils/accent';

interface HistoryViewProps {
  onSelect: (item: HistoryItem) => void;
  onClose: () => void;
  onShowNotification?: (msg: string) => void;
}

// --- Visual Components ---

// 1. Resonance Fractal: A dynamic, math-y geometric shape
const ResonanceFractal = ({ score, isDark }: { score: number, isDark: boolean }) => {
    const { accentColor } = useSettingsStore();

    // Generate polygon points based on score
    const sides = 7;
    const radius = 60;
    const center = 80; // viewBox 160x160
    
    const getPolygonPoints = (r: number, offsetAngle: number = 0) => {
        let points = "";
        for (let i = 0; i < sides; i++) {
            const angle = (i * 2 * Math.PI / sides) - (Math.PI / 2) + offsetAngle;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);
            points += `${x},${y} `;
        }
        return points;
    };

    // Calculate intensity based on score
    const scale = 0.5 + (score / 200); // 0.5 to 1.0
    const dash = score > 90 ? "none" : "2,2";

    // Dynamic accent hex codes
    const hexMap = {
        indigo: { main: isDark ? "#818cf8" : "#4f46e5", sec: isDark ? "#c084fc" : "#9333ea" },
        teal: { main: isDark ? "#2dd4bf" : "#0d9488", sec: isDark ? "#38bdf8" : "#0284c7" },
        amber: { main: isDark ? "#fbbf24" : "#d97706", sec: isDark ? "#f43f5e" : "#e11d48" },
        violet: { main: isDark ? "#a78bfa" : "#7c3aed", sec: isDark ? "#f472b6" : "#db2777" },
    };
    const cPreset = hexMap[accentColor] || hexMap.indigo;

    const mainColor = cPreset.main;
    const secColor = cPreset.sec;

    const auraClassMap = {
        indigo: isDark ? 'bg-indigo-500' : 'bg-indigo-300',
        teal: isDark ? 'bg-teal-500' : 'bg-teal-300',
        amber: isDark ? 'bg-amber-500' : 'bg-amber-300',
        violet: isDark ? 'bg-violet-500' : 'bg-violet-300'
    };
    const auraClass = auraClassMap[accentColor] || auraClassMap.indigo;

    return (
        <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Spinning background Aura */}
            <div className={`absolute inset-0 rounded-full blur-2xl opacity-20 ${auraClass}`} style={{ transform: `scale(${scale})` }}></div>
            
            <svg width="160" height="160" viewBox="0 0 160 160" className="animate-[spin_20s_linear_infinite]">
                 {/* Outer Geometric Ring */}
                <circle cx="80" cy="80" r="78" fill="none" stroke={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)"} strokeWidth="1" />
                
                {/* Layer 1: Base Shape */}
                <polygon 
                    points={getPolygonPoints(radius)} 
                    fill="none" 
                    stroke={mainColor} 
                    strokeWidth="1.5"
                    opacity="0.3" 
                />
                
                {/* Layer 2: Score Shape (Rotated) */}
                <polygon 
                    points={getPolygonPoints(radius * scale, 0.4)} 
                    fill={isDark ? "rgba(129, 140, 248, 0.1)" : "rgba(79, 70, 229, 0.05)"} 
                    stroke={secColor} 
                    strokeWidth="2"
                    strokeDasharray={dash}
                />

                {/* Connecting lines to center (Fractal feel) */}
                {Array.from({ length: sides }).map((_, i) => {
                    const angle = (i * 2 * Math.PI / sides) - (Math.PI / 2) + 0.4;
                    const x = center + (radius * scale) * Math.cos(angle);
                    const y = center + (radius * scale) * Math.sin(angle);
                    return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke={mainColor} strokeWidth="0.5" opacity="0.2" />
                })}
            </svg>
            
            {/* Score Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold font-mono ${isDark ? 'text-white' : 'text-gray-900'}`}>{score}</span>
                <span className="text-[10px] tracking-widest uppercase opacity-50">RES</span>
            </div>
        </div>
    );
};

// 2. Axis Map: A vertical timeline connected by glowing lines
const AxisMap = ({ items, onSelect, isDark }: { items: HistoryItem[], onSelect: (i: HistoryItem) => void, isDark: boolean }) => {
    const { accentColor } = useSettingsStore();
    const accent = getAccentStyles(accentColor, isDark);
    
    return (
        <div className="relative py-8 ps-8 pe-4">
            {/* The Axis Line */}
            <div className={`absolute start-10 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent ${accent.gradientFrom} to-transparent`}></div>

            <div className="space-y-8">
                {items.map((item, index) => {
                    return (
                        <div key={item.id} className="relative flex items-center group">
                            {/* The Node on the Axis */}
                            <div className={`absolute start-[8px] z-10 w-3 h-3 rounded-full ${accent.bg} ${accent.dotPulse} border-2 border-white ring-4 ring-black`}></div>
                            
                            {/* Connection Line */}
                            <div className={`absolute start-[20px] w-8 h-[1px] ${isDark ? 'bg-white/20' : 'bg-black/10'}`}></div>

                            {/* The Card */}
                            <div 
                                role="button"
                                tabIndex={0}
                                onClick={() => onSelect(item)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' || event.key === ' ') {
                                        event.preventDefault();
                                        onSelect(item);
                                    }
                                }}
                                className={`ll-pressable ms-12 flex flex-1 cursor-pointer items-center gap-3 rounded-xl border p-3 transition-[transform,background-color,border-color] duration-150 ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100'}`}
                            >
                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full bg-gray-700"></div>
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    {/* Simplified: Only Title, no Essence */}
                                    <h4 className={`text-sm font-medium leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h4>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const HistoryView: React.FC<HistoryViewProps> = ({ onSelect, onClose, onShowNotification }) => {
  const { t } = useTranslation();
  const { theme, language, accentColor, reduceMotion } = useSettingsStore();
  const { history, records, setHistory, updateRecord } = useHistoryStore();
  const isDark = theme === 'dark';

  // Deletion and checkbox states
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Recap State
  const [showRecap, setShowRecap] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recapData, setRecapData] = useState<DailyRecapResult | null>(null);
  const [todayItems, setTodayItems] = useState<HistoryItem[]>([]);
  const actionableRecords = records.filter((record) => record.status !== 'complete');

  const retryRecord = async (record: AnalysisRecordV2) => {
    if (!record.image || !navigator.onLine) {
      onShowNotification?.(t('errors.offlineRetry'));
      return;
    }
    try {
      const result = await decipherImage(record.image, record.location, record.language);
      updateRecord(record.id, {
        status: 'complete',
        result,
        error: undefined,
        updatedAt: Date.now(),
      });
      onShowNotification?.(t('history.retrySuccess'));
    } catch (error) {
      const details: ApiError = error && typeof error === 'object' && 'details' in error
        ? (error as { details: ApiError }).details
        : {
            code: 'ANALYSIS_FAILED',
            message: error instanceof Error ? error.message : t('errors.analysisFailed'),
            retryable: true,
            requestId: 'client',
          };
      updateRecord(record.id, { status: 'failed', error: details, updatedAt: Date.now() });
      onShowNotification?.(localizeApiError(details, t));
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === history.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map(item => item.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    
    const newHistory = history.filter(item => !selectedIds.includes(item.id));
    setHistory(newHistory);
    
    onShowNotification?.(t('history.deleted', { count: selectedIds.length }));
    setSelectedIds([]);
    setIsEditMode(false);
  };

  const handleRecapClick = async () => {
    // Filter for items from "today"
    const today = new Date().setHours(0, 0, 0, 0);
    const items = history.filter(item => {
        const itemDate = new Date(item.timestamp).setHours(0, 0, 0, 0);
        return itemDate === today;
    });

    if (items.length === 0) {
        onShowNotification?.(t('history.noItemsToday'));
        return;
    }

    setTodayItems(items);
    setShowRecap(true);
    setIsGenerating(true);
    setRecapData(null);

    try {
        const result = await generateDailyRecap(items, language);
        setRecapData(result);
    } catch (error) {
        onShowNotification?.(t('history.journalFailed'));
        setShowRecap(false);
    } finally {
        setIsGenerating(false);
    }
  };

  // Styles
  const accent = getAccentStyles(accentColor, isDark);
  const animFadeIn = reduceMotion ? '' : 'animate-fade-in';
  const animFadeInUp = reduceMotion ? '' : 'animate-fade-in-up';
  
  const bgClass = isDark ? 'bg-[#0b0b0a] text-[#f4f0e6]' : 'bg-[#f2efe6] text-[#171714]';
  const headerBgClass = isDark ? 'bg-[#0b0b0a]/92 border-white/12' : 'bg-[#f2efe6]/92 border-black/12';
  const itemBgClass = isDark ? 'bg-[#151513] border-white/10 active:bg-[#1b1b18]' : 'bg-white/55 border-black/10 active:bg-white/80';
  const subTextClass = isDark ? 'text-white/42' : 'text-black/42';
  const accentTextClass = accent.text;
  const iconBtnClass = isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-600';

  return (
    <div role="region" aria-label={t('history.title')} className={`absolute inset-0 z-30 flex flex-col ll-screen-enter ${bgClass}`}>
        
        {/* Header */}
        <div className={`sticky top-0 z-10 border-b px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl ${headerBgClass}`}>
          <div className="mx-auto flex max-w-lg flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            {isEditMode ? (
                <div className="flex items-center gap-2">
                    <span className={`font-serif text-2xl tracking-[-0.02em] ${animFadeIn}`}>
                        {t('history.selected', { count: selectedIds.length })}
                    </span>
                </div>
            ) : (
                <div className={`min-w-0 ${animFadeInUp}`}>
                  <p className={`font-mono text-[9px] uppercase tracking-[0.2em] ${subTextClass}`}>LoreLens · 7.14</p>
                  <h1 className="mt-0.5 font-serif text-3xl leading-none tracking-[-0.03em]">{t('history.title')}</h1>
                </div>
            )}
            
            <div className="flex w-full items-stretch justify-end gap-2 sm:w-auto sm:shrink-0 sm:items-center">
                {isEditMode ? (
                    <>
                        <button 
                            onClick={toggleSelectAll}
                            className={`ll-pressable flex min-w-0 flex-1 items-center justify-center rounded-xl border px-3 py-2 font-mono text-[10px] tracking-wide transition-transform duration-150 sm:flex-none ${
                                selectedIds.length === history.length && history.length > 0
                                    ? accent.btnActive
                                    : (isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50')
                            }`}
                        >
                            {selectedIds.length === history.length && history.length > 0 ? t('history.deselectAll') : t('history.selectAll')}
                        </button>
                        <button 
                            onClick={() => {
                                setIsEditMode(false);
                                setSelectedIds([]);
                            }}
                            className={`ll-pressable shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition-transform duration-150 ${
                                isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-100'
                            }`}
                        >
                            {t('history.cancel')}
                        </button>
                    </>
                ) : (
                    <>
                        {history.length > 0 && (
                            <>
                                <button 
                                    onClick={handleRecapClick}
                                    className={`ll-pressable flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 transition-transform duration-150 sm:flex-none ${accent.lightBg} ${accent.text} ${accent.border}`}
                                >
                                    <IconJournal className="h-4 w-4 shrink-0" />
                                    <span className="text-center text-sm font-medium leading-tight">{t('history.recapButton')}</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsEditMode(true);
                                        setSelectedIds([]);
                                    }}
                                    className={`ll-pressable shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition-transform duration-150 ${
                                        isDark ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-white border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    {t('history.manage')}
                                </button>
                            </>
                        )}
                        <button 
                            aria-label={t('aria.close')}
                            onClick={onClose} 
                            className={`ll-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-150 ${isDark ? 'border-white/12' : 'border-black/10'} ${iconBtnClass}`}
                        >
                            <IconChevronDown className="w-6 h-6" />
                        </button>
                    </>
                )}
            </div>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-lg space-y-3 px-5 py-5">
            {actionableRecords.map((record) => (
                <div key={record.id} className={`flex gap-4 rounded-[1.4rem] border p-4 ${itemBgClass}`}>
                    <div className="h-18 w-18 shrink-0 overflow-hidden rounded-[1rem] bg-gray-800">
                        {record.thumbnail && <img src={record.thumbnail} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium">{record.status === 'pending' ? t('history.pending') : t('history.failed')}</p>
                        <p className={`text-xs mt-1 ${subTextClass}`}>{record.error?.message || t('history.pendingHint')}</p>
                        <button
                            type="button"
                            onClick={() => void retryRecord(record)}
                            className={`mt-3 px-4 py-2 rounded-full text-sm border ${accent.lightBg} ${accent.text} ${accent.border}`}
                        >
                            {t('common.retry')}
                        </button>
                    </div>
                </div>
            ))}
            {history.length === 0 && actionableRecords.length === 0 ? (
                <div className={`flex h-[60vh] flex-col items-center justify-center text-center ${subTextClass} ${animFadeInUp}`}>
                    <span className="mb-5 h-px w-10 bg-current opacity-50" aria-hidden="true" />
                    <p className="font-serif text-3xl text-current">{t('history.empty')}</p>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed opacity-65">{t('history.emptySub')}</p>
                </div>
            ) : (
                history.map((item, index) => {
                    const isSelected = selectedIds.includes(item.id);
                    const sourceRecord = records.find((record) => record.id === item.id);
                    return (
                        <div 
                            key={item.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isEditMode ? isSelected : undefined}
                            onClick={() => {
                                if (isEditMode) {
                                    toggleSelectItem(item.id);
                                } else {
                                    onSelect(item);
                                }
                            }}
                            onKeyDown={(event) => {
                                if (event.key !== 'Enter' && event.key !== ' ') return;
                                event.preventDefault();
                                if (isEditMode) toggleSelectItem(item.id);
                                else onSelect(item);
                            }}
                            className={`ll-pressable flex cursor-pointer gap-4 rounded-[1.4rem] border p-3.5 transition-[transform,background-color,border-color] duration-150 ${animFadeInUp} ${itemBgClass} ${
                                isEditMode && isSelected 
                                    ? (isDark ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-indigo-300 bg-indigo-50/40') 
                                    : ''
                            }`}
                            style={{ animationDelay: `${Math.min(index, 6) * 45}ms` }}
                        >
                            {/* Checkbox (only in Edit Mode) */}
                            {isEditMode && (
                                <div className="flex items-center justify-center shrink-0 pe-1 animate-fade-in">
                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-150 ${
                                        isSelected 
                                            ? 'bg-indigo-500 border-indigo-500 text-white animate-scale-in' 
                                            : (isDark ? 'border-white/20 bg-white/5' : 'border-gray-300 bg-white')
                                    }`}>
                                        {isSelected && (
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Thumbnail */}
                            <div className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[1.05rem] shadow-inner ${isDark ? 'bg-[#22221f]' : 'bg-black/8'}`}>
                                 {item.thumbnail ? (
                                     <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                                 ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-serif text-2xl opacity-30">
                                        {item.title.charAt(0)}
                                    </div>
                                 )}
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                                <h3 className={`mb-1 truncate font-serif text-xl leading-tight ${isDark ? 'text-[#f4f0e6]' : 'text-[#171714]'}`}>{item.title}</h3>
                                <p className={`text-sm mb-2 font-medium line-clamp-1 opacity-90 ${accentTextClass}`}>
                                    {item.mirrorInsight}
                                </p>
                                 <p className={`text-xs font-mono uppercase tracking-wider opacity-60 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {new Date(item.timestamp).toLocaleDateString(language, { month: 'short', day: 'numeric' })}
                                    {sourceRecord?.location?.label ? ` • ${sourceRecord.location.label}` : ''}
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
            <div className="h-20"></div>
          </div>
        </div>

        {/* Bulk Delete Sticky Bar at Bottom */}
        {isEditMode && (
            <div className={`border-t p-4 flex justify-between items-center z-20 backdrop-blur-md sticky bottom-0 left-0 right-0 ${
                isDark ? 'bg-black/95 border-white/10 text-white' : 'bg-white/95 border-gray-200 text-gray-900'
            } animate-fade-in-up`}>
                <div className="text-sm">
                    <span className={subTextClass}>
                        {t('history.selected', { count: selectedIds.length })}
                    </span>
                </div>
                <button
                    onClick={handleDeleteSelected}
                    disabled={selectedIds.length === 0}
                    className={`ll-pressable flex items-center justify-center gap-2 rounded-xl px-6 py-2.5 text-sm font-semibold transition-transform duration-150 ${
                        selectedIds.length === 0
                            ? 'opacity-40 cursor-not-allowed bg-red-500/10 text-red-500/50 border border-red-500/10'
                            : 'bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/20 active:scale-95'
                    }`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                    <span>{t('history.deleteSelected')}</span>
                </button>
            </div>
        )}

        {/* Daily Recap Modal / Overlay */}
        {showRecap && (
            // CRITICAL FIX: Use simple fixed overlay with overflow-y-auto. 
            // Avoid complex flex-centering on the scroll container itself.
            <div className="fixed inset-0 z-50 overflow-y-auto bg-black/95 backdrop-blur-xl animate-fade-in">
                 
                 {/* Close Button - Fixed relative to viewport so it is always accessible */}
                 <button 
                    aria-label={t('aria.close')}
                    onClick={() => setShowRecap(false)}
                    className="fixed top-6 end-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-90 z-[60] border border-white/5 backdrop-blur-md"
                 >
                    <IconChevronDown className="w-6 h-6" />
                 </button>

                 {/* Layout Wrapper: Ensures min-height is full screen, allowing centering for short content, but expansion for tall content */}
                 <div className="min-h-full w-full flex flex-col items-center justify-center p-4 py-20">
                     
                     {/* Loading State */}
                     {isGenerating && (
                         <div className="flex flex-col items-center justify-center gap-8">
                             <div className="relative w-24 h-24">
                                 <div className="absolute inset-0 border-t-2 border-indigo-500 rounded-full animate-spin"></div>
                                 <div className="absolute inset-2 border-e-2 border-purple-500 rounded-full animate-spin reverse"></div>
                                 <div className="absolute inset-4 border-b-2 border-pink-500 rounded-full animate-spin"></div>
                             </div>
                             <p className={`text-sm tracking-[0.2em] animate-pulse font-mono uppercase ${isDark ? 'text-gray-400' : 'text-gray-200'}`}>{t('history.writing')}</p>
                         </div>
                     )}

                     {/* Recap Card - Width constrained, height natural */}
                     {!isGenerating && recapData && (
                         <div className={`w-full max-w-lg relative animate-fade-in-up flex flex-col sm:rounded-[2rem] rounded-3xl shadow-2xl overflow-hidden ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-[#fffbf0] text-gray-900'}`}>
                             
                             {/* Abstract Header Background */}
                             <div className="absolute top-0 inset-x-0 h-64 overflow-hidden pointer-events-none">
                                 <div className={`absolute -top-20 -start-20 w-64 h-64 rounded-full blur-[80px] opacity-40 ${isDark ? 'bg-indigo-600' : 'bg-indigo-300'}`}></div>
                                 <div className={`absolute top-0 end-0 w-40 h-40 rounded-full blur-[60px] opacity-30 ${isDark ? 'bg-purple-600' : 'bg-purple-300'}`}></div>
                             </div>

                             {/* --- SECTION 1: Resonance (Philosophy) --- */}
                             <div className="relative z-10 p-8 pb-4 flex flex-col items-center text-center mt-8 sm:mt-0">
                                 <div className="mt-8 mb-6">
                                     <ResonanceFractal score={recapData.score} isDark={isDark} />
                                 </div>
                                 
                                 <h2 className="text-2xl font-serif italic mb-2 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-white to-indigo-300">
                                     "{recapData.archetype}"
                                 </h2>
                                 
                                 <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mb-6"></div>

                                 <p className={`text-lg font-light leading-relaxed max-w-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                                     {recapData.philosophicalTake}
                                 </p>
                                 
                                 {/* Tags */}
                                 <div className="flex gap-2 mt-6 justify-center flex-wrap">
                                     {recapData.tags.map(tag => (
                                         <span key={tag} className={`text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border ${isDark ? 'border-white/10 bg-white/5 text-gray-400' : 'border-black/10 bg-black/5 text-gray-600'}`}>
                                             #{tag}
                                         </span>
                                     ))}
                                 </div>
                             </div>

                             {/* --- SECTION 2: Axis Map (Spatial/Time) --- */}
                             <div className={`relative mt-8 rounded-t-[2.5rem] border-t ${isDark ? 'bg-[#121212] border-white/10' : 'bg-white border-gray-200 shadow-[0_-10px_30px_rgba(0,0,0,0.05)]'}`}>
                                 <div className="p-8 pb-32">
                                     <div className="flex items-center gap-3 mb-6">
                                         <div className="w-2 h-8 bg-indigo-500 rounded-full"></div>
                                         <h3 className={`text-xl font-thin tracking-widest uppercase ${isDark ? 'text-white' : 'text-gray-900'}`}>{t('history.dailyJournal')}</h3>
                                     </div>
                                     
                                     {/* Journal Text */}
                                     <p className={`font-serif text-base italic leading-loose mb-8 ps-4 border-s ${isDark ? 'text-gray-400 border-white/10' : 'text-gray-600 border-black/10'}`}>
                                         "{recapData.journal}"
                                     </p>

                                     {/* Axis Map Component */}
                                     <AxisMap items={todayItems} onSelect={(item) => {/* Maybe preview image larger? */}} isDark={isDark} />

                                     {/* Footer / Share Hint */}
                                     <div className="mt-12 flex justify-center opacity-40">
                                         <p className="text-[10px] uppercase tracking-[0.3em]">LoreLens • Axis Recap</p>
                                     </div>
                                 </div>
                             </div>

                         </div>
                     )}
                 </div>
            </div>
        )}
    </div>
  );
};
