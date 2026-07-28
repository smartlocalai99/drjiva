import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getDefaultAddress,
  parseStoredAddresses,
  type SavedAddress,
} from './addresses';
import { updatePatientAddress } from './patients';

const ADDRESS_KEY_PREFIX = 'drjiva.addresses.v1';

export function getAddressStorageKey(phone: string): string {
  const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
  return `${ADDRESS_KEY_PREFIX}.${normalizedPhone}`;
}

export async function loadAddresses(phone: string): Promise<SavedAddress[]> {
  const value = await AsyncStorage.getItem(getAddressStorageKey(phone));
  return parseStoredAddresses(value);
}

export async function saveAddresses(
  phone: string,
  addresses: SavedAddress[],
): Promise<void> {
  await AsyncStorage.setItem(
    getAddressStorageKey(phone),
    JSON.stringify(addresses),
  );
  const defaultAddress = getDefaultAddress(addresses);
  await updatePatientAddress(
    phone,
    defaultAddress
      ? [
          defaultAddress.building,
          defaultAddress.area,
          defaultAddress.landmark,
          defaultAddress.city,
          defaultAddress.state,
          defaultAddress.pinCode,
        ]
          .filter(Boolean)
          .join(', ')
      : null,
  );
}
