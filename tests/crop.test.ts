import { describe, expect, test } from 'vitest';

async function loadCrop() {
  return import('../domain/crop').catch(() => null);
}

describe('crop geometry', () => {
  test('keeps every resize handle within image bounds and above the minimum size', async () => {
    const module = await loadCrop();
    expect(module).not.toBeNull();
    if (!module) return;

    const resized = module.updateCrop(
      { x: 5, y: 5, width: 90, height: 90 },
      'br',
      50,
      50,
    );
    expect(resized.x + resized.width).toBeLessThanOrEqual(100);
    expect(resized.y + resized.height).toBeLessThanOrEqual(100);

    const shrunk = module.updateCrop(resized, 'tl', 200, 200);
    expect(shrunk.width).toBeGreaterThanOrEqual(15);
    expect(shrunk.height).toBeGreaterThanOrEqual(15);
  });

  test('maps a percent crop to natural pixels for portrait and landscape images', async () => {
    const module = await loadCrop();
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.cropToPixels({ x: 10, y: 20, width: 80, height: 60 }, 2000, 1000))
      .toEqual({ x: 200, y: 200, width: 1600, height: 600 });
    expect(module.DEFAULT_CROP).toEqual({ x: 5, y: 10, width: 90, height: 80 });
  });
});
