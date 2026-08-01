import type { MedicineCatalogueItem } from './medicineCourses';

const BUCKET = 'patient-medicine-images';

export type CustomMedicineHospital =
  | { customHospitalId: string; hospitalId?: never }
  | { customHospitalId?: never; hospitalId: string };

export function normalizeCustomMedicineName(value: string): string {
  return value.trim().toLocaleLowerCase('en-IN').replace(/\s+/g, ' ');
}

function uuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildCustomMedicinePath(
  ownerUserId: string,
  _filename: string,
): string {
  return `${ownerUserId}/${uuid()}.jpg`;
}

async function signedImageUrl(path: string): Promise<string> {
  const { supabase } = await import('./supabase');
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60 * 24 * 7);
  if (error || !data?.signedUrl) {
    throw error ?? new Error('Unable to load tablet image.');
  }
  return data.signedUrl;
}

export async function getCustomMedicineImageUrl(path: string): Promise<string> {
  return signedImageUrl(path);
}

export async function loadCustomMedicines(
  patientId: string,
  hospital: CustomMedicineHospital,
): Promise<MedicineCatalogueItem[]> {
  const [{ ensureSecureReportSession }, { supabase }] = await Promise.all([
    import('./reportAuth'),
    import('./supabase'),
  ]);
  await ensureSecureReportSession();
  let request = supabase
    .from('patient_custom_medicines')
    .select('id, name, image_path, hospital_id, custom_hospital_id')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false });
  request = hospital.hospitalId
    ? request.eq('hospital_id', hospital.hospitalId)
    : request.eq('custom_hospital_id', hospital.customHospitalId!);
  const { data, error } = await request;
  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => ({
      customHospitalId: row.custom_hospital_id,
      hospitalId: row.hospital_id,
      hospitalName: '',
      id: row.id,
      imageUrl: await signedImageUrl(row.image_path),
      isCustom: true,
      name: row.name,
    })),
  );
}

export async function createCustomMedicine(input: {
  hospital: CustomMedicineHospital;
  imageUri: string;
  name: string;
  patientId: string;
}): Promise<MedicineCatalogueItem> {
  const displayName = input.name.trim().replace(/\s+/g, ' ');
  if (displayName.length < 2 || displayName.length > 120) {
    throw new Error('Enter a tablet name between 2 and 120 characters.');
  }
  if (!input.imageUri) {
    throw new Error('Add a clear tablet photo.');
  }

  const [{ ImageManipulator, SaveFormat }, { ensureSecureReportSession }, { supabase }] =
    await Promise.all([
      import('expo-image-manipulator'),
      import('./reportAuth'),
      import('./supabase'),
    ]);
  const ownerUserId = await ensureSecureReportSession();
  const context = ImageManipulator.manipulate(input.imageUri);
  context.resize({ height: null, width: 1200 });
  const rendered = await context.renderAsync();
  const compressed = await rendered.saveAsync({
    compress: 0.8,
    format: SaveFormat.JPEG,
  });
  const path = buildCustomMedicinePath(ownerUserId, input.imageUri);
  const body = await (await fetch(compressed.uri)).arrayBuffer();
  const uploaded = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (uploaded.error) throw uploaded.error;

  const { data, error } = await supabase
    .from('patient_custom_medicines')
    .insert({
      custom_hospital_id: input.hospital.customHospitalId ?? null,
      hospital_id: input.hospital.hospitalId ?? null,
      image_path: path,
      name: displayName,
      normalized_name: normalizeCustomMedicineName(displayName),
      owner_user_id: ownerUserId,
      patient_id: input.patientId,
    })
    .select('id')
    .single();
  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]).catch(() => undefined);
    throw error ?? new Error('Unable to save tablet.');
  }

  return {
    customHospitalId: input.hospital.customHospitalId ?? null,
    hospitalId: input.hospital.hospitalId ?? null,
    hospitalName: '',
    id: data.id,
    imageUrl: await signedImageUrl(path),
    isCustom: true,
    name: displayName,
  };
}
