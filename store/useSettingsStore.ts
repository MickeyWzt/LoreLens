import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppTheme, AppFontSize, AppLanguage, AppAccentColor } from '../types';

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
      name: 'context_lens_settings_zustand', // Storage name
      version: 2,
      migrate: (persistedState: unknown) => {
        const old = (persistedState || {}) as Record<string, unknown>;
        return {
          ...old,
          readAloudEnabled: Boolean(old.readAloudEnabled ?? old.highResAudio ?? false),
          highResAudio: undefined,
        } as unknown as SettingsState;
      },
    }
  )
);
