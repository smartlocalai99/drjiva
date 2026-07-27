import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

import {
  getAddressStorageKey,
  loadAddresses,
  saveAddresses,
} from './addressStorage';
import { normalizeAddress, type AddressDraft } from './addresses';

const draft: AddressDraft = {
  area: 'Banjara Hills',
  building: 'Flat 302',
  city: 'Hyderabad',
  customLabel: '',
  label: 'Home',
  landmark: '',
  phone: '9876543210',
  pinCode: '500034',
  recipientName: 'Vardhan Reddy',
  state: 'Telangana',
};

describe('addressStorage', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.setItem.mockReset();
  });

  it('scopes persisted addresses to the normalized phone number', () => {
    expect(getAddressStorageKey('(987) 654-3210')).toBe(
      'drjiva.addresses.v1.9876543210',
    );
  });

  it('loads valid persisted addresses', async () => {
    const address = {
      ...normalizeAddress(draft, 'home-1'),
      isDefault: true,
    };
    asyncStorage.getItem.mockResolvedValue(JSON.stringify([address]));

    await expect(loadAddresses('9876543210')).resolves.toEqual([address]);
    expect(asyncStorage.getItem).toHaveBeenCalledWith(
      'drjiva.addresses.v1.9876543210',
    );
  });

  it('turns malformed persisted data into an empty address list', async () => {
    asyncStorage.getItem.mockResolvedValue('{bad json');

    await expect(loadAddresses('9876543210')).resolves.toEqual([]);
  });

  it('writes the address list to the phone-scoped key', async () => {
    const address = {
      ...normalizeAddress(draft, 'home-1'),
      isDefault: true,
    };

    await saveAddresses('9876543210', [address]);

    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      'drjiva.addresses.v1.9876543210',
      JSON.stringify([address]),
    );
  });
});
