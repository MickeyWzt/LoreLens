import type { LocationSnapshot } from '../domain/model';

function readExifText(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  count: number,
  littleEndian: boolean,
): string | undefined {
  const valueOffset = count <= 4
    ? entryOffset + 8
    : tiffStart + view.getUint32(entryOffset + 8, littleEndian);
  if (valueOffset < 0 || valueOffset + count > view.byteLength) return undefined;
  return String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + valueOffset, count))
    .replace(/\0/g, '')
    .trim();
}

function readExifRationals(
  view: DataView,
  tiffStart: number,
  entryOffset: number,
  count: number,
  littleEndian: boolean,
): number[] | undefined {
  const valueOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
  if (valueOffset < 0 || valueOffset + count * 8 > view.byteLength) return undefined;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const offset = valueOffset + index * 8;
    const numerator = view.getUint32(offset, littleEndian);
    const denominator = view.getUint32(offset + 4, littleEndian);
    if (denominator === 0) return undefined;
    values.push(numerator / denominator);
  }
  return values;
}

function decimalDegrees(values?: number[], reference?: string): number | undefined {
  if (!values || values.length < 3 || !reference) return undefined;
  const degrees = values[0] + values[1] / 60 + values[2] / 3600;
  return reference === 'S' || reference === 'W' ? -degrees : degrees;
}

function parseTiffGps(
  view: DataView,
  tiffStart: number,
  fallbackCapturedAt: number,
): LocationSnapshot | undefined {
  if (tiffStart + 8 > view.byteLength) return undefined;
  const byteOrder = view.getUint16(tiffStart, false);
  const littleEndian = byteOrder === 0x4949;
  if (!littleEndian && byteOrder !== 0x4d4d) return undefined;
  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return undefined;
  const ifdOffset = tiffStart + view.getUint32(tiffStart + 4, littleEndian);
  if (ifdOffset + 2 > view.byteLength) return undefined;
  const entryCount = view.getUint16(ifdOffset, littleEndian);
  let gpsOffset: number | undefined;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) return undefined;
    if (view.getUint16(entryOffset, littleEndian) === 0x8825) {
      gpsOffset = tiffStart + view.getUint32(entryOffset + 8, littleEndian);
      break;
    }
  }
  if (gpsOffset === undefined || gpsOffset + 2 > view.byteLength) return undefined;

  const gpsEntries = view.getUint16(gpsOffset, littleEndian);
  let latRef: string | undefined;
  let lngRef: string | undefined;
  let latitude: number[] | undefined;
  let longitude: number[] | undefined;
  for (let index = 0; index < gpsEntries; index += 1) {
    const entryOffset = gpsOffset + 2 + index * 12;
    if (entryOffset + 12 > view.byteLength) return undefined;
    const tag = view.getUint16(entryOffset, littleEndian);
    const type = view.getUint16(entryOffset + 2, littleEndian);
    const count = view.getUint32(entryOffset + 4, littleEndian);
    if (tag === 1 && type === 2) latRef = readExifText(view, tiffStart, entryOffset, count, littleEndian);
    if (tag === 2 && type === 5) latitude = readExifRationals(view, tiffStart, entryOffset, count, littleEndian);
    if (tag === 3 && type === 2) lngRef = readExifText(view, tiffStart, entryOffset, count, littleEndian);
    if (tag === 4 && type === 5) longitude = readExifRationals(view, tiffStart, entryOffset, count, littleEndian);
  }
  const lat = decimalDegrees(latitude, latRef);
  const lng = decimalDegrees(longitude, lngRef);
  if (lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) return undefined;
  return {
    lat,
    lng,
    source: 'exif',
    approximate: false,
    capturedAt: fallbackCapturedAt,
  };
}

export function parseExifLocation(
  buffer: ArrayBuffer,
  fallbackCapturedAt = Date.now(),
): LocationSnapshot | undefined {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return undefined;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return undefined;
    const marker = view.getUint8(offset + 1);
    if (marker === 0xd9 || marker === 0xda) return undefined;
    const segmentLength = view.getUint16(offset + 2, false);
    if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) return undefined;
    const payload = offset + 4;
    if (
      marker === 0xe1
      && segmentLength >= 8
      && view.getUint32(payload, false) === 0x45786966
      && view.getUint16(payload + 4, false) === 0
    ) {
      return parseTiffGps(view, payload + 6, fallbackCapturedAt);
    }
    offset += 2 + segmentLength;
  }
  return undefined;
}

export async function extractExifLocation(file: File): Promise<LocationSnapshot | undefined> {
  try {
    return parseExifLocation(await file.arrayBuffer(), file.lastModified || Date.now());
  } catch {
    return undefined;
  }
}

export async function normalizeImageFile(file: File, maxDimension = 2560): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Unsupported image type');

  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable');
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.9);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Could not decode the image'));
      image.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext('2d');
        if (!context) return reject(new Error('Image processing is unavailable'));
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
