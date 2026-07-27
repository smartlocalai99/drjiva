import { beforeEach, describe, expect, it, vi } from 'vitest';

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  removeItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: asyncStorage,
}));

import {
  clearCachedPatientName,
  clearSessionPhone,
  getCachedPatientName,
  saveCachedPatientName,
} from './session';

describe('patient name cache', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.removeItem.mockReset();
    asyncStorage.setItem.mockReset();
  });

  it('stores a trimmed name under a phone-scoped key', async () => {
    await saveCachedPatientName('98765 43210', '  Vardhan Reddy  ');

    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      'drjiva.patient-name.v1.9876543210',
      'Vardhan Reddy',
    );
  });

  it('removes a cached name instead of persisting a blank value', async () => {
    await saveCachedPatientName('9876543210', '   ');

    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      'drjiva.patient-name.v1.9876543210',
    );
    expect(asyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('reads and explicitly clears the phone-scoped name', async () => {
    asyncStorage.getItem.mockResolvedValueOnce('Vardhan Reddy');

    await expect(getCachedPatientName('9876543210')).resolves.toBe(
      'Vardhan Reddy',
    );
    await clearCachedPatientName('9876543210');

    expect(asyncStorage.getItem).toHaveBeenCalledWith(
      'drjiva.patient-name.v1.9876543210',
    );
    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      'drjiva.patient-name.v1.9876543210',
    );
  });

  it('clears the current phone and its cached name on logout', async () => {
    asyncStorage.getItem.mockResolvedValueOnce('9876543210');

    await clearSessionPhone();

    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      'drjiva.session.phone',
    );
    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      'drjiva.patient-name.v1.9876543210',
    );
  });
});
