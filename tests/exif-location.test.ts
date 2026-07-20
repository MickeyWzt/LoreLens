import { describe, expect, test } from 'vitest';

async function loadImageUtils() {
  return import('../utils/image').catch(() => null);
}

function makeExifJpeg(): ArrayBuffer {
  const tiff = new ArrayBuffer(128);
  const view = new DataView(tiff);
  const bytes = new Uint8Array(tiff);
  bytes.set([0x49, 0x49]);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 1, true);
  view.setUint16(10, 0x8825, true);
  view.setUint16(12, 4, true);
  view.setUint32(14, 1, true);
  view.setUint32(18, 26, true);
  view.setUint32(22, 0, true);

  view.setUint16(26, 4, true);
  const entry = (offset: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, value, true);
  };
  entry(28, 1, 2, 2, 0x004e);
  entry(40, 2, 5, 3, 80);
  entry(52, 3, 2, 2, 0x0045);
  entry(64, 4, 5, 3, 104);
  view.setUint32(76, 0, true);

  const rational = (offset: number, numerator: number, denominator = 1) => {
    view.setUint32(offset, numerator, true);
    view.setUint32(offset + 4, denominator, true);
  };
  rational(80, 48); rational(88, 51); rational(96, 30);
  rational(104, 2); rational(112, 17); rational(120, 40);

  const payload = new Uint8Array(6 + tiff.byteLength);
  payload.set([0x45, 0x78, 0x69, 0x66, 0, 0]);
  payload.set(new Uint8Array(tiff), 6);
  const jpeg = new Uint8Array(2 + 4 + payload.length + 2);
  jpeg.set([0xff, 0xd8, 0xff, 0xe1, (payload.length + 2) >> 8, (payload.length + 2) & 0xff]);
  jpeg.set(payload, 6);
  jpeg.set([0xff, 0xd9], 6 + payload.length);
  return jpeg.buffer;
}

describe('photo EXIF location', () => {
  test('extracts GPS coordinates and marks them as photo metadata', async () => {
    const module = await loadImageUtils();
    expect(module).not.toBeNull();
    if (!module) return;

    const location = module.parseExifLocation(makeExifJpeg(), 1_720_000_000_000);

    expect(location).toMatchObject({
      source: 'exif',
      approximate: false,
      capturedAt: 1_720_000_000_000,
    });
    expect(location?.lat).toBeCloseTo(48.858333, 5);
    expect(location?.lng).toBeCloseTo(2.294444, 5);
  });

  test('returns undefined when a photo has no EXIF GPS block', async () => {
    const module = await loadImageUtils();
    expect(module).not.toBeNull();
    if (!module) return;

    expect(module.parseExifLocation(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]).buffer, 123)).toBeUndefined();
  });
});
