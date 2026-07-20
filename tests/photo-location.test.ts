import { describe, expect, test, vi } from 'vitest';

async function loadPhotoLocation() {
  return import('../services/photoLocationService').catch(() => null);
}

describe('photo location association', () => {
  test('binds a freshly requested device location to a camera capture', async () => {
    const module = await loadPhotoLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const captured = {
      lat: 36.1147,
      lng: -115.1728,
      accuracy: 18,
      source: 'gps' as const,
      approximate: false,
      capturedAt: 1_720_000_000_000,
    };
    const getDeviceLocation = vi.fn().mockResolvedValue(captured);

    await expect(module.resolvePhotoLocation({
      kind: 'camera',
      language: 'en',
      locationEnabled: true,
      getDeviceLocation,
    })).resolves.toEqual(captured);
    expect(getDeviceLocation).toHaveBeenCalledTimes(1);
  });

  test('uses uploaded photo EXIF instead of the current device location', async () => {
    const module = await loadPhotoLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const exif = {
      lat: 48.8583,
      lng: 2.2945,
      source: 'exif' as const,
      approximate: false,
      capturedAt: 1_710_000_000_000,
    };
    const readExifLocation = vi.fn().mockResolvedValue(exif);
    const labelLocation = vi.fn().mockResolvedValue({ ...exif, label: 'Paris, France' });
    const getDeviceLocation = vi.fn();

    await expect(module.resolvePhotoLocation({
      kind: 'upload',
      file: {} as File,
      language: 'fr',
      locationEnabled: true,
      getDeviceLocation,
      readExifLocation,
      labelLocation,
    })).resolves.toMatchObject({ source: 'exif', label: 'Paris, France' });
    expect(getDeviceLocation).not.toHaveBeenCalled();
  });

  test('does not attach the current position to an uploaded photo without EXIF GPS', async () => {
    const module = await loadPhotoLocation();
    expect(module).not.toBeNull();
    if (!module) return;

    const getDeviceLocation = vi.fn();
    const result = await module.resolvePhotoLocation({
      kind: 'upload',
      file: {} as File,
      language: 'en',
      locationEnabled: true,
      getDeviceLocation,
      readExifLocation: vi.fn().mockResolvedValue(undefined),
      now: () => 123,
    });

    expect(result).toEqual({ source: 'none', approximate: true, capturedAt: 123 });
    expect(getDeviceLocation).not.toHaveBeenCalled();
  });
});
