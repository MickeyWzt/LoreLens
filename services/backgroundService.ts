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

const FINE_GRAINED_LOCATION = /(?:\b(?:road|street|avenue|boulevard|lane|drive|highway|route|district|county|subdistrict|township)\b|[路街道区县])/iu;

export function backgroundQueryForLocation(label?: string): string {
  const parts = label
    ?.split(/[,，،]/u)
    .map((part) => part.trim())
    .filter(Boolean) || [];
  if (parts.length === 0) return 'world travel cityscape';

  const country = parts.at(-1)!;
  const focus = parts.find((part) => !FINE_GRAINED_LOCATION.test(part)) || country;
  const place = focus.toLocaleLowerCase('en-US') === country.toLocaleLowerCase('en-US')
    ? country
    : `${focus} ${country}`;
  return `${place} travel cityscape`;
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
  query: string,
  timeBucket: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ClientBackground | null> {
  const cacheKey = `${CACHE_PREFIX}${keyFor(query, timeBucket)}`;
  const cached = read(cacheKey);
  if (cached) return Promise.resolve(cached);
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const pending = (async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return read(LAST_KEY, true);
    try {
      const params = new URLSearchParams({ query, timeBucket });
      const response = await fetchImpl(`/api/background?${params}`);
      if (response.status === 204 || !response.ok) return read(LAST_KEY, true);
      const payload = await response.json() as { data?: ClientBackground };
      if (!payload.data?.imageUrl) return read(LAST_KEY, true);
      write(cacheKey, payload.data);
      return payload.data;
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
