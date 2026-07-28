export type CameraPermissionResult = 'blocked' | 'denied' | 'granted';

type NativeCameraPermissionResult =
  | 'denied'
  | 'granted'
  | 'never_ask_again';

export type CameraPermissionAdapter = {
  request: () => Promise<NativeCameraPermissionResult>;
};

export async function requestDocumentCameraPermission(
  platform: string,
  adapter: CameraPermissionAdapter,
): Promise<CameraPermissionResult> {
  if (platform !== 'android') {
    return 'granted';
  }

  const result = await adapter.request();
  return result === 'never_ask_again' ? 'blocked' : result;
}
