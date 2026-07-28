import { supabase } from './supabase';
import { toIndianE164 } from './phone';
import { ensureSecureReportSession } from './reportAuth';

export type Patient = {
  patientId: string;
  name: string;
  phoneNumber: string;
  age: number | null;
  gender: string | null;
  address: string | null;
  avatarUrl: string | null;
};

const CORE_COLUMNS = 'id, name, mobile, age, gender';
const PHOTO_COLUMNS = `${CORE_COLUMNS}, avatar_url`;
const FULL_COLUMNS = `${PHOTO_COLUMNS}, address`;

type PatientRow = {
  id: string;
  name: string;
  mobile: string;
  age: number | null;
  gender: string | null;
  address?: string | null;
  avatar_url?: string | null;
};

type PostgrestErrorLike = { code?: string } | null;

// Profile columns were added after the core patient record. Keep older
// environments usable while migrations are being rolled out.
function isMissingColumnError(error: PostgrestErrorLike): boolean {
  return error?.code === '42703';
}

// A retried/duplicate submission (e.g. a double-tap, or a retry after the
// first attempt actually succeeded but the screen didn't navigate away in
// time) can hit the `mobile` unique constraint. Treat that as success
// rather than an error the user has to fight with.
function isUniqueViolationError(error: PostgrestErrorLike): boolean {
  return error?.code === '23505';
}

function mapPatientRow(data: PatientRow): Patient {
  return {
    address: data.address ?? null,
    age: data.age,
    avatarUrl: data.avatar_url ?? null,
    gender: data.gender,
    name: data.name,
    patientId: data.id,
    phoneNumber: data.mobile,
  };
}

export async function getPatientByPhone(
  phone: string,
): Promise<Patient | null> {
  const mobile = toIndianE164(phone);

  let { data, error } = await supabase
    .from('patients')
    .select(FULL_COLUMNS)
    .eq('mobile', mobile)
    .maybeSingle();

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('patients')
      .select(PHOTO_COLUMNS)
      .eq('mobile', mobile)
      .maybeSingle());
  }
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('patients')
      .select(CORE_COLUMNS)
      .eq('mobile', mobile)
      .maybeSingle());
  }

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapPatientRow(data);
}

export async function checkPatientExists(phone: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .eq('mobile', toIndianE164(phone))
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data !== null;
}

export async function createPatient(
  phone: string,
  name: string,
): Promise<Patient> {
  const mobile = toIndianE164(phone);

  let { data, error } = await supabase
    .from('patients')
    .insert({ mobile, name })
    .select(FULL_COLUMNS)
    .single();

  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('patients')
      .insert({ mobile, name })
      .select(PHOTO_COLUMNS)
      .single());
  }
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('patients')
      .insert({ mobile, name })
      .select(CORE_COLUMNS)
      .single());
  }

  if (error && isUniqueViolationError(error)) {
    const existing = await getPatientByPhone(phone);
    if (existing) {
      return existing;
    }
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Unable to create patient.');
  }

  return mapPatientRow(data);
}

export type PatientProfileUpdate = {
  address: string | null;
  age: number | null;
  avatar_url?: string | null;
  gender: 'female' | 'male' | 'other' | null;
  name: string;
};

export async function updatePatientProfile(
  phone: string,
  update: PatientProfileUpdate,
): Promise<Patient> {
  await ensureSecureReportSession();
  const mobile = toIndianE164(phone);

  let { data, error } = await supabase
    .from('patients')
    .update(update)
    .eq('mobile', mobile)
    .select(FULL_COLUMNS)
    .single();

  if (error && isMissingColumnError(error)) {
    const { address: _address, ...photoUpdate } = update;
    ({ data, error } = await supabase
      .from('patients')
      .update(photoUpdate)
      .eq('mobile', mobile)
      .select(PHOTO_COLUMNS)
      .single());
  }
  if (error && isMissingColumnError(error)) {
    const {
      address: _address,
      avatar_url: _avatarUrl,
      ...coreUpdate
    } = update;
    ({ data, error } = await supabase
      .from('patients')
      .update(coreUpdate)
      .eq('mobile', mobile)
      .select(CORE_COLUMNS)
      .single());
  }

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('Unable to update patient.');
  }

  return mapPatientRow(data);
}

export async function updatePatientAddress(
  phone: string,
  address: string | null,
): Promise<void> {
  await ensureSecureReportSession();
  const { error } = await supabase
    .from('patients')
    .update({ address })
    .eq('mobile', toIndianE164(phone));
  if (error) {
    throw error;
  }
}
