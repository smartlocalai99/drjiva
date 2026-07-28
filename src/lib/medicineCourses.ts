import { matchesMedicineSearch, normalizeMedicineSearch } from './medicineSearch';
import type { DayPattern, DoseSlot, DraftDoseEvent } from './medicineSchedule';
import { createCourseWithRepository } from './medicineCourseRepository';
import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export type MedicineCatalogueItem = {
  hospitalId: string | null;
  hospitalName: string;
  id: string;
  imageUrl: string;
  name: string;
};

export type NotificationSettings = {
  afternoonTime: string;
  morningTime: string;
  nightTime: string;
  timezone: string;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  afternoonTime: '13:00',
  morningTime: '08:00',
  nightTime: '20:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
};

export async function fetchVerifiedHospitals() {
  const { data, error } = await supabase
    .from('hospitals')
    .select('id, name')
    .order('name')
    .limit(100);
  if (error) throw error;
  return (data ?? []) as { id: string; name: string }[];
}

export async function searchMedicines(
  query: string,
  hospitalId?: string,
): Promise<MedicineCatalogueItem[]> {
  const normalized = normalizeMedicineSearch(query);
  if (normalized.length < 2) return [];
  const candidate = normalized.split(' ')[0]!.replace(/[%_,()]/g, '');
  let request = supabase
    .from('medicines')
    .select('id, name, image_url, hospital_id, hospital_name')
    .not('image_url', 'is', null)
    .ilike('name', `%${candidate}%`)
    .limit(40);
  if (hospitalId) request = request.eq('hospital_id', hospitalId);
  const { data, error } = await request;
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter(
      (row) =>
        typeof row.image_url === 'string' &&
        row.image_url.trim() &&
        matchesMedicineSearch(String(row.name ?? ''), normalized),
    )
    .slice(0, 20)
    .map((row) => ({
      hospitalId:
        typeof row.hospital_id === 'string' ? row.hospital_id : null,
      hospitalName: String(row.hospital_name ?? ''),
      id: String(row.id),
      imageUrl: String(row.image_url).trim(),
      name: String(row.name),
    }));
}

export async function getNotificationSettings(
  patientId: string,
): Promise<NotificationSettings> {
  await ensureSecureReportSession();
  const { data, error } = await supabase
    .from('patient_notification_settings')
    .select('morning_time, afternoon_time, night_time, timezone')
    .eq('patient_id', patientId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SETTINGS;
  return {
    afternoonTime: String(data.afternoon_time).slice(0, 5),
    morningTime: String(data.morning_time).slice(0, 5),
    nightTime: String(data.night_time).slice(0, 5),
    timezone: data.timezone,
  };
}

export async function saveNotificationSettings(
  patientId: string,
  settings: NotificationSettings,
): Promise<void> {
  const ownerUserId = await ensureSecureReportSession();
  const { error } = await supabase.from('patient_notification_settings').upsert({
    afternoon_time: settings.afternoonTime,
    morning_time: settings.morningTime,
    night_time: settings.nightTime,
    owner_user_id: ownerUserId,
    patient_id: patientId,
    timezone: settings.timezone,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function createCustomHospital(
  patientId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  const ownerUserId = await ensureSecureReportSession();
  const displayName = name.trim();
  const { data, error } = await supabase
    .from('patient_custom_hospitals')
    .upsert(
      {
        name: displayName,
        normalized_name: normalizeMedicineSearch(displayName),
        owner_user_id: ownerUserId,
        patient_id: patientId,
      },
      { onConflict: 'owner_user_id,normalized_name' },
    )
    .select('id, name')
    .single();
  if (error || !data) throw error ?? new Error('Unable to save hospital.');
  return data;
}

export async function createMedicineCourse(input: {
  customHospitalId?: string;
  dayPattern: DayPattern;
  events: readonly DraftDoseEvent[];
  hospitalId?: string;
  medicineId: string;
  patientId: string;
  slots: readonly DoseSlot[];
  startDate: string;
  tabletsPerDose: number;
  durationDays: number;
}): Promise<{ courseId: string; eventIds: string[] }> {
  const ownerUserId = await ensureSecureReportSession();
  const eventIds: string[] = [];
  const repository = {
    insertCourse: async (course: Record<string, unknown>) => {
      const { data, error } = await supabase
        .from('patient_medicine_courses')
        .insert(course)
        .select('id')
        .single();
      if (error || !data) throw error ?? new Error('Unable to create course.');
      return data.id as string;
    },
    insertSlots: async (courseId: string, slots: readonly string[]) => {
      const { error } = await supabase
        .from('patient_medicine_course_slots')
        .insert(
          slots.map((slot) => ({
            course_id: courseId,
            owner_user_id: ownerUserId,
            slot,
          })),
        );
      if (error) throw error;
    },
    insertEvents: async (
      courseId: string,
      events: readonly Record<string, unknown>[],
    ) => {
      const { data, error } = await supabase
        .from('patient_medicine_dose_events')
        .insert(
          events.map((event) => ({
            course_id: courseId,
            owner_user_id: ownerUserId,
            patient_id: input.patientId,
            scheduled_for: event.scheduledFor,
            slot: event.slot,
          })),
        )
        .select('id');
      if (error) throw error;
      eventIds.push(...(data ?? []).map((row) => row.id as string));
    },
    removeCourse: async (courseId: string) => {
      const { error } = await supabase
        .from('patient_medicine_courses')
        .delete()
        .eq('id', courseId);
      if (error) throw error;
    },
  };
  const courseId = await createCourseWithRepository(repository, {
    course: {
      custom_hospital_id: input.customHospitalId ?? null,
      day_pattern: input.dayPattern,
      duration_days: input.durationDays,
      hospital_id: input.hospitalId ?? null,
      medicine_id: input.medicineId,
      owner_user_id: ownerUserId,
      patient_id: input.patientId,
      start_date: input.startDate,
      tablets_per_dose: input.tabletsPerDose,
    },
    events: input.events,
    slots: input.slots,
  });
  return { courseId, eventIds };
}

export async function saveNotificationIds(
  identifiers: readonly { eventId: string; notificationId: string }[],
): Promise<void> {
  for (const item of identifiers) {
    const { error } = await supabase
      .from('patient_medicine_dose_events')
      .update({ notification_id: item.notificationId })
      .eq('id', item.eventId);
    if (error) throw error;
  }
}
