export interface PercentCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type CropHandle = 'move' | 'tl' | 'tr' | 'bl' | 'br';
export const DEFAULT_CROP: PercentCrop = { x: 5, y: 10, width: 90, height: 80 };

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(maximum, Math.max(minimum, value))
);

export function updateCrop(
  crop: PercentCrop,
  handle: CropHandle,
  deltaX: number,
  deltaY: number,
  minimumSize = 15,
): PercentCrop {
  const left = crop.x;
  const top = crop.y;
  const right = crop.x + crop.width;
  const bottom = crop.y + crop.height;

  if (handle === 'move') {
    return {
      ...crop,
      x: clamp(left + deltaX, 0, 100 - crop.width),
      y: clamp(top + deltaY, 0, 100 - crop.height),
    };
  }

  const nextLeft = handle === 'tl' || handle === 'bl'
    ? clamp(left + deltaX, 0, right - minimumSize)
    : left;
  const nextRight = handle === 'tr' || handle === 'br'
    ? clamp(right + deltaX, left + minimumSize, 100)
    : right;
  const nextTop = handle === 'tl' || handle === 'tr'
    ? clamp(top + deltaY, 0, bottom - minimumSize)
    : top;
  const nextBottom = handle === 'bl' || handle === 'br'
    ? clamp(bottom + deltaY, top + minimumSize, 100)
    : bottom;

  return {
    x: nextLeft,
    y: nextTop,
    width: nextRight - nextLeft,
    height: nextBottom - nextTop,
  };
}

export function cropToPixels(crop: PercentCrop, naturalWidth: number, naturalHeight: number) {
  return {
    x: Math.round(crop.x / 100 * naturalWidth),
    y: Math.round(crop.y / 100 * naturalHeight),
    width: Math.round(crop.width / 100 * naturalWidth),
    height: Math.round(crop.height / 100 * naturalHeight),
  };
}
