export type AddressLabel = 'Home' | 'Work' | 'Other';

export type AddressDraft = {
  area: string;
  building: string;
  city: string;
  customLabel: string;
  label: AddressLabel;
  landmark: string;
  phone: string;
  pinCode: string;
  recipientName: string;
  state: string;
};

export type SavedAddress = AddressDraft & {
  id: string;
  isDefault: boolean;
};

export type AddressErrors = Partial<Record<keyof AddressDraft, string>>;

const ADDRESS_LABELS: AddressLabel[] = ['Home', 'Work', 'Other'];

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function sortDefaultFirst(addresses: SavedAddress[]): SavedAddress[] {
  return [...addresses].sort(
    (left, right) => Number(right.isDefault) - Number(left.isDefault),
  );
}

function enforceSingleDefault(addresses: SavedAddress[]): SavedAddress[] {
  if (addresses.length === 0) {
    return [];
  }

  const selectedDefaultIndex = addresses.findIndex(
    (address) => address.isDefault,
  );
  const defaultIndex = selectedDefaultIndex >= 0 ? selectedDefaultIndex : 0;

  return sortDefaultFirst(
    addresses.map((address, index) => ({
      ...address,
      isDefault: index === defaultIndex,
    })),
  );
}

function isSavedAddress(value: unknown): value is SavedAddress {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const address = value as Partial<SavedAddress>;

  return (
    typeof address.id === 'string' &&
    address.id.trim().length > 0 &&
    typeof address.isDefault === 'boolean' &&
    typeof address.label === 'string' &&
    ADDRESS_LABELS.includes(address.label as AddressLabel) &&
    typeof address.customLabel === 'string' &&
    typeof address.recipientName === 'string' &&
    typeof address.phone === 'string' &&
    typeof address.building === 'string' &&
    typeof address.area === 'string' &&
    typeof address.landmark === 'string' &&
    typeof address.city === 'string' &&
    typeof address.state === 'string' &&
    typeof address.pinCode === 'string'
  );
}

export function validateAddress(draft: AddressDraft): AddressErrors {
  const errors: AddressErrors = {};

  if (!draft.recipientName.trim()) {
    errors.recipientName = 'Enter recipient name';
  }
  if (digits(draft.phone).slice(-10).length !== 10) {
    errors.phone = 'Enter a valid 10-digit phone number';
  }
  if (!draft.building.trim()) {
    errors.building = 'Enter house, flat, or building';
  }
  if (!draft.area.trim()) {
    errors.area = 'Enter street or area';
  }
  if (!draft.city.trim()) {
    errors.city = 'Enter city';
  }
  if (!draft.state.trim()) {
    errors.state = 'Enter state';
  }
  if (digits(draft.pinCode).length !== 6) {
    errors.pinCode = 'Enter a valid 6-digit PIN code';
  }
  if (draft.label === 'Other' && !draft.customLabel.trim()) {
    errors.customLabel = 'Enter an address label';
  }

  return errors;
}

export function normalizeAddress(
  draft: AddressDraft,
  id: string,
): SavedAddress {
  return {
    area: draft.area.trim(),
    building: draft.building.trim(),
    city: draft.city.trim(),
    customLabel: draft.customLabel.trim(),
    id,
    isDefault: false,
    label: draft.label,
    landmark: draft.landmark.trim(),
    phone: digits(draft.phone).slice(-10),
    pinCode: digits(draft.pinCode),
    recipientName: draft.recipientName.trim(),
    state: draft.state.trim(),
  };
}

export function upsertAddress(
  addresses: SavedAddress[],
  next: SavedAddress,
): SavedAddress[] {
  const existing = addresses.find((address) => address.id === next.id);
  const updated = existing
    ? addresses.map((address) =>
        address.id === next.id
          ? { ...next, isDefault: address.isDefault }
          : address,
      )
    : [...addresses, { ...next, isDefault: addresses.length === 0 }];

  return enforceSingleDefault(updated);
}

export function removeAddress(
  addresses: SavedAddress[],
  id: string,
): SavedAddress[] {
  if (!addresses.some((address) => address.id === id)) {
    return addresses;
  }

  return enforceSingleDefault(
    addresses.filter((address) => address.id !== id),
  );
}

export function setDefaultAddress(
  addresses: SavedAddress[],
  id: string,
): SavedAddress[] {
  if (!addresses.some((address) => address.id === id)) {
    return addresses;
  }

  return sortDefaultFirst(
    addresses.map((address) => ({
      ...address,
      isDefault: address.id === id,
    })),
  );
}

export function parseStoredAddresses(value: string | null): SavedAddress[] {
  if (!value) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || !parsed.every(isSavedAddress)) {
      return [];
    }

    return enforceSingleDefault(parsed);
  } catch {
    return [];
  }
}
