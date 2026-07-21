export interface ClientBackground {
  imageUrl: string;
  downloadLocation: string;
  photographer: string;
  photographerUrl: string;
}

const CACHE_PREFIX = 'lorelens_background_v2:';
const LAST_KEY = 'lorelens_background_v2:last';
const MAX_AGE = 24 * 60 * 60 * 1_000;
const inFlight = new Map<string, Promise<ClientBackground | null>>();

const STREET_LEVEL_LOCATION = /(?:\b(?:road|street|avenue|boulevard|lane|drive|highway|route)\b|[路街道街])/iu;

export function backgroundQueriesForLocation(label?: string): string[] {
  const parts = label
    ?.split(/[,，،]/u)
    .map((part) => part.trim())
    .filter(Boolean) || [];
  if (parts.length === 0) return ['world travel cityscape'];

  const candidates: string[] = [];
  const add = (locationParts: string[]) => {
    if (locationParts.length === 0) return;
    const query = `${locationParts.join(' ')} travel cityscape`;
    if (!candidates.includes(query)) candidates.push(query);
  };
  add(parts);

  const regionalParts = parts.filter((part) => !STREET_LEVEL_LOCATION.test(part));
  add(regionalParts);
  for (let index = 1; index < regionalParts.length; index += 1) {
    add(regionalParts.slice(index));
  }
  candidates.push('world travel cityscape');
  return [...new Set(candidates)];
}

const storage = () => typeof localStorage !== 'undefined' ? localStorage : undefined;
const keyFor = (query: string, timeBucket: string) => (
  `${query.trim().toLocaleLowerCase('en-US')}::${timeBucket.trim().toLocaleLowerCase('en-US')}`
);

function read(key: string, allowStale = false): ClientBackground | null {
  try {
    const raw = storage()?.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; data: ClientBackground };
    if (!parsed.data?.imageUrl || (!allowStale && Date.now() - parsed.timestamp > MAX_AGE)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function write(key: string, data: ClientBackground): void {
  try {
    const value = JSON.stringify({ timestamp: Date.now(), data });
    storage()?.setItem(key, value);
    storage()?.setItem(LAST_KEY, value);
  } catch {
    // Background caching is optional.
  }
}

export function getBackground(
  query: string | string[],
  timeBucket: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientBackground | null> {
  const queries = (Array.isArray(query) ? query : [query])
    .map((candidate) => candidate.trim())
    .filter(Boolean);
  const cacheKey = `${CACHE_PREFIX}${keyFor(queries.join(' || '), timeBucket)}`;
  const cached = read(cacheKey);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const pending = (async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return read(LAST_KEY, true);
    try {
      for (const candidate of queries) {
        const params = new URLSearchParams({ query: candidate, timeBucket });
        const response = await fetchImpl(`/api/background?${params}`);
        if (response.status === 204) continue;
        if (!response.ok) return read(LAST_KEY, true);
        const payload = await response.json() as { data?: ClientBackground };
        if (!payload.data?.imageUrl) continue;
        write(cacheKey, payload.data);
        return payload.data;
      }
      return read(LAST_KEY, true);
    } catch {
      return read(LAST_KEY, true);
    }
  })().finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, pending);
  return pending;
}

export async function trackBackgroundDownload(
  downloadLocation: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  await fetchImpl('/api/background/download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ downloadLocation }),
  }).catch(() => undefined);
}
