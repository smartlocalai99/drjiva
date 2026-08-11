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
  resolveProfilePhotoMimeType,
  saveProfilePhotoReliably,
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

  it('recovers a missing Android MIME type from the selected file path', () => {
    expect(
      resolveProfilePhotoMimeType({
        fileName: null,
        fileSize: 1200,
        mimeType: undefined,
        uri: 'file:///cache/cropped-profile.JPG',
      }),
    ).toBe('image/jpeg');
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

  it('automatically retries a temporary photo upload failure', async () => {
    const upload = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('temporary network error'))
      .mockResolvedValue('https://example.test/photo.jpg');
    const persist = vi.fn(async (url: string) => url);
    const wait = vi.fn(async () => undefined);

    await expect(
      saveProfilePhotoReliably(
        {
          discard: vi.fn(async () => undefined),
          persist,
          upload,
          verify: vi.fn(async () => null),
        },
        { retryDelaysMs: [10], wait },
      ),
    ).resolves.toBe('https://example.test/photo.jpg');

    expect(upload).toHaveBeenCalledTimes(2);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(wait).toHaveBeenCalledWith(10);
  });

  it('accepts a verified save when the database response was interrupted', async () => {
    const uploadedUrl = 'https://example.test/photo.jpg';
    const upload = vi.fn(async () => uploadedUrl);
    const discard = vi.fn(async () => undefined);

    await expect(
      saveProfilePhotoReliably({
        discard,
        persist: vi.fn(async () => {
          throw new Error('response interrupted');
        }),
        upload,
        verify: vi.fn(async () => uploadedUrl),
      }),
    ).resolves.toBe(uploadedUrl);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(discard).not.toHaveBeenCalled();
  });

  it('discards an unreferenced upload before retrying the save', async () => {
    const firstUrl = 'https://example.test/first.jpg';
    const secondUrl = 'https://example.test/second.jpg';
    const discard = vi.fn(async () => undefined);
    const persist = vi
      .fn<(url: string) => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockImplementation(async (url) => url);

    await expect(
      saveProfilePhotoReliably(
        {
          discard,
          persist,
          upload: vi
            .fn<() => Promise<string>>()
            .mockResolvedValueOnce(firstUrl)
            .mockResolvedValueOnce(secondUrl),
          verify: vi.fn(async () => 'https://example.test/old.jpg'),
        },
        { retryDelaysMs: [10], wait: async () => undefined },
      ),
    ).resolves.toBe(secondUrl);

    expect(discard).toHaveBeenCalledWith(firstUrl);
  });
});
