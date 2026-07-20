import type { LocationSnapshot } from '../domain/model';
import { extractExifLocation } from '../utils/image';
import { addLocationLabel } from './locationService';

interface ResolvePhotoLocationOptions {
  kind: 'camera' | 'upload';
  language: string;
  locationEnabled: boolean;
  file?: File;
  getDeviceLocation: () => Promise<LocationSnapshot>;
  readExifLocation?: (file: File) => Promise<LocationSnapshot | undefined>;
  labelLocation?: (location: LocationSnapshot, language: string) => Promise<LocationSnapshot>;
  now?: () => number;
}

export function unavailablePhotoLocation(now = Date.now): LocationSnapshot {
  return { source: 'none', approximate: true, capturedAt: now() };
}

export async function resolvePhotoLocation({
  kind,
  language,
  locationEnabled,
  file,
  getDeviceLocation,
  readExifLocation = extractExifLocation,
  labelLocation = addLocationLabel,
  now = Date.now,
}: ResolvePhotoLocationOptions): Promise<LocationSnapshot> {
  if (!locationEnabled) return unavailablePhotoLocation(now);
  if (kind === 'camera') return getDeviceLocation();
  if (!file) return unavailablePhotoLocation(now);

  const exifLocation = await readExifLocation(file);
  if (!exifLocation) return unavailablePhotoLocation(now);
  return labelLocation(exifLocation, language);
}
