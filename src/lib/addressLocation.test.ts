import { describe, expect, it } from 'vitest';

import {
  mapGeocodedAddressToFields,
  resolveCurrentAddressFields,
  type AddressLocationAdapter,
  type GeocodedAddress,
} from './addressLocation';

function geocodedAddress(overrides: Partial<GeocodedAddress> = {}): GeocodedAddress {
  return {
    city: 'Hyderabad',
    district: null,
    name: 'Lotus Heights',
    postalCode: '500001',
    region: 'Telangana',
    street: 'Road No. 12',
    streetNumber: '302',
    subregion: null,
    ...overrides,
  };
}

describe('mapGeocodedAddressToFields', () => {
  it('maps the house and building separately from the street', () => {
    expect(mapGeocodedAddressToFields(geocodedAddress())).toEqual({
      area: 'Road No. 12',
      building: '302, Lotus Heights',
      city: 'Hyderabad',
      pinCode: '500001',
      state: 'Telangana',
    });
  });

  it('falls back to the placemark name when no street is available', () => {
    const result = mapGeocodedAddressToFields(
      geocodedAddress({ street: null, streetNumber: null }),
    );
    expect(result.area).toBe('Lotus Heights');
    expect(result.building).toBe('Lotus Heights');
  });

  it('does not repeat the street name in the building field', () => {
    const result = mapGeocodedAddressToFields(
      geocodedAddress({ name: '302 Road No. 12' }),
    );
    expect(result.building).toBe('302');
    expect(result.area).toBe('Road No. 12');
  });

  it('falls back through district then subregion when city is missing', () => {
    expect(
      mapGeocodedAddressToFields(
        geocodedAddress({ city: null, district: 'Serilingampally' }),
      ).city,
    ).toBe('Serilingampally');
    expect(
      mapGeocodedAddressToFields(
        geocodedAddress({ city: null, district: null, subregion: 'Ranga Reddy' }),
      ).city,
    ).toBe('Ranga Reddy');
  });

  it('returns empty strings for fields with no data at all', () => {
    expect(
      mapGeocodedAddressToFields({
        city: null,
        district: null,
        name: null,
        postalCode: null,
        region: null,
        street: null,
        streetNumber: null,
        subregion: null,
      }),
    ).toEqual({ area: '', building: '', city: '', pinCode: '', state: '' });
  });
});

describe('resolveCurrentAddressFields', () => {
  it('returns permission-denied without calling location APIs', async () => {
    const getCurrentPosition = () => Promise.reject(new Error('should not be called'));
    const adapter: AddressLocationAdapter = {
      getCurrentPosition,
      requestPermission: async () => 'denied',
      reverseGeocode: async () => [geocodedAddress()],
    };

    await expect(resolveCurrentAddressFields(adapter)).resolves.toEqual({
      status: 'permission-denied',
    });
  });

  it('returns unavailable when reverse geocoding finds nothing', async () => {
    const adapter: AddressLocationAdapter = {
      getCurrentPosition: async () => ({ latitude: 17.4, longitude: 78.4 }),
      requestPermission: async () => 'granted',
      reverseGeocode: async () => [],
    };

    await expect(resolveCurrentAddressFields(adapter)).resolves.toEqual({
      status: 'unavailable',
    });
  });

  it('resolves address fields from the first geocoded result', async () => {
    const adapter: AddressLocationAdapter = {
      getCurrentPosition: async () => ({ latitude: 17.4, longitude: 78.4 }),
      requestPermission: async () => 'granted',
      reverseGeocode: async () => [geocodedAddress()],
    };

    await expect(resolveCurrentAddressFields(adapter)).resolves.toEqual({
      fields: {
        area: 'Road No. 12',
        building: '302, Lotus Heights',
        city: 'Hyderabad',
        pinCode: '500001',
        state: 'Telangana',
      },
      status: 'resolved',
    });
  });
});
