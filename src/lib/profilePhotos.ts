import type * as ImagePicker from 'expo-image-picker';

import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export const PROFILE_PHOTO_BUCKET = 'profile-pictures';
export const MAX_PROFILE_PHOTO_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);

type ProfilePhotoMetadata = Pick<
  ImagePicker.ImagePickerAsset,
  'fileSize' | 'mimeType'
>;

export function validateProfilePhoto(
  asset: ProfilePhotoMetadata,
): string | null {
  if (!asset.mimeType || !ALLOWED_MIME_TYPES.has(asset.mimeType)) {
    return 'Please choose a JPEG or PNG image.';
  }

  if (
    typeof asset.fileSize === 'number' &&
    asset.fileSize > MAX_PROFILE_PHOTO_BYTES
  ) {
    return 'Profile photos must be 5 MB or smaller.';
  }

  return null;
}

export function buildProfilePhotoPath(
  patientId: string,
  mimeType: string,
  timestamp = Date.now(),
  randomSuffix = Math.random().toString(36).slice(2, 10),
): string {
  const extension = mimeType === 'image/png' ? 'png' : 'jpg';
  const safePatientId = patientId.replaceAll('/', '-');
  return `${safePatientId}/${timestamp}-${randomSuffix}.${extension}`;
}

export function getProfilePhotoStoragePath(
  patientId: string,
  publicUrl: string,
): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = `/storage/v1/object/public/${PROFILE_PHOTO_BUCKET}/`;
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) {
      return null;
    }

    const encodedPath = url.pathname.slice(markerIndex + marker.length);
    const pathParts = encodedPath.split('/').map(decodeURIComponent);
    const safePatientId = patientId.replaceAll('/', '-');
    if (
      pathParts.length < 2 ||
      pathParts[0] !== safePatientId ||
      pathParts.some(
        (part) =>
          !part ||
          part === '.' ||
          part === '..' ||
          part.includes('/') ||
          part.includes('\\'),
      ) ||
      !/\.(?:jpe?g|png)$/i.test(pathParts[pathParts.length - 1] ?? '')
    ) {
      return null;
    }

    return pathParts.join('/');
  } catch {
    return null;
  }
}

export async function uploadProfilePhoto(
  patientId: string,
  asset: ImagePicker.ImagePickerAsset,
): Promise<string> {
  const validationMessage = validateProfilePhoto(asset);
  if (validationMessage) {
    throw new Error(validationMessage);
  }

  await ensureSecureReportSession();

  const mimeType = asset.mimeType as 'image/jpeg' | 'image/png';
  const path = buildProfilePhotoPath(patientId, mimeType);
  const response = await fetch(asset.uri);
  if (!response.ok) {
    throw new Error('Unable to read the selected profile photo.');
  }

  const imageData = await response.arrayBuffer();
  const { error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .upload(path, imageData, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw error;
  }

  return supabase.storage.from(PROFILE_PHOTO_BUCKET).getPublicUrl(path).data
    .publicUrl;
}

export async function deleteProfilePhoto(
  patientId: string,
  publicUrl: string,
): Promise<void> {
  const path = getProfilePhotoStoragePath(patientId, publicUrl);
  if (!path) {
    throw new Error('Unable to locate the stored profile photo.');
  }

  await ensureSecureReportSession();
  const { error } = await supabase.storage
    .from(PROFILE_PHOTO_BUCKET)
    .remove([path]);

  if (error) {
    throw error;
  }
}
