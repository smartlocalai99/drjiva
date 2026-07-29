import { compressPageIfNeeded } from './documentImageCompression';
import { isNativeModuleAvailable } from './nativeModuleAvailability';

// Loaded lazily (not at module scope) so importing this file can't crash
// app boot when the native module hasn't been compiled into the installed
// binary yet — see nativeModuleAvailability.ts for why the availability
// check has to happen before ever calling require('expo-image-manipulator'),
// not just around it.
function loadImageManipulatorModule(): typeof import('expo-image-manipulator') | null {
  if (!isNativeModuleAvailable('ExpoImageManipulator')) {
    return null;
  }
  try {
    return require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  } catch {
    return null;
  }
}

async function compressWithManipulator(
  module: typeof import('expo-image-manipulator'),
  base64: string,
  { maxDimension, quality }: { maxDimension: number; quality: number },
): Promise<string> {
  const { ImageManipulator, SaveFormat } = module;
  const source = `data:image/jpeg;base64,${base64}`;
  const original = await ImageManipulator.manipulate(source).renderAsync();
  const longerEdge = Math.max(original.width, original.height);

  const target =
    longerEdge > maxDimension
      ? await ImageManipulator.manipulate(source)
          .resize(
            original.width >= original.height
              ? { width: maxDimension }
              : { height: maxDimension },
          )
          .renderAsync()
      : original;

  const result = await target.saveAsync({
    base64: true,
    compress: quality,
    format: SaveFormat.JPEG,
  });

  return result.base64 ?? base64;
}

export function compressScannedPage(base64: string): Promise<string> {
  const module = loadImageManipulatorModule();
  if (!module) {
    return Promise.resolve(base64);
  }

  return compressPageIfNeeded(base64, (page, options) =>
    compressWithManipulator(module, page, options),
  );
}
