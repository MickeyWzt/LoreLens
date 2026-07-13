import {
  analysisRecordSchema,
  loreLensExportSchema,
  mergeRecordsByNewest,
  type AnalysisRecordV2,
  type AppLanguage,
  type LocationSnapshot,
} from './model';

interface NewPendingRecord {
  id: string;
  image: string;
  thumbnail?: string;
  language: AppLanguage;
  location?: LocationSnapshot;
  createdAt: number;
}

export function createPendingRecord(input: NewPendingRecord): AnalysisRecordV2 {
  return analysisRecordSchema.parse({
    schemaVersion: 2,
    id: input.id,
    status: 'pending',
    image: input.image,
    thumbnail: input.thumbnail,
    language: input.language,
    location: input.location,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  });
}

export function exportRecords(
  records: AnalysisRecordV2[],
  settings?: Record<string, unknown>,
  now = Date.now(),
): string {
  return JSON.stringify(loreLensExportSchema.parse({
    schemaVersion: 2,
    exportedAt: now,
    records,
    settings,
  }), null, 2);
}

export function importRecords(json: string, existing: AnalysisRecordV2[]): AnalysisRecordV2[] {
  const parsed = loreLensExportSchema.parse(JSON.parse(json));
  return mergeRecordsByNewest(existing, parsed.records);
}
