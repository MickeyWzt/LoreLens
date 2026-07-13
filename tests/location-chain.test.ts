import { describe, expect, test, vi } from 'vitest';

async function loadLocation() {
  return import('../services/locationService').catch(() => null);
}

const denied = { code: 1, message: 'denied' };

describe('location fallback chain', () => {
  test('retries with low accuracy after a high-accuracy failure', async () => {
    const module = await loadLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const getCurrentPosition = vi.fn()
      .mockImplementationOnce((_success, failure) => failure(denied))
      .mockImplementationOnce((success) => success({
        coords: { latitude: 35.68, longitude: 139.76, accuracy: 1200 },
      }));
    const result = await module.resolveLocation({
      geolocation: { getCurrentPosition },
      storage: module.createMemoryStorage(),
      fetchImpl: vi.fn(),
      now: () => 1_000,
    });

    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ source: 'gps', approximate: true, lat: 35.68, lng: 139.76 });
  });

  test('uses the last valid location before an IP lookup', async () => {
    const module = await loadLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const storage = module.createMemoryStorage();
    storage.setItem(module.LOCATION_CACHE_KEY, JSON.stringify({
      lat: 48.85,
      lng: 2.35,
      label: 'Paris',
      accuracy: 30,
      source: 'gps',
      approximate: false,
      capturedAt: 900,
    }));
    const fetchImpl = vi.fn();
    const result = await module.resolveLocation({
      geolocation: { getCurrentPosition: (_success, failure) => failure(denied) },
      storage,
      fetchImpl,
      now: () => 1_000,
    });

    expect(result).toMatchObject({ source: 'cache', label: 'Paris' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('returns an explicit unavailable snapshot instead of Beijing', async () => {
    const module = await loadLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const result = await module.resolveLocation({
      geolocation: undefined,
      storage: module.createMemoryStorage(),
      fetchImpl: vi.fn().mockResolvedValue({ status: 204, ok: true }),
      now: () => 2_000,
    });

    expect(result).toEqual({ source: 'none', approximate: true, capturedAt: 2_000 });
  });
});
