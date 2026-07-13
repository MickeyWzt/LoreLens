
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryItem, DailyRecapResult } from '../types';
import { IconChevronDown, IconJournal } from './Icons';
import { generateDailyRecap } from '../services/geminiService';
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
                    className="transition-all duration-1000 ease-out"
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
                                onClick={() => onSelect(item)}
                                className={`ms-12 flex-1 p-3 rounded-xl border flex gap-3 items-center cursor-pointer transition-all active:scale-95 hover:scale-[1.02] ${isDark ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-100 hover:shadow-md'}`}
                            >
                                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10">
                                    {item.thumbnail ? (
                                        <img src={item.thumbnail} alt="thumb" className="w-full h-full object-cover" />
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
  const { history, setHistory } = useHistoryStore();
  const isDark = theme === 'dark';

  // Deletion and checkbox states
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Recap State
  const [showRecap, setShowRecap] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [recapData, setRecapData] = useState<DailyRecapResult | null>(null);
  const [todayItems, setTodayItems] = useState<HistoryItem[]>([]);

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
    
    onShowNotification?.(language === 'zh' ? `已删除 ${selectedIds.length} 条记录` : `Deleted ${selectedIds.length} records`);
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
        onShowNotification?.("Failed to create journal.");
        setShowRecap(false);
    } finally {
        setIsGenerating(false);
    }
  };

  // Styles
  const accent = getAccentStyles(accentColor, isDark);
  const animFadeIn = reduceMotion ? '' : 'animate-fade-in';
  const animFadeInUp = reduceMotion ? '' : 'animate-fade-in-up';
  
  const bgClass = isDark ? 'bg-black text-white' : 'bg-gray-50 text-gray-900';
  const headerBgClass = isDark ? 'bg-black/60 border-white/10' : 'bg-white/80 border-gray-200';
  const itemBgClass = isDark ? 'bg-neutral-900 border-white/5 active:bg-neutral-800' : 'bg-white border-gray-200 shadow-sm active:bg-gray-50';
  const subTextClass = isDark ? 'text-gray-500' : 'text-gray-400';
  const accentTextClass = accent.text;
  const iconBtnClass = isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-600';

  return (
    <div className={`absolute inset-0 z-30 flex flex-col ${bgClass}`}>
        
        {/* Header */}
        <div className={`pt-12 px-6 pb-6 flex items-center justify-between border-b backdrop-blur-md sticky top-0 z-10 ${headerBgClass}`}>
            {isEditMode ? (
                <div className="flex items-center gap-2">
                    <span className={`text-xl font-light tracking-wide ${animFadeIn}`}>
                        {language === 'zh' ? `已选择 ${selectedIds.length} 项` : `${selectedIds.length} Selected`}
                    </span>
                </div>
            ) : (
                <h1 className={`text-3xl font-thin tracking-wider ${animFadeInUp}`}>{t('history.title')}</h1>
            )}
            
            <div className="flex items-center gap-2">
                {isEditMode ? (
                    <>
                        <button 
                            onClick={toggleSelectAll}
                            className={`px-3 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all active:scale-95 border ${
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
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 border ${
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
                                    className={`flex items-center gap-2 px-4 py-2 rounded-full transition-transform active:scale-95 border ${accent.lightBg} ${accent.text} ${accent.border}`}
                                >
                                    <IconJournal className="w-4 h-4" />
                                    <span className="text-sm font-medium">{t('history.recapButton')}</span>
                                </button>
                                <button 
                                    onClick={() => {
                                        setIsEditMode(true);
                                        setSelectedIds([]);
                                    }}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-transform active:scale-95 border ${
                                        isDark ? 'bg-white/10 border-white/10 hover:bg-white/20' : 'bg-white border-gray-200 hover:bg-gray-100'
                                    }`}
                                >
                                    {t('history.manage')}
                                </button>
                            </>
                        )}
                        <button 
                            onClick={onClose} 
                            className={`p-2 rounded-full active:scale-90 transition-transform duration-200 ${iconBtnClass}`}
                        >
                            <IconChevronDown className="w-6 h-6" />
                        </button>
                    </>
                )}
            </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.length === 0 ? (
                <div className={`flex flex-col items-center justify-center h-64 ${subTextClass} animate-fade-in-up delay-200`}>
                    <p>{t('history.empty')}</p>
                    <p className="text-sm mt-2 opacity-60">{t('history.emptySub')}</p>
                </div>
            ) : (
                history.map((item, index) => {
                    const isSelected = selectedIds.includes(item.id);
                    return (
                        <div 
                            key={item.id}
                            onClick={() => {
                                if (isEditMode) {
                                    toggleSelectItem(item.id);
                                } else {
                                    onSelect(item);
                                }
                            }}
                            className={`flex gap-4 p-4 rounded-2xl border transition-all cursor-pointer animate-fade-in-up ${itemBgClass} ${
                                isEditMode && isSelected 
                                    ? (isDark ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-indigo-300 bg-indigo-50/40') 
                                    : ''
                            }`}
                            style={{ animationDelay: `${index * 100}ms` }}
                        >
                            {/* Checkbox (only in Edit Mode) */}
                            {isEditMode && (
                                <div className="flex items-center justify-center shrink-0 pe-1 animate-fade-in">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
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
                            <div className={`w-20 h-20 rounded-xl shrink-0 overflow-hidden relative shadow-inner ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
                                 {item.thumbnail ? (
                                     <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover transition-transform duration-500 hover:scale-110" />
                                 ) : (
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 font-serif text-2xl opacity-30">
                                        {item.title.charAt(0)}
                                    </div>
                                 )}
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col justify-center py-1">
                                <h3 className={`text-lg font-normal truncate mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.title}</h3>
                                <p className={`text-sm mb-2 font-medium line-clamp-1 opacity-90 ${accentTextClass}`}>
                                    {item.mirrorInsight}
                                </p>
                                 <p className={`text-xs font-mono uppercase tracking-wider opacity-60 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {new Date(item.timestamp).toLocaleDateString(language, { month: 'short', day: 'numeric' })} • Beijing
                                </p>
                            </div>
                        </div>
                    );
                })
            )}
            <div className="h-24"></div>
        </div>

        {/* Bulk Delete Sticky Bar at Bottom */}
        {isEditMode && (
            <div className={`border-t p-4 flex justify-between items-center z-20 backdrop-blur-md sticky bottom-0 left-0 right-0 ${
                isDark ? 'bg-black/95 border-white/10 text-white' : 'bg-white/95 border-gray-200 text-gray-900'
            } animate-fade-in-up`}>
                <div className="text-sm">
                    <span className={subTextClass}>
                        {language === 'zh' ? `已选择 ${selectedIds.length} 项` : `${selectedIds.length} items selected`}
                    </span>
                </div>
                <button
                    onClick={handleDeleteSelected}
                    disabled={selectedIds.length === 0}
                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-full text-sm font-medium transition-transform active:scale-95 ${
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
