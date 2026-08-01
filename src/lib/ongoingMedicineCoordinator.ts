import { addCalendarDays, formatDateOnly } from './medicineCalendar';
import { getNotificationSettings, saveNotificationIds } from './medicineCourses';
import {
  requestMedicineNotificationPermission,
  scheduleDoseNotifications,
} from './medicineNotifications';
import { buildRollingDoseEvents } from './ongoingMedicineSchedule';
import { ensureSecureReportSession } from './reportAuth';
import type { DoseSlot } from './medicineSchedule';
import { supabase } from './supabase';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

type OngoingCourseRow = {
  id: string;
  medicines: { name: string } | Array<{ name: string }> | null;
  patient_custom_medicines: { name: string } | Array<{ name: string }> | null;
  patient_id: string;
  patient_medicine_course_slots: Array<{ slot: string }>;
  start_date: string;
  tablets_per_dose: number;
};

export async function replenishOngoingMedicineCourses(horizonDays = 14): Promise<void> {
  const ownerUserId = await ensureSecureReportSession();
  const { data, error } = await supabase
    .from('patient_medicine_courses')
    .select('id, patient_id, start_date, tablets_per_dose, medicines(name), patient_custom_medicines(name), patient_medicine_course_slots(slot)')
    .eq('schedule_mode', 'ongoing')
    .eq('status', 'active')
    .is('stopped_at', null);
  if (error) throw error;

  const notificationsAllowed = await requestMedicineNotificationPermission().catch(() => false);
  const today = formatDateOnly(new Date());
  for (const course of (data ?? []) as unknown as OngoingCourseRow[]) {
    const startDate = course.start_date > today ? course.start_date : today;
    const settings = await getNotificationSettings(course.patient_id);
    const slots = course.patient_medicine_course_slots.map((item) => item.slot as DoseSlot);
    const drafts = buildRollingDoseEvents({
      slotTimes: {
        afternoon: settings.afternoonTime,
        morning: settings.morningTime,
        night: settings.nightTime,
      },
      slots,
    }, startDate, horizonDays);
    const endDate = addCalendarDays(startDate, horizonDays);
    const { data: existing, error: existingError } = await supabase
      .from('patient_medicine_dose_events')
      .select('scheduled_for')
      .eq('course_id', course.id)
      .gte('scheduled_for', new Date(`${startDate}T00:00:00`).toISOString())
      .lt('scheduled_for', new Date(`${endDate}T00:00:00`).toISOString());
    if (existingError) throw existingError;
    const existingTimes = new Set((existing ?? []).map((row) => row.scheduled_for));
    const missing = drafts.filter((draft) => !existingTimes.has(draft.scheduledFor));
    if (missing.length === 0) continue;

    const { data: inserted, error: insertError } = await supabase
      .from('patient_medicine_dose_events')
      .upsert(missing.map((draft) => ({
        course_id: course.id,
        owner_user_id: ownerUserId,
        patient_id: course.patient_id,
        scheduled_for: draft.scheduledFor,
        slot: draft.slot,
      })), { ignoreDuplicates: true, onConflict: 'course_id,scheduled_for' })
      .select('id, scheduled_for, slot');
    if (insertError) throw insertError;
    if (!notificationsAllowed) continue;

    const medicineName = one(course.patient_custom_medicines)?.name ?? one(course.medicines)?.name ?? 'your medicine';
    const identifiers: Array<{ eventId: string; notificationId: string }> = [];
    for (const event of inserted ?? []) {
      identifiers.push(...await scheduleDoseNotifications(
        [{ eventId: event.id, scheduledFor: event.scheduled_for }],
        {
          medicineName,
          slot: event.slot,
          slotKey: event.slot as DoseSlot,
          tablets: Number(course.tablets_per_dose),
        },
      ));
    }
    await saveNotificationIds(identifiers);
  }
}
