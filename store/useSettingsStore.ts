import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppTheme, AppFontSize, AppLanguage, AppAccentColor } from '../types';

export const SETTINGS_KEY = 'lorelens_settings_v2';
const LEGACY_SETTINGS_KEY = 'context_lens_settings_zustand';

export function migrateSettingsState(persistedState: unknown): Record<string, unknown> {
  const old = (persistedState || {}) as Record<string, unknown>;
  const { highResAudio: _legacyAudio, ...rest } = old;
  return {
    ...rest,
    readAloudEnabled: Boolean(old.readAloudEnabled ?? old.highResAudio ?? false),
  };
}

const settingsStorage = () => {
  if (typeof localStorage === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return {
    getItem: (name: string) => {
      const current = localStorage.getItem(name);
      if (current) return current;
      const legacy = localStorage.getItem(LEGACY_SETTINGS_KEY);
      if (legacy) {
        localStorage.setItem(name, legacy);
        localStorage.removeItem(LEGACY_SETTINGS_KEY);
      }
      return legacy;
    },
    setItem: (name: string, value: string) => localStorage.setItem(name, value),
    removeItem: (name: string) => localStorage.removeItem(name),
  };
};

interface SettingsState {
  saveToGallery: boolean;
  readAloudEnabled: boolean;
  theme: AppTheme;
  fontSize: AppFontSize;
  language: AppLanguage;
  accentColor: AppAccentColor;
  reduceMotion: boolean;
  
  setSaveToGallery: (val: boolean) => void;
  setReadAloudEnabled: (val: boolean) => void;
  setTheme: (theme: AppTheme) => void;
  setFontSize: (size: AppFontSize) => void;
  setLanguage: (lang: AppLanguage) => void;
  setAccentColor: (color: AppAccentColor) => void;
  setReduceMotion: (reduce: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      saveToGallery: false,
      readAloudEnabled: false,
      theme: 'dark',
      fontSize: 'medium',
      language: 'en',
      accentColor: 'indigo',
      reduceMotion: false,
      
      setSaveToGallery: (saveToGallery) => set({ saveToGallery }),
      setReadAloudEnabled: (readAloudEnabled) => set({ readAloudEnabled }),
      setTheme: (theme) => set({ theme }),
      setFontSize: (fontSize) => set({ fontSize }),
      setLanguage: (language) => set({ language }),
      setAccentColor: (accentColor) => set({ accentColor }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
    }),
    {
      name: SETTINGS_KEY,
      version: 2,
      storage: createJSONStorage(settingsStorage),
      migrate: (persistedState: unknown) => {
        return migrateSettingsState(persistedState) as unknown as SettingsState;
      },
    }
  )
);
