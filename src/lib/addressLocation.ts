export type GeocodedAddress = {
  city: string | null;
  district: string | null;
  name: string | null;
  postalCode: string | null;
  region: string | null;
  street: string | null;
  streetNumber: string | null;
  subregion: string | null;
};

export type AddressLocationFields = {
  area: string;
  city: string;
  pinCode: string;
  state: string;
};

export type AddressLocationAdapter = {
  getCurrentPosition: () => Promise<{ latitude: number; longitude: number }>;
  requestPermission: () => Promise<'denied' | 'granted'>;
  reverseGeocode: (coords: {
    latitude: number;
    longitude: number;
  }) => Promise<GeocodedAddress[]>;
};

export type AddressLocationResult =
  | { fields: AddressLocationFields; status: 'resolved' }
  | { status: 'permission-denied' }
  | { status: 'unavailable' }
  | { status: 'unsupported' };

export function mapGeocodedAddressToFields(
  address: GeocodedAddress,
): AddressLocationFields {
  const streetLine = [address.streetNumber, address.street]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ');

  return {
    area: streetLine || address.name?.trim() || '',
    city: address.city?.trim() || address.district?.trim() || address.subregion?.trim() || '',
    pinCode: address.postalCode?.trim() || '',
    state: address.region?.trim() || '',
  };
}

export async function resolveCurrentAddressFields(
  adapter: AddressLocationAdapter,
): Promise<AddressLocationResult> {
  const permission = await adapter.requestPermission();
  if (permission !== 'granted') {
    return { status: 'permission-denied' };
  }

  const position = await adapter.getCurrentPosition();
  const results = await adapter.reverseGeocode(position);
  const address = results[0];
  if (!address) {
    return { status: 'unavailable' };
  }

  return { fields: mapGeocodedAddressToFields(address), status: 'resolved' };
}
