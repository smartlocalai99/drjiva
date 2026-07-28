import { describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: () => {
        throw new Error('Storage is not used by these validation tests.');
      },
    },
  },
}));

import {
  buildProfilePhotoPath,
  validateProfilePhoto,
} from './profilePhotos';

describe('profile photos', () => {
  it('accepts JPEG and PNG files up to 5 MB', () => {
    expect(
      validateProfilePhoto({
        fileSize: 5 * 1024 * 1024,
        mimeType: 'image/jpeg',
      }),
    ).toBeNull();
    expect(
      validateProfilePhoto({
        fileSize: 1200,
        mimeType: 'image/png',
      }),
    ).toBeNull();
  });

  it('rejects an image larger than 5 MB', () => {
    expect(
      validateProfilePhoto({
        fileSize: 5 * 1024 * 1024 + 1,
        mimeType: 'image/jpeg',
      }),
    ).toMatch(/5 MB/);
  });

  it('rejects an unsupported image type', () => {
    expect(
      validateProfilePhoto({
        fileSize: 1200,
        mimeType: 'image/heic',
      }),
    ).toMatch(/JPEG or PNG/);
  });

  it('builds a unique object path below the patient folder', () => {
    expect(buildProfilePhotoPath('patient-1', 'image/png', 1234, 'abc')).toBe(
      'patient-1/1234-abc.png',
    );
  });
});
