import {
  locationSnapshotSchema,
  type LocationSnapshot,
} from '../domain/model';

export const LOCATION_CACHE_KEY = 'lorelens_location_v2';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

interface GeolocationLike {
  getCurrentPosition(
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions,
  ): void;
}

interface ResolveLocationOptions {
  geolocation?: GeolocationLike;
  storage?: StorageLike;
  fetchImpl?: typeof fetch;
  now?: () => number;
  isOnline?: boolean;
}

export function createMemoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function requestPosition(
  geolocation: GeolocationLike,
  options: PositionOptions,
): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    geolocation.getCurrentPosition(resolve, reject, options);
  });
}

function readCached(storage: StorageLike): LocationSnapshot | undefined {
  try {
    const raw = storage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = locationSnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || parsed.data.lat === undefined || parsed.data.lng === undefined) return undefined;
    return { ...parsed.data, source: 'cache', approximate: true };
  } catch {
    return undefined;
  }
}

export async function resolveLocation({
  geolocation = typeof navigator !== 'undefined' ? navigator.geolocation : undefined,
  storage = typeof localStorage !== 'undefined' ? localStorage : createMemoryStorage(),
  fetchImpl = fetch,
  now = Date.now,
  isOnline = typeof navigator === 'undefined' ? true : navigator.onLine,
}: ResolveLocationOptions = {}): Promise<LocationSnapshot> {
  if (geolocation) {
    for (const [enableHighAccuracy, timeout] of [[true, 8_000], [false, 6_000]] as const) {
      try {
        const position = await requestPosition(geolocation, {
          enableHighAccuracy,
          timeout,
          maximumAge: enableHighAccuracy ? 0 : 300_000,
        });
        const snapshot = locationSnapshotSchema.parse({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          source: 'gps',
          approximate: !enableHighAccuracy || position.coords.accuracy > 500,
          capturedAt: now(),
        });
        storage.setItem(LOCATION_CACHE_KEY, JSON.stringify(snapshot));
        return snapshot;
      } catch {
        // Continue through the explicit fallback chain.
      }
    }
  }

  const cached = readCached(storage);
  if (cached) return cached;

  if (!isOnline) return { source: 'none', approximate: true, capturedAt: now() };

  try {
    const response = await fetchImpl('/api/location/ip', { signal: AbortSignal.timeout(5_000) });
    if (response.status !== 204 && response.ok) {
      const payload = await response.json() as { data?: unknown };
      const parsed = locationSnapshotSchema.safeParse(payload.data);
      if (parsed.success && parsed.data.lat !== undefined && parsed.data.lng !== undefined) {
        const snapshot = { ...parsed.data, source: 'ip' as const, approximate: true, capturedAt: now() };
        storage.setItem(LOCATION_CACHE_KEY, JSON.stringify(snapshot));
        return snapshot;
      }
    }
  } catch {
    // IP location is optional and must never create a console error or fake coordinates.
  }

  return { source: 'none', approximate: true, capturedAt: now() };
}

export async function addLocationLabel(
  snapshot: LocationSnapshot,
  language: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LocationSnapshot> {
  if (snapshot.lat === undefined || snapshot.lng === undefined || snapshot.label) return snapshot;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return snapshot;
  try {
    const query = new URLSearchParams({
      lat: String(snapshot.lat),
      lng: String(snapshot.lng),
      language,
    });
    const response = await fetchImpl(`/api/location/reverse?${query}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return snapshot;
    const payload = await response.json() as { data?: { label?: string } };
    return payload.data?.label ? { ...snapshot, label: payload.data.label } : snapshot;
  } catch {
    return snapshot;
  }
}
