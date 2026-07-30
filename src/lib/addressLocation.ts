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
  building: string;
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
  const clean = (value: string | null): string => value?.trim() || '';
  const city = clean(address.city);
  const district = clean(address.district);
  const name = clean(address.name);
  const street = clean(address.street);
  const streetNumber = clean(address.streetNumber);
  const normalizedStreet = street.toLocaleLowerCase();
  const normalizedName = name.toLocaleLowerCase();
  const nameDescribesStreet =
    Boolean(normalizedStreet) && normalizedName.includes(normalizedStreet);
  const buildingName =
    name &&
    !nameDescribesStreet &&
    ![city, district, clean(address.subregion)].some(
      (part) => part && part.toLocaleLowerCase() === normalizedName,
    )
      ? name
      : '';
  const building = Array.from(
    new Set([streetNumber, buildingName].filter(Boolean)),
  ).join(', ');

  return {
    area: street || district || name,
    building,
    city: city || district || clean(address.subregion),
    pinCode: clean(address.postalCode),
    state: clean(address.region),
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
