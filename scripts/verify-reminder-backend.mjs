import assert from 'node:assert/strict';

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
if (!url || !key) throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.');

async function signedClient() {
  const client = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.signInAnonymously();
  assert.equal(error, null, error?.message);
  return { client, userId: data.user.id };
}

const owner = await signedClient();
const other = await signedClient();
const { data: patient, error: patientError } = await owner.client.from('patients').select('id').limit(1).single();
assert.equal(patientError, null, patientError?.message);
const { data: hospital, error: hospitalError } = await owner.client.from('hospitals').select('id').limit(1).single();
assert.equal(hospitalError, null, hospitalError?.message);

const normalizedName = `verification tablet ${crypto.randomUUID()}`;
const custom = await owner.client.from('patient_custom_medicines').insert({
  hospital_id: hospital.id,
  image_path: `${owner.userId}/verification.jpg`,
  name: 'Verification Tablet',
  normalized_name: normalizedName,
  owner_user_id: owner.userId,
  patient_id: patient.id,
}).select('id').single();
assert.equal(custom.error, null, custom.error?.message);

const ownerRead = await owner.client.from('patient_custom_medicines').select('id').eq('id', custom.data.id).single();
assert.equal(ownerRead.error, null, ownerRead.error?.message);
const otherRead = await other.client.from('patient_custom_medicines').select('id').eq('id', custom.data.id);
assert.equal(otherRead.error, null, otherRead.error?.message);
assert.equal(otherRead.data.length, 0);

const course = await owner.client.from('patient_medicine_courses').insert({
  custom_medicine_id: custom.data.id,
  day_pattern: 'daily',
  duration_days: null,
  hospital_id: hospital.id,
  medicine_id: null,
  owner_user_id: owner.userId,
  patient_id: patient.id,
  schedule_mode: 'ongoing',
  start_date: new Date().toISOString().slice(0, 10),
  tablets_per_dose: 1,
}).select('id').single();
assert.equal(course.error, null, course.error?.message);

const invalid = await owner.client.from('patient_medicine_courses').insert({
  custom_medicine_id: custom.data.id,
  day_pattern: 'daily',
  duration_days: 1,
  hospital_id: hospital.id,
  medicine_id: (await owner.client.from('medicines').select('id').limit(1).single()).data.id,
  owner_user_id: owner.userId,
  patient_id: patient.id,
  schedule_mode: 'finite',
  start_date: new Date().toISOString().slice(0, 10),
  tablets_per_dose: 1,
});
assert.ok(invalid.error, 'A course with two medicine sources must be rejected.');

await owner.client.from('patient_medicine_courses').delete().eq('id', course.data.id);
await owner.client.from('patient_custom_medicines').delete().eq('id', custom.data.id);
console.log(JSON.stringify({ customMedicinePrivate: true, ongoingCourse: true }));
