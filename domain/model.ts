import { z } from 'zod';

export const appLanguageSchema = z.enum(['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ar']);
export type AppLanguage = z.infer<typeof appLanguageSchema>;

export const decipherResultSchema = z.object({
  title: z.string().trim().min(1),
  essence: z.string().trim().min(1),
  mirrorInsight: z.string().trim().min(1),
  philosophy: z.string().trim().min(1),
  quickAction: z.string().trim().min(1),
  mapUri: z.string().url().optional(),
});

export type DecipherResult = z.infer<typeof decipherResultSchema>;

export const dailyRecapSchema = z.object({
  journal: z.string().trim().min(1),
  score: z.number().int().min(0).max(100),
  mood: z.string().trim().min(1),
  tags: z.array(z.string().trim().min(1)).min(1).max(8),
  philosophicalTake: z.string().trim().min(1),
  archetype: z.string().trim().min(1),
});

export type DailyRecapResult = z.infer<typeof dailyRecapSchema>;

export const locationSnapshotSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  label: z.string().trim().min(1).optional(),
  accuracy: z.number().nonnegative().optional(),
  source: z.enum(['gps', 'exif', 'cache', 'ip', 'none']),
  approximate: z.boolean(),
  capturedAt: z.number().int().nonnegative(),
});

export type LocationSnapshot = z.infer<typeof locationSnapshotSchema>;

export const apiErrorSchema = z.object({
  code: z.string().trim().min(1),
  message: z.string().trim().min(1),
  retryable: z.boolean(),
  requestId: z.string().trim().min(1),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

export const analysisRecordSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().trim().min(1),
  status: z.enum(['complete', 'pending', 'failed']),
  image: z.string().optional(),
  thumbnail: z.string().optional(),
  language: appLanguageSchema,
  location: locationSnapshotSchema.optional(),
  result: decipherResultSchema.optional(),
  error: apiErrorSchema.optional(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export type AnalysisRecordV2 = z.infer<typeof analysisRecordSchema>;

export const loreLensExportSchema = z.object({
  schemaVersion: z.literal(2),
  exportedAt: z.number().int().nonnegative(),
  records: z.array(analysisRecordSchema),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export type LoreLensExportV2 = z.infer<typeof loreLensExportSchema>;

export function parseDecipherResult(input: unknown): DecipherResult {
  return decipherResultSchema.parse(input);
}

export function parseDailyRecap(input: unknown): DailyRecapResult {
  return dailyRecapSchema.parse(input);
}

type LegacyHistoryItem = Partial<DecipherResult> & {
  id?: string;
  timestamp?: number;
  thumbnail?: string;
  location?: { lat?: number; lng?: number };
};

export function migrateLegacyHistory(items: unknown): AnalysisRecordV2[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as LegacyHistoryItem;
    const parsedResult = decipherResultSchema.safeParse(item);
    if (!parsedResult.success) return [];

    const timestamp = Number.isFinite(item.timestamp) ? Number(item.timestamp) : Date.now();
    const hasCoordinates = Number.isFinite(item.location?.lat) && Number.isFinite(item.location?.lng);
    const location = hasCoordinates
      ? locationSnapshotSchema.parse({
          lat: item.location?.lat,
          lng: item.location?.lng,
          source: 'cache',
          approximate: false,
          capturedAt: timestamp,
        })
      : undefined;

    return [{
      schemaVersion: 2 as const,
      id: item.id || `legacy-${timestamp}-${index}`,
      status: 'complete' as const,
      thumbnail: item.thumbnail,
      language: 'en' as const,
      location,
      result: parsedResult.data,
      createdAt: timestamp,
      updatedAt: timestamp,
    }];
  });
}

export function mergeRecordsByNewest<T extends { id: string; updatedAt: number }>(
  existing: T[],
  incoming: T[],
): T[] {
  const records = new Map<string, T>();
  for (const record of [...existing, ...incoming]) {
    const current = records.get(record.id);
    if (!current || record.updatedAt > current.updatedAt) records.set(record.id, record);
  }
  return [...records.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}
