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
  clearCachedAvatarUrl,
  clearCachedPatientName,
  clearSessionPhone,
  getCachedAvatarUrl,
  getCachedPatientName,
  hasAcceptedTerms,
  saveCachedAvatarUrl,
  saveCachedPatientName,
  saveTermsAccepted,
  subscribeCachedAvatarUrl,
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
    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      'drjiva.patient-avatar.v1.9876543210',
    );
  });
});

describe('patient avatar cache', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.removeItem.mockReset();
    asyncStorage.setItem.mockReset();
  });

  it('stores the avatar url under a phone-scoped key', async () => {
    await saveCachedAvatarUrl('98765 43210', 'https://example.test/a.jpg');

    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      'drjiva.patient-avatar.v1.9876543210',
      'https://example.test/a.jpg',
    );
  });

  it('removes the cached avatar instead of persisting a null value', async () => {
    await saveCachedAvatarUrl('9876543210', null);

    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      'drjiva.patient-avatar.v1.9876543210',
    );
    expect(asyncStorage.setItem).not.toHaveBeenCalled();
  });

  it('reads and explicitly clears the phone-scoped avatar', async () => {
    asyncStorage.getItem.mockResolvedValueOnce('https://example.test/a.jpg');

    await expect(getCachedAvatarUrl('9876543210')).resolves.toBe(
      'https://example.test/a.jpg',
    );
    await clearCachedAvatarUrl('9876543210');

    expect(asyncStorage.getItem).toHaveBeenCalledWith(
      'drjiva.patient-avatar.v1.9876543210',
    );
    expect(asyncStorage.removeItem).toHaveBeenCalledWith(
      'drjiva.patient-avatar.v1.9876543210',
    );
  });

  it('notifies mounted screens immediately when the avatar changes', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCachedAvatarUrl('98765 43210', listener);

    await saveCachedAvatarUrl(
      '9876543210',
      'https://example.test/new.jpg',
    );
    await clearCachedAvatarUrl('9876543210');

    expect(listener).toHaveBeenNthCalledWith(
      1,
      'https://example.test/new.jpg',
    );
    expect(listener).toHaveBeenNthCalledWith(2, null);

    unsubscribe();
    await saveCachedAvatarUrl(
      '9876543210',
      'https://example.test/ignored.jpg',
    );
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('terms acceptance', () => {
  beforeEach(() => {
    asyncStorage.getItem.mockReset();
    asyncStorage.setItem.mockReset();
  });

  it('defaults to not accepted when nothing has been stored yet', async () => {
    asyncStorage.getItem.mockResolvedValueOnce(null);

    await expect(hasAcceptedTerms()).resolves.toBe(false);
  });

  it('reports accepted once saved', async () => {
    asyncStorage.getItem.mockResolvedValueOnce('true');

    await expect(hasAcceptedTerms()).resolves.toBe(true);
  });

  it('persists acceptance under a stable key', async () => {
    await saveTermsAccepted();

    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      'drjiva.terms-accepted.v1',
      'true',
    );
  });
});
