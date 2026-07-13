import { describe, expect, test, vi } from 'vitest';

async function loadServerLocation() {
  return import('../server/location/service').catch(() => null);
}

describe('server location service', () => {
  test('caches reverse geocoding and returns a readable label', async () => {
    const module = await loadServerLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ display_name: 'Le Marais, Paris, France' }),
    });
    const service = module.createLocationService({ fetchImpl });
    const first = await service.reverse(48.86, 2.35, 'fr');
    const second = await service.reverse(48.86, 2.35, 'fr');

    expect(first.label).toContain('Paris');
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('does not make an IP request unless an endpoint is configured', async () => {
    const module = await loadServerLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn();
    const service = module.createLocationService({ fetchImpl });
    await expect(service.locateIp()).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
