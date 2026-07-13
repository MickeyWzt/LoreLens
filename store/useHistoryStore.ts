import localforage from 'localforage';
import { create } from 'zustand';
import { z } from 'zod';
import {
  analysisRecordSchema,
  migrateLegacyHistory,
  type AnalysisRecordV2,
} from '../domain/model';
import { importRecords as mergeImportedRecords } from '../domain/records';
import type { HistoryItem } from '../types';

const RECORDS_KEY = 'lorelens_records_v2';
const LEGACY_KEY = 'context_lens_history';
const recordListSchema = z.array(analysisRecordSchema);

const toHistoryItem = (record: AnalysisRecordV2): HistoryItem | null => {
  if (record.status !== 'complete' || !record.result) return null;
  const location = record.location?.lat !== undefined && record.location.lng !== undefined
    ? { lat: record.location.lat, lng: record.location.lng }
    : undefined;
  return {
    ...record.result,
    id: record.id,
    timestamp: record.createdAt,
    thumbnail: record.thumbnail,
    location,
  };
};

const facade = (records: AnalysisRecordV2[]) => records.flatMap((record) => {
  const item = toHistoryItem(record);
  return item ? [item] : [];
});

interface HistoryState {
  records: AnalysisRecordV2[];
  history: HistoryItem[];
  setRecords: (
    records: AnalysisRecordV2[] | ((previous: AnalysisRecordV2[]) => AnalysisRecordV2[]),
  ) => void;
  addRecord: (record: AnalysisRecordV2) => void;
  updateRecord: (id: string, update: Partial<AnalysisRecordV2>) => void;
  setHistory: (history: HistoryItem[] | ((previous: HistoryItem[]) => HistoryItem[])) => void;
  loadHistory: () => Promise<void>;
  clearHistory: () => Promise<void>;
  importJson: (json: string) => Promise<number>;
}

const persistRecords = (records: AnalysisRecordV2[]) => (
  localforage.setItem(RECORDS_KEY, records)
);

export const useHistoryStore = create<HistoryState>((set, get) => {
  const commit = (records: AnalysisRecordV2[]) => {
    const validated = recordListSchema.parse(records);
    set({ records: validated, history: facade(validated) });
    void persistRecords(validated).catch(() => undefined);
  };

  return {
    records: [],
    history: [],
    setRecords: (updater) => {
      const next = typeof updater === 'function' ? updater(get().records) : updater;
      commit(next);
    },
    addRecord: (record) => commit([record, ...get().records.filter((item) => item.id !== record.id)]),
    updateRecord: (id, update) => commit(get().records.map((record) => (
      record.id === id
        ? analysisRecordSchema.parse({ ...record, ...update, id: record.id, schemaVersion: 2 })
        : record
    ))),
    setHistory: (updater) => {
      const currentHistory = get().history;
      const nextHistory = typeof updater === 'function' ? updater(currentHistory) : updater;
      const existing = new Map(get().records.map((record) => [record.id, record]));
      const nextIds = new Set(nextHistory.map((item) => item.id));
      const nonComplete = get().records.filter((record) => record.status !== 'complete');
      const complete = nextHistory.map((item) => {
        const previous = existing.get(item.id);
        return analysisRecordSchema.parse({
          schemaVersion: 2,
          id: item.id,
          status: 'complete',
          image: previous?.image,
          thumbnail: item.thumbnail,
          language: previous?.language || 'en',
          location: previous?.location || (item.location ? {
            ...item.location,
            source: 'cache',
            approximate: false,
            capturedAt: item.timestamp,
          } : undefined),
          result: {
            title: item.title,
            essence: item.essence,
            mirrorInsight: item.mirrorInsight,
            philosophy: item.philosophy,
            quickAction: item.quickAction,
            mapUri: item.mapUri,
          },
          createdAt: previous?.createdAt || item.timestamp,
          updatedAt: Date.now(),
        });
      });
      commit([...complete, ...nonComplete.filter((record) => !nextIds.has(record.id))]);
    },
    loadHistory: async () => {
      try {
        const stored = await localforage.getItem(RECORDS_KEY);
        const parsed = recordListSchema.safeParse(stored);
        if (parsed.success && parsed.data.length > 0) {
          set({ records: parsed.data, history: facade(parsed.data) });
          return;
        }

        const indexedLegacy = await localforage.getItem(LEGACY_KEY);
        const localLegacy = typeof localStorage !== 'undefined' ? localStorage.getItem(LEGACY_KEY) : null;
        const legacy = indexedLegacy ?? (localLegacy ? JSON.parse(localLegacy) : undefined);
        const migrated = migrateLegacyHistory(legacy);
        set({ records: migrated, history: facade(migrated) });
        await persistRecords(migrated);
        if (migrated.length > 0) {
          await localforage.removeItem(LEGACY_KEY);
          localStorage.removeItem(LEGACY_KEY);
        }
      } catch {
        set({ records: [], history: [] });
      }
    },
    clearHistory: async () => {
      set({ records: [], history: [] });
      await Promise.all([
        localforage.removeItem(RECORDS_KEY),
        localforage.removeItem(LEGACY_KEY),
      ]);
      if (typeof localStorage !== 'undefined') localStorage.removeItem(LEGACY_KEY);
    },
    importJson: async (json) => {
      const merged = mergeImportedRecords(json, get().records);
      commit(merged);
      return merged.length;
    },
  };
});
