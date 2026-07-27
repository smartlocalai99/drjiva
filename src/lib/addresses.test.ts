import { describe, expect, it } from 'vitest';

import {
  normalizeAddress,
  parseStoredAddresses,
  removeAddress,
  setDefaultAddress,
  upsertAddress,
  validateAddress,
  type AddressDraft,
  type SavedAddress,
} from './addresses';

const homeDraft: AddressDraft = {
  area: 'Banjara Hills',
  building: 'Flat 302, Lotus Heights',
  city: 'Hyderabad',
  customLabel: '',
  label: 'Home',
  landmark: 'Near City Center',
  phone: '98765 43210',
  pinCode: '500034',
  recipientName: 'Vardhan Reddy',
  state: 'Telangana',
};

const workDraft: AddressDraft = {
  area: 'HITEC City',
  building: 'Smart Local AI, 4th Floor',
  city: 'Hyderabad',
  customLabel: '',
  label: 'Work',
  landmark: '',
  phone: '91234 56789',
  pinCode: '500081',
  recipientName: 'Vardhan Reddy',
  state: 'Telangana',
};

function savedAddress(
  id: string,
  draft: AddressDraft,
  isDefault: boolean,
): SavedAddress {
  return { ...normalizeAddress(draft, id), isDefault };
}

describe('validateAddress', () => {
  it('rejects missing delivery fields and invalid phone and PIN values', () => {
    const emptyDraft: AddressDraft = {
      area: ' ',
      building: '',
      city: '',
      customLabel: '',
      label: 'Home',
      landmark: '',
      phone: '12345',
      pinCode: '5000',
      recipientName: '',
      state: '',
    };

    expect(validateAddress(emptyDraft)).toEqual({
      area: 'Enter street or area',
      building: 'Enter house, flat, or building',
      city: 'Enter city',
      phone: 'Enter a valid 10-digit phone number',
      pinCode: 'Enter a valid 6-digit PIN code',
      recipientName: 'Enter recipient name',
      state: 'Enter state',
    });
  });

  it('requires a custom label when Other is selected', () => {
    expect(
      validateAddress({ ...homeDraft, customLabel: ' ', label: 'Other' }),
    ).toEqual({ customLabel: 'Enter an address label' });
  });

  it('rejects an arbitrary 11-digit phone number', () => {
    expect(validateAddress({ ...homeDraft, phone: '19876543210' })).toEqual({
      phone: 'Enter a valid 10-digit phone number',
    });
  });

  it('accepts a complete delivery address', () => {
    expect(validateAddress(homeDraft)).toEqual({});
    expect(validateAddress({ ...homeDraft, phone: '+91 98765 43210' })).toEqual(
      {},
    );
  });
});

describe('normalizeAddress', () => {
  it('trims text and stores the last ten phone digits', () => {
    expect(
      normalizeAddress(
        {
          ...homeDraft,
          area: '  Banjara Hills  ',
          phone: '+91 98765 43210',
          recipientName: '  Vardhan Reddy ',
        },
        'home-1',
      ),
    ).toMatchObject({
      area: 'Banjara Hills',
      id: 'home-1',
      phone: '9876543210',
      recipientName: 'Vardhan Reddy',
    });
  });
});

describe('address list rules', () => {
  it('makes the first address default and preserves exactly one default', () => {
    const first = normalizeAddress(homeDraft, 'home-1');
    const second = normalizeAddress(workDraft, 'work-1');

    const withFirst = upsertAddress([], first);
    const withSecond = upsertAddress(withFirst, second);

    expect(withFirst[0]?.isDefault).toBe(true);
    expect(withSecond.filter((address) => address.isDefault)).toHaveLength(1);
    expect(withSecond[0]?.id).toBe('home-1');
  });

  it('updates an address without changing its default status', () => {
    const current = savedAddress('home-1', homeDraft, true);
    const edited = normalizeAddress(
      { ...homeDraft, building: 'Flat 401' },
      'home-1',
    );

    expect(upsertAddress([current], edited)).toEqual([
      { ...edited, isDefault: true },
    ]);
  });

  it('sets one selected address as default and sorts it first', () => {
    const home = savedAddress('home-1', homeDraft, true);
    const work = savedAddress('work-1', workDraft, false);

    const result = setDefaultAddress([home, work], 'work-1');

    expect(result.map(({ id, isDefault }) => ({ id, isDefault }))).toEqual([
      { id: 'work-1', isDefault: true },
      { id: 'home-1', isDefault: false },
    ]);
  });

  it('promotes the next address when the default address is deleted', () => {
    const home = savedAddress('home-1', homeDraft, true);
    const work = savedAddress('work-1', workDraft, false);

    expect(removeAddress([home, work], 'home-1')).toEqual([
      { ...work, isDefault: true },
    ]);
  });

  it('does not change defaults when an unknown address is deleted', () => {
    const home = savedAddress('home-1', homeDraft, true);

    expect(removeAddress([home], 'missing')).toEqual([home]);
  });
});

describe('parseStoredAddresses', () => {
  it('returns an empty list for malformed persisted data', () => {
    expect(parseStoredAddresses('{bad json')).toEqual([]);
  });

  it('returns an empty list when persisted data has an invalid shape', () => {
    expect(parseStoredAddresses('{"id":"home-1"}')).toEqual([]);
    expect(parseStoredAddresses('[{"id":"home-1"}]')).toEqual([]);
  });

  it('restores valid addresses while enforcing one default', () => {
    const home = savedAddress('home-1', homeDraft, true);
    const work = savedAddress('work-1', workDraft, true);

    expect(parseStoredAddresses(JSON.stringify([home, work]))).toEqual([
      home,
      { ...work, isDefault: false },
    ]);
  });
});
