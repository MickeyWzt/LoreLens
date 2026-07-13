import { describe, expect, test, vi } from 'vitest';

async function loadBackground() {
  return import('../server/background/service').catch(() => null);
}

describe('background image service', () => {
  test('deduplicates a city and time bucket into one Unsplash request', async () => {
    const module = await loadBackground();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{
          urls: { regular: 'https://images.unsplash.com/example.jpg' },
          links: { download_location: 'https://api.unsplash.com/photos/example/download' },
          user: { name: 'Photographer', links: { html: 'https://unsplash.com/@photo' } },
        }],
      }),
    });
    const service = module.createBackgroundService({ accessKey: 'key', fetchImpl });

    const first = await service.getBackground('Paris street', 'evening');
    const second = await service.getBackground('Paris street', 'evening');

    expect(first?.imageUrl).toContain('images.unsplash.com');
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('returns unavailable without making a request when the key is missing', async () => {
    const module = await loadBackground();
    expect(module).not.toBeNull();
    if (!module) return;

    const fetchImpl = vi.fn();
    const service = module.createBackgroundService({ fetchImpl });

    await expect(service.getBackground('Tokyo', 'morning')).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
