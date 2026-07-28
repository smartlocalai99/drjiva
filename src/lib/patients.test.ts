import { beforeEach, describe, expect, it, vi } from 'vitest';

const patientRow = {
  address: 'Existing saved address',
  age: 34,
  avatar_url: 'https://example.supabase.co/profile-pictures/patient-1/a.jpg',
  gender: 'Female',
  id: 'patient-1',
  mobile: '+919876543210',
  name: 'Asha Rao',
};

let updatePayload: unknown;

const maybeSingle = vi.fn(async () => ({
  data: patientRow,
  error: null,
}));
const single = vi.fn(async () => ({
  data: patientRow,
  error: null,
}));

vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle,
        }),
      }),
      update: (payload: unknown) => {
        updatePayload = payload;
        return {
          eq: () => ({
            select: () => ({
              single,
            }),
          }),
        };
      },
    }),
  },
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: vi.fn(async () => 'anonymous-user'),
}));

import { getPatientByPhone, updatePatientProfile } from './patients';

describe('patient profile photos', () => {
  beforeEach(() => {
    updatePayload = undefined;
    maybeSingle.mockClear();
    single.mockClear();
  });

  it('maps avatar_url from the patient record', async () => {
    await expect(getPatientByPhone('9876543210')).resolves.toMatchObject({
      avatarUrl:
        'https://example.supabase.co/profile-pictures/patient-1/a.jpg',
      patientId: 'patient-1',
    });
  });

  it('updates the avatar without requiring an address field', async () => {
    await updatePatientProfile('9876543210', {
      address: 'Existing saved address',
      age: 34,
      avatar_url:
        'https://example.supabase.co/profile-pictures/patient-1/new.jpg',
      gender: 'female',
      name: 'Asha Rao',
    });

    expect(updatePayload).toEqual({
      address: 'Existing saved address',
      age: 34,
      avatar_url:
        'https://example.supabase.co/profile-pictures/patient-1/new.jpg',
      gender: 'female',
      name: 'Asha Rao',
    });
  });
});
