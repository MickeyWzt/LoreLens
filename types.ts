export type {
  AnalysisRecordV2,
  ApiError,
  DailyRecapResult,
  DecipherResult,
  LocationSnapshot,
  LoreLensExportV2,
} from './domain/model';

import type { DecipherResult } from './domain/model';

export interface HistoryItem extends DecipherResult {
  id: string;
  timestamp: number;
  thumbnail?: string; // Base64 thumbnail string
  location?: {
    lat: number;
    lng: number;
  };
}

export enum ViewState {
  CAMERA = 'CAMERA',
  HISTORY = 'HISTORY',
  SETTINGS = 'SETTINGS',
  MAP = 'MAP'
}

export type AppTheme = 'dark' | 'light';
export type AppFontSize = 'small' | 'medium' | 'large';
export type AppLanguage = 'en' | 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'it' | 'pt' | 'ru' | 'ar';
export type AppAccentColor = 'archive' | 'olive' | 'coast' | 'sunset' | 'harbor' | 'earth';
