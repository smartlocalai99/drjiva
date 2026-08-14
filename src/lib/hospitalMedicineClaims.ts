import { expandDoseEvents } from './medicineSchedule';
import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

// Grants this device (this anonymous auth session) access to every existing
// medicine course tied to the given mobile number's patient, regardless of
// which device originally created them. Safe/idempotent to call on every
// login — see patient_device_links + the "Linked devices access..." RLS
// policies added in 20260814063000_add_patient_device_links.sql.
export async function linkPatientDevice(mobile: string): Promise<void> {
  await ensureSecureReportSession();
  try {
    await supabase.rpc('link_patient_device', { p_mobile: mobile });
  } catch {
    // best-effort — the login flow proceeds either way
  }
}

type ClaimedCourseRow = {
  course_id: string;
  patient_id: string;
  tablets_per_dose: number;
  start_date: string;
  duration_days: number;
  day_pattern: 'daily' | 'alternate';
  slots: Array<'morning' | 'afternoon' | 'night'>;
};

// Picks up any medicine courses a hospital created for this mobile number
// (via create_hospital_medicine_course) before this device ever logged in,
// reassigns them to this device's session, and generates the same dose
// events a patient-added course would get. Safe to call on every login —
// claim_hospital_medicine_courses only returns courses it hasn't already
// generated events for.
export async function claimHospitalMedicineCourses(
  mobile: string,
): Promise<void> {
  const ownerUserId = await ensureSecureReportSession();
  const { data, error } = await supabase.rpc(
    'claim_hospital_medicine_courses',
    { p_mobile: mobile },
  );
  if (error || !data || (data as ClaimedCourseRow[]).length === 0) return;

  for (const course of data as ClaimedCourseRow[]) {
    const events = expandDoseEvents({
      dayPattern: course.day_pattern,
      durationDays: course.duration_days,
      slots: course.slots,
      startDate: course.start_date,
    });
    if (events.length === 0) continue;

    await supabase.from('patient_medicine_dose_events').insert(
      events.map((event) => ({
        course_id: course.course_id,
        owner_user_id: ownerUserId,
        patient_id: course.patient_id,
        scheduled_for: event.scheduledFor,
        slot: event.slot,
      })),
    );
  }
}
