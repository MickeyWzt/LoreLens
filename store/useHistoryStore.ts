import { create } from 'zustand';
import { HistoryItem } from '../types';
import localforage from 'localforage';

interface HistoryState {
  history: HistoryItem[];
  setHistory: (history: HistoryItem[] | ((prev: HistoryItem[]) => HistoryItem[])) => void;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: [],
  setHistory: (updater) => {
    set((state) => {
        const newHistory = typeof updater === 'function' ? updater(state.history) : updater;
        localforage.setItem('context_lens_history', newHistory).catch(e => console.warn("Failed to save history", e));
        return { history: newHistory };
    });
  },
  loadHistory: async () => {
      try {
          const savedHistory = await localforage.getItem<HistoryItem[]>('context_lens_history');
          if (savedHistory) {
              set({ history: savedHistory });
          } else {
              // Migration path from fallback
              const oldHistory = localStorage.getItem('context_lens_history');
              if (oldHistory) {
                  const parsed = JSON.parse(oldHistory);
                  set({ history: parsed });
                  await localforage.setItem('context_lens_history', parsed);
                  localStorage.removeItem('context_lens_history');
              }
          }
      } catch (e) {
          console.warn("Failed to load history from localforage", e);
      }
  },
  clearHistory: async () => {
      set({ history: [] });
      try {
          await localforage.removeItem('context_lens_history');
          localStorage.removeItem('context_lens_history');
      } catch (e) {
          console.error("Failed to clear history", e);
      }
  }
}));
