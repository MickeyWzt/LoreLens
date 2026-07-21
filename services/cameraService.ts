const VIRTUAL_CAMERA_PATTERN = /\b(obs|virtual|manycam|xsplit|snap camera|ndi|droidcam|epoccam|mmhmm|unity video capture|camera hub)\b/i;
const BUILT_IN_CAMERA_PATTERN = /\b(integrated|built[ -]?in|internal|back|rear)\b/i;

const initialConstraints: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

export class PhysicalCameraUnavailableError extends Error {
  constructor() {
    super('No physical camera is available');
    this.name = 'PhysicalCameraUnavailableError';
  }
}

export const isVirtualCameraLabel = (label: string): boolean => (
  VIRTUAL_CAMERA_PATTERN.test(label.trim())
);

export const selectPreferredCamera = (
  devices: MediaDeviceInfo[],
  currentDeviceId?: string,
): MediaDeviceInfo | undefined => {
  const physicalCameras = devices.filter((device) => (
    device.kind === 'videoinput' && !isVirtualCameraLabel(device.label)
  ));

  const current = physicalCameras.find((device) => device.deviceId === currentDeviceId);
  if (current) return current;

  return physicalCameras.find((device) => BUILT_IN_CAMERA_PATTERN.test(device.label))
    ?? physicalCameras[0];
};

const stopStream = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => track.stop());
};

export const openPreferredCamera = async (mediaDevices: MediaDevices): Promise<MediaStream> => {
  const provisionalStream = await mediaDevices.getUserMedia(initialConstraints);

  if (typeof mediaDevices.enumerateDevices !== 'function') return provisionalStream;

  let devices: MediaDeviceInfo[];
  try {
    devices = await mediaDevices.enumerateDevices();
  } catch {
    return provisionalStream;
  }

  const cameras = devices.filter((device) => device.kind === 'videoinput');
  const currentDeviceId = provisionalStream.getVideoTracks()[0]?.getSettings().deviceId;
  const preferredCamera = selectPreferredCamera(cameras, currentDeviceId);

  if (!preferredCamera) {
    stopStream(provisionalStream);
    throw new PhysicalCameraUnavailableError();
  }

  if (!preferredCamera.label || preferredCamera.deviceId === currentDeviceId) {
    return provisionalStream;
  }

  stopStream(provisionalStream);
  return mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: preferredCamera.deviceId },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
};
