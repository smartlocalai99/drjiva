import type { CareVaccineRecord, VaccineSite } from './care';
import type { CareCopyKey } from './careCopy';
import type { CarePlan } from './careSchedule';
import { toIndianE164 } from './phone';
import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

// Child Growth Chart: what a parent can change. The database checks that
// this phone is linked to the mobile number and the child is theirs.

export type ChildInput = { name: string; gender: 'female' | 'male'; birthDate: string };

export type VaccineInput = {
  planId: string;
  itemId: string;
  givenOn: string;
  site: VaccineSite | null;
  brand: string;
  batchNo: string;
  expiry: string | null;
  photoPath: string | null;
};

const LABEL_BUCKET = 'vaccine-labels';

export class ChildCareError extends Error {
  constructor(readonly copyKey: CareCopyKey) {
    super(copyKey);
  }
}

const ERROR_COPY: Record<string, CareCopyKey> = {
  doses_before_birth: 'childErrDosesBeforeBirth',
  invalid_birth_date: 'childErrBirthDate',
  invalid_gender: 'childErrGender',
  invalid_given_on: 'childErrGivenOn',
  no_child_doctor: 'childErrNoDoctor',
  too_many_children: 'childErrTooMany',
};

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  await ensureSecureReportSession();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new ChildCareError(ERROR_COPY[error.message] ?? 'childErrSave');
  return data as T;
}

export function addChild(phone: string, child: ChildInput): Promise<CarePlan> {
  return call('care_child_add', {
    p_birth_date: child.birthDate,
    p_gender: child.gender,
    p_mobile: toIndianE164(phone),
    p_name: child.name.trim(),
  });
}

export function updateChild(phone: string, planId: string, child: ChildInput): Promise<CarePlan> {
  return call('care_child_update', {
    p_birth_date: child.birthDate,
    p_gender: child.gender,
    p_mobile: toIndianE164(phone),
    p_name: child.name.trim(),
    p_plan_id: planId,
  });
}

export function saveVaccine(phone: string, input: VaccineInput): Promise<CareVaccineRecord[]> {
  return call('care_child_save_vaccine', {
    p_batch_no: input.batchNo.trim(),
    p_brand: input.brand.trim(),
    p_expiry: input.expiry,
    p_given_on: input.givenOn,
    p_item_id: input.itemId,
    p_mobile: toIndianE164(phone),
    p_photo_path: input.photoPath,
    p_plan_id: input.planId,
    p_site: input.site,
  });
}

export function clearVaccine(phone: string, planId: string, itemId: string): Promise<CareVaccineRecord[]> {
  return call('care_child_clear_vaccine', { p_item_id: itemId, p_mobile: toIndianE164(phone), p_plan_id: planId });
}

/** "Mark as complete": every required vaccine of the visit, given on that day. */
export function markVisitGiven(phone: string, planId: string, visitId: string, givenOn: string): Promise<CareVaccineRecord[]> {
  return call('care_child_mark_visit', { p_given_on: givenOn, p_mobile: toIndianE164(phone), p_plan_id: planId, p_visit_id: visitId });
}

/** Uploads a photo of the vaccine label (smaller JPEG) to this phone's own folder. */
export async function uploadVaccineLabel(planId: string, itemId: string, imageUri: string): Promise<string> {
  const ownerUserId = await ensureSecureReportSession();
  const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');
  const context = ImageManipulator.manipulate(imageUri);
  context.resize({ height: null, width: 1280 });
  const rendered = await context.renderAsync();
  const compressed = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const path = `${ownerUserId}/${planId}/${itemId}-${Date.now()}.jpg`;
  const body = await (await fetch(compressed.uri)).arrayBuffer();
  const { error } = await supabase.storage.from(LABEL_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new ChildCareError('childErrPhoto');
  return path;
}

const labelUrls = new Map<string, { url: string; until: number }>();

/** A short-lived link to show a label photo (only this phone can read it). */
export async function vaccineLabelUrl(path: string): Promise<string | null> {
  const cached = labelUrls.get(path);
  if (cached && cached.until > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(LABEL_BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  labelUrls.set(path, { until: Date.now() + 50 * 60 * 1000, url: data.signedUrl });
  return data.signedUrl;
}
