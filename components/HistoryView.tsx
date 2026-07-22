
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
import { getPaletteThemeColors } from '../utils/palettes';

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

    const palette = getPaletteThemeColors(accentColor, isDark ? 'dark' : 'light');
    const mainColor = palette.accent;
    const secColor = palette.secondary;

    return (
        <div className="relative w-40 h-40 flex items-center justify-center">
            {/* Spinning background Aura */}
            <div className="absolute inset-0 rounded-full blur-2xl opacity-20" style={{ backgroundColor: mainColor, transform: `scale(${scale})` }}></div>
            
            <svg width="160" height="160" viewBox="0 0 160 160" className="animate-[spin_20s_linear_infinite]">
                 {/* Outer Geometric Ring */}
                <circle cx="80" cy="80" r="78" fill="none" stroke={palette.text} strokeOpacity="0.1" strokeWidth="1" />
                
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
                    fill={mainColor}
                    fillOpacity={isDark ? 0.1 : 0.06}
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
                <span className="font-mono text-3xl font-bold text-[var(--ll-text)]">{score}</span>
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
                            <div className="absolute start-[20px] h-px w-8 bg-[var(--ll-border-strong)]"></div>

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
                                className="ll-pressable ms-12 flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-3 transition-[transform,background-color,border-color] duration-150"
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
                                    <h4 className="text-sm font-medium leading-tight text-[var(--ll-text)]">{item.title}</h4>
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
  const { theme, language, accentColor } = useSettingsStore();
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
  const bgClass = 'bg-[var(--ll-canvas)] text-[var(--ll-text)]';
  const headerBgClass = 'bg-[var(--ll-surface-strong)] border-[var(--ll-border)]';
  const itemBgClass = 'bg-[var(--ll-surface)] border-[var(--ll-border)] active:bg-[var(--ll-accent-soft)]';
  const subTextClass = 'text-[var(--ll-text-muted)]';
  const accentTextClass = accent.text;
  const iconBtnClass = 'border-[var(--ll-border)] bg-[var(--ll-surface-soft)] text-[var(--ll-text)] hover:bg-[var(--ll-accent-soft)]';

  return (
    <div role="region" aria-label={t('history.title')} className={`absolute inset-0 z-30 flex flex-col ${bgClass}`}>
        
        {/* Header */}
        <div className={`sticky top-0 z-10 border-b px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl ${headerBgClass}`}>
          <div className="mx-auto flex max-w-lg flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            {isEditMode ? (
                <div className="flex items-center gap-2">
                    <span className="font-serif text-2xl tracking-[-0.02em]">
                        {t('history.selected', { count: selectedIds.length })}
                    </span>
                </div>
            ) : (
                <div className="min-w-0">
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
                                    : 'border-[var(--ll-border)] bg-[var(--ll-surface)] hover:bg-[var(--ll-accent-soft)]'
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
                                'border-[var(--ll-border)] bg-[var(--ll-surface)] hover:bg-[var(--ll-accent-soft)]'
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
                                'border-[var(--ll-border)] bg-[var(--ll-surface)] hover:bg-[var(--ll-accent-soft)]'
                                    }`}
                                >
                                    {t('history.manage')}
                                </button>
                            </>
                        )}
                        <button 
                            aria-label={t('aria.close')}
                            onClick={onClose} 
                            className={`ll-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-150 ${iconBtnClass}`}
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
                <div className={`flex h-[60vh] flex-col items-center justify-center text-center ${subTextClass}`}>
                    <span className="mb-5 h-px w-10 bg-current opacity-50" aria-hidden="true" />
                    <p className="font-serif text-3xl text-current">{t('history.empty')}</p>
                    <p className="mt-3 max-w-xs text-sm leading-relaxed opacity-65">{t('history.emptySub')}</p>
                </div>
            ) : (
                history.map((item) => {
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
                            className={`ll-pressable flex cursor-pointer gap-4 rounded-[1.4rem] border p-3.5 transition-[transform,background-color,border-color] duration-150 ${itemBgClass} ${
                                isEditMode && isSelected 
                                    ? 'border-[var(--ll-accent-border)] bg-[var(--ll-accent-soft)]'
                                    : ''
                            }`}
                        >
                            {/* Checkbox (only in Edit Mode) */}
                            {isEditMode && (
                                <div className="flex shrink-0 items-center justify-center pe-1">
                                    <div className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-150 ${
                                        isSelected 
                                            ? 'border-[var(--ll-accent)] bg-[var(--ll-accent)] text-[var(--ll-on-accent)]'
                                            : 'border-[var(--ll-border-strong)] bg-[var(--ll-surface)]'
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
                            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[1.05rem] bg-[var(--ll-surface-solid)] shadow-inner">
                                 {item.thumbnail ? (
                                     <img src={item.thumbnail} alt={item.title} className="h-full w-full object-cover" />
                                 ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-serif text-2xl opacity-30">
                                        {item.title.charAt(0)}
                                    </div>
                                 )}
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                                <h3 className="mb-1 truncate font-serif text-xl leading-tight text-[var(--ll-text)]">{item.title}</h3>
                                <p className={`text-sm mb-2 font-medium line-clamp-1 opacity-90 ${accentTextClass}`}>
                                    {item.mirrorInsight}
                                </p>
                                 <p className="font-mono text-xs uppercase tracking-wider text-[var(--ll-text-muted)]">
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
        <div
            aria-hidden={!isEditMode}
            inert={!isEditMode}
            className={`absolute inset-x-0 bottom-0 z-20 flex items-center justify-between border-t p-4 backdrop-blur-md transition-[opacity,transform] duration-200 [transition-timing-function:var(--ll-ease-out)] ${
                'border-[var(--ll-border)] bg-[var(--ll-surface-strong)] text-[var(--ll-text)]'
            } ${isEditMode ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`}
        >
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

        {/* Daily Recap Modal / Overlay */}
        {showRecap && (
            // CRITICAL FIX: Use simple fixed overlay with overflow-y-auto. 
            // Avoid complex flex-centering on the scroll container itself.
            <div className="ll-modal-backdrop-enter fixed inset-0 z-50 overflow-y-auto bg-black/95 backdrop-blur-xl">
                 
                 {/* Close Button - Fixed relative to viewport so it is always accessible */}
                 <button 
                    aria-label={t('aria.close')}
                    onClick={() => setShowRecap(false)}
                    className="ll-pressable fixed end-6 top-6 z-[60] flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white backdrop-blur-md transition-[transform,background-color] duration-150 hover:bg-white/20"
                 >
                    <IconChevronDown className="w-6 h-6" />
                 </button>

                 {/* Layout Wrapper: Ensures min-height is full screen, allowing centering for short content, but expansion for tall content */}
                 <div className="min-h-full w-full flex flex-col items-center justify-center p-4 py-20">
                     
                     {/* Loading State */}
                     {isGenerating && (
                         <div className="flex flex-col items-center justify-center gap-8">
                             <div className="relative flex h-24 w-24 items-center justify-center rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface)]">
                                  <div className="absolute inset-2 animate-[spin_1.1s_linear_infinite] rounded-full border border-transparent border-t-[var(--ll-accent)]" />
                                  <IconJournal className="h-6 w-6 text-[var(--ll-accent)]" />
                             </div>
                             <p className={`font-mono text-sm uppercase tracking-[0.2em] ${isDark ? 'text-gray-400' : 'text-gray-200'}`}>{t('history.writing')}</p>
                         </div>
                     )}

                     {/* Recap Card - Width constrained, height natural */}
                     {!isGenerating && recapData && (
                         <div className="ll-modal-enter relative flex w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-[var(--ll-canvas)] text-[var(--ll-text)] shadow-2xl sm:rounded-[2rem]">
                             
                             {/* Abstract Header Background */}
                             <div className="absolute top-0 inset-x-0 h-64 overflow-hidden pointer-events-none">
                                  <div className="absolute -start-20 -top-20 h-64 w-64 rounded-full bg-[var(--ll-accent)] opacity-30 blur-[80px]"></div>
                                  <div className="absolute end-0 top-0 h-40 w-40 rounded-full bg-[var(--ll-secondary)] opacity-25 blur-[60px]"></div>
                             </div>

                             {/* --- SECTION 1: Resonance (Philosophy) --- */}
                             <div className="relative z-10 p-8 pb-4 flex flex-col items-center text-center mt-8 sm:mt-0">
                                 <div className="mt-8 mb-6">
                                     <ResonanceFractal score={recapData.score} isDark={isDark} />
                                 </div>
                                 
                                  <h2 className="mb-2 bg-clip-text font-serif text-2xl italic tracking-wide text-transparent" style={{ backgroundImage: 'linear-gradient(90deg, var(--ll-accent), var(--ll-text), var(--ll-accent))' }}>
                                     "{recapData.archetype}"
                                 </h2>
                                 
                                  <div className="mb-6 h-0.5 w-12 bg-gradient-to-r from-transparent via-[var(--ll-accent)] to-transparent"></div>

                                  <p className="max-w-sm text-lg font-light leading-relaxed text-[var(--ll-text-sub)]">
                                     {recapData.philosophicalTake}
                                 </p>
                                 
                                 {/* Tags */}
                                 <div className="flex gap-2 mt-6 justify-center flex-wrap">
                                     {recapData.tags.map(tag => (
                                         <span key={tag} className="rounded-full border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-1 text-[10px] uppercase tracking-widest text-[var(--ll-text-muted)]">
                                             #{tag}
                                         </span>
                                     ))}
                                 </div>
                             </div>

                             {/* --- SECTION 2: Axis Map (Spatial/Time) --- */}
                             <div className="relative mt-8 rounded-t-[2.5rem] border-t border-[var(--ll-border)] bg-[var(--ll-surface-solid)] shadow-[0_-10px_30px_rgba(0,0,0,0.08)]">
                                 <div className="p-8 pb-32">
                                     <div className="flex items-center gap-3 mb-6">
                                         <div className="h-8 w-2 rounded-full bg-[var(--ll-accent)]"></div>
                                         <h3 className="text-xl font-thin uppercase tracking-widest text-[var(--ll-text)]">{t('history.dailyJournal')}</h3>
                                     </div>
                                     
                                     {/* Journal Text */}
                                     <p className="mb-8 border-s border-[var(--ll-border)] ps-4 font-serif text-base italic leading-loose text-[var(--ll-text-sub)]">
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
