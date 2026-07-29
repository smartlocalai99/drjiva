import * as Location from 'expo-location';

import {
  resolveCurrentAddressFields,
  type AddressLocationAdapter,
  type AddressLocationResult,
} from './addressLocation';

const nativeLocationAdapter: AddressLocationAdapter = {
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

export function fetchCurrentLocationAddress(): Promise<AddressLocationResult> {
  return resolveCurrentAddressFields(nativeLocationAdapter);
}
