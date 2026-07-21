import { describe, expect, test, vi } from 'vitest';
import {
  PhysicalCameraUnavailableError,
  openPreferredCamera,
  selectPreferredCamera,
} from '../services/cameraService';

const device = (deviceId: string, label: string): MediaDeviceInfo => ({
  deviceId,
  groupId: 'camera-group',
  kind: 'videoinput',
  label,
  toJSON: () => ({}),
});

const stream = (deviceId: string) => {
  const stop = vi.fn();
  const track = {
    getSettings: () => ({ deviceId }),
    stop,
  } as unknown as MediaStreamTrack;

  return {
    stream: {
      getTracks: () => [track],
      getVideoTracks: () => [track],
    } as unknown as MediaStream,
    stop,
  };
};

describe('physical camera selection', () => {
  test('prefers the integrated camera and excludes OBS Virtual Camera', () => {
    const selected = selectPreferredCamera([
      device('obs', 'OBS Virtual Camera'),
      device('integrated', 'Integrated Camera'),
    ]);

    expect(selected?.deviceId).toBe('integrated');
  });

  test('keeps the currently selected physical back camera on mobile', () => {
    const selected = selectPreferredCamera([
      device('front', 'Front Camera'),
      device('back', 'Back Camera'),
    ], 'back');

    expect(selected?.deviceId).toBe('back');
  });

  test('reopens the physical camera when the provisional stream is virtual', async () => {
    const provisional = stream('obs');
    const physical = stream('integrated');
    const getUserMedia = vi.fn()
      .mockResolvedValueOnce(provisional.stream)
      .mockResolvedValueOnce(physical.stream);
    const mediaDevices = {
      getUserMedia,
      enumerateDevices: vi.fn().mockResolvedValue([
        device('obs', 'OBS Virtual Camera'),
        device('integrated', 'Integrated Camera'),
      ]),
    } as unknown as MediaDevices;

    const result = await openPreferredCamera(mediaDevices);

    expect(result).toBe(physical.stream);
    expect(provisional.stop).toHaveBeenCalledOnce();
    expect(getUserMedia).toHaveBeenLastCalledWith(expect.objectContaining({
      video: expect.objectContaining({ deviceId: { exact: 'integrated' } }),
    }));
  });

  test('rejects a virtual-only camera list instead of showing OBS', async () => {
    const provisional = stream('obs');
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(provisional.stream),
      enumerateDevices: vi.fn().mockResolvedValue([device('obs', 'OBS Virtual Camera')]),
    } as unknown as MediaDevices;

    await expect(openPreferredCamera(mediaDevices)).rejects.toBeInstanceOf(PhysicalCameraUnavailableError);
    expect(provisional.stop).toHaveBeenCalledOnce();
  });
});
