import { beforeEach, describe, expect, it, vi } from 'vitest';

const remove = vi.fn(async () => ({ error: null }));

vi.mock('./supabase', () => ({
  supabase: {
    storage: {
      from: () => ({ remove }),
    },
  },
}));

vi.mock('./reportAuth', () => ({
  ensureSecureReportSession: vi.fn(async () => 'anonymous-user'),
}));

import {
  buildProfilePhotoPath,
  deleteProfilePhoto,
  getProfilePhotoStoragePath,
  validateProfilePhoto,
} from './profilePhotos';

describe('profile photos', () => {
  beforeEach(() => {
    remove.mockClear();
  });

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

  it('extracts only the matching patient object path from a public URL', () => {
    expect(
      getProfilePhotoStoragePath(
        'patient-1',
        'https://project.supabase.co/storage/v1/object/public/profile-pictures/patient-1/avatar%20one.jpg?t=1',
      ),
    ).toBe('patient-1/avatar one.jpg');
    expect(
      getProfilePhotoStoragePath(
        'patient-1',
        'https://project.supabase.co/storage/v1/object/public/profile-pictures/patient-2/avatar.jpg',
      ),
    ).toBeNull();
    expect(
      getProfilePhotoStoragePath(
        'patient-1',
        'https://example.test/not-supabase/avatar.jpg',
      ),
    ).toBeNull();
    expect(
      getProfilePhotoStoragePath(
        'patient-1',
        'https://project.supabase.co/storage/v1/object/public/profile-pictures/patient-1/..%2Fpatient-2/avatar.jpg',
      ),
    ).toBeNull();
  });

  it('permanently removes the matching object through the Storage API', async () => {
    await deleteProfilePhoto(
      'patient-1',
      'https://project.supabase.co/storage/v1/object/public/profile-pictures/patient-1/avatar.jpg',
    );

    expect(remove).toHaveBeenCalledWith(['patient-1/avatar.jpg']);
  });

  it('does not remove an object outside the patient folder', async () => {
    await expect(
      deleteProfilePhoto(
        'patient-1',
        'https://project.supabase.co/storage/v1/object/public/profile-pictures/patient-2/avatar.jpg',
      ),
    ).rejects.toThrow(/locate/);
    expect(remove).not.toHaveBeenCalled();
  });
});
