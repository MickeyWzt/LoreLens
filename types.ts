

export interface DecipherResult {
  title: string;
  essence: string;
  mirrorInsight: string;
  philosophy: string;
  quickAction: string;
  mapUri?: string; // URL from Google Maps grounding
}

export interface HistoryItem extends DecipherResult {
  id: string;
  timestamp: number;
  thumbnail?: string; // Base64 thumbnail string
  location?: {
    lat: number;
    lng: number;
  };
}

export interface DailyRecapResult {
  journal: string; // The poetic summary
  score: number; // The Resonance Score (0-100)
  mood: string; // Single word mood
  tags: string[];
  philosophicalTake: string; // e.g., "You focus on stillness..."
  archetype: string; // e.g., "The Socratic Observer"
}

export enum ViewState {
  CAMERA = 'CAMERA',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  MAP = 'MAP'
}

export type AppTheme = 'dark' | 'light';
export type AppFontSize = 'small' | 'medium' | 'large';
export type AppLanguage = 'en' | 'zh' | 'ja' | 'es' | 'fr' | 'ru' | 'ar';
export type AppAccentColor = 'indigo' | 'teal' | 'amber' | 'violet';