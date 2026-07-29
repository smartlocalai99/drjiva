import {
  resolveCurrentAddressFields,
  type AddressLocationAdapter,
  type AddressLocationResult,
} from './addressLocation';

// Required lazily (not at module scope) so that simply importing this file
// doesn't crash the app when the native expo-location module hasn't been
// compiled into the installed binary yet (e.g. after a JS-only reload
// following a native dependency add, before the next native rebuild).
// expo-router eagerly loads every route file to build its route table, so a
// top-level `import` here would take down the whole app, not just this
// screen.
function loadNativeLocationModule(): typeof import('expo-location') | null {
  try {
    return require('expo-location') as typeof import('expo-location');
  } catch {
    return null;
  }
}

function buildAdapter(
  Location: typeof import('expo-location'),
): AddressLocationAdapter {
  return {
    async getCurrentPosition() {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
    },
    async requestPermission() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted' ? 'granted' : 'denied';
    },
    async reverseGeocode(coords) {
      return Location.reverseGeocodeAsync(coords);
    },
  };
}

export async function fetchCurrentLocationAddress(): Promise<AddressLocationResult> {
  const Location = loadNativeLocationModule();
  if (!Location) {
    return { status: 'unsupported' };
  }

  return resolveCurrentAddressFields(buildAdapter(Location));
}
