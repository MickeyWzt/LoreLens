import { locationSnapshotSchema, type LocationSnapshot } from '../../domain/model';

interface LocationServiceOptions {
  ipLocationUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface ReverseResult {
  label: string;
}

const CHINA_MUNICIPALITIES: Record<string, { en: string; zh: string }> = {
  'CN-BJ': { en: 'Beijing', zh: '北京' },
  'CN-SH': { en: 'Shanghai', zh: '上海' },
  'CN-TJ': { en: 'Tianjin', zh: '天津' },
  'CN-CQ': { en: 'Chongqing', zh: '重庆' },
};

export function createLocationService({
  ipLocationUrl,
  fetchImpl = fetch,
  now = Date.now,
}: LocationServiceOptions = {}) {
  const reverseCache = new Map<string, Promise<ReverseResult>>();

  return {
    reverse(lat: number, lng: number, language: string): Promise<ReverseResult> {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)},${language}`;
      const existing = reverseCache.get(key);
      if (existing) return existing;

      const pending = (async () => {
        const url = new URL('https://nominatim.openstreetmap.org/reverse');
        url.search = new URLSearchParams({
          format: 'json',
          lat: String(lat),
          lon: String(lng),
          zoom: '18',
          addressdetails: '1',
          'accept-language': language,
        }).toString();
        const response = await fetchImpl(url, {
          headers: { 'User-Agent': 'LoreLens/7.14 (support@lorelens.org)' },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) {
          throw Object.assign(new Error(`Reverse geocoding failed: ${response.status}`), {
            status: response.status,
          });
        }
        const payload = await response.json() as {
          display_name?: string;
          name?: string;
          address?: Record<string, string>;
        };
        const address = payload.address || {};
        const city = address.city || address.town || address.village || address.county;
        const municipality = CHINA_MUNICIPALITIES[(address['ISO3166-2-lvl4'] || '').toUpperCase()];
        const region = address.state || address.region || (municipality
          ? (language.toLowerCase().startsWith('zh') ? municipality.zh : municipality.en)
          : undefined);
        const country = address.country;
        const label = [...new Set([payload.name, city, region, country].filter(Boolean))].join(', ')
          || payload.display_name;
        if (!label) throw Object.assign(new Error('Reverse geocoding returned no label'), { status: 502 });
        return { label };
      })().catch((error) => {
        reverseCache.delete(key);
        throw error;
      });

      reverseCache.set(key, pending);
      if (reverseCache.size > 500) reverseCache.delete(reverseCache.keys().next().value!);
      return pending;
    },

    async locateIp(): Promise<LocationSnapshot | null> {
      if (!ipLocationUrl) return null;
      const response = await fetchImpl(ipLocationUrl, { signal: AbortSignal.timeout(5_000) });
      if (!response.ok) {
        throw Object.assign(new Error(`IP location failed: ${response.status}`), { status: response.status });
      }
      const payload = await response.json() as Record<string, unknown>;
      const lat = Number(payload.lat ?? payload.latitude);
      const lng = Number(payload.lng ?? payload.lon ?? payload.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const label = [payload.city, payload.regionName ?? payload.region, payload.country]
        .filter((value) => typeof value === 'string' && value.trim())
        .join(', ');
      return locationSnapshotSchema.parse({
        lat,
        lng,
        label: label || undefined,
        source: 'ip',
        approximate: true,
        capturedAt: now(),
      });
    },
  };
}

export type LocationService = ReturnType<typeof createLocationService>;
