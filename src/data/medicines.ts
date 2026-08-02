import { supabase } from '../lib/supabase';
import { deleteMedicineReminderWithAdapter } from '../lib/deleteMedicineReminder';
import { getCustomMedicineImageUrl } from '../lib/customMedicines';
import {
  addCalendarDays,
  formatDateOnly,
  parseDateOnly,
} from '../lib/medicineCalendar';
import { deleteMedicineCourse } from '../lib/medicineCourses';
import {
  cancelDoseNotifications,
  queueNotificationCancellations,
} from '../lib/medicineNotifications';
import { ensureSecureReportSession } from '../lib/reportAuth';
import type { DoseSlot } from '../lib/medicineSchedule';
import {
  buildMedicineStreak,
  buildCurrentWeekMedicineStreak,
  mapDoseRows,
  type CourseStreakEvent,
  type DoseRow,
  type Medicine,
} from './medicineCourse';

export { mapDoseRows, type DoseRow, type Medicine } from './medicineCourse';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

type RawDoseCourse = {
  duration_days: number | null;
  hospitals: { name: string } | Array<{ name: string }> | null;
  id: string;
  medicines:
    | { image_url: string | null; name: string; hospital_name: string }
    | Array<{ image_url: string | null; name: string; hospital_name: string }>
    | null;
  patient_custom_medicines:
    | { image_path: string; name: string }
    | Array<{ image_path: string; name: string }>
    | null;
  patient_custom_hospitals:
    | { name: string }
    | Array<{ name: string }>
    | null;
  start_date: string;
  schedule_mode: 'finite' | 'ongoing';
  tablets_per_dose: number;
};

type RawDose = {
  id: string;
  patient_medicine_courses: RawDoseCourse | RawDoseCourse[];
  scheduled_for: string;
  slot: string;
  status: string;
};

type RawStreakEvent = {
  course_id: string;
  scheduled_for: string;
  status: string;
};

export async function fetchMedicinesForDate(
  patientId: string,
  date: Date,
): Promise<Medicine[]> {
  await ensureSecureReportSession();
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const { data, error } = await supabase
    .from('patient_medicine_dose_events')
    .select(
      'id, scheduled_for, slot, status, patient_medicine_courses!inner(id, tablets_per_dose, start_date, duration_days, schedule_mode, hospitals(name), patient_custom_hospitals(name), medicines(name,image_url,hospital_name), patient_custom_medicines(name,image_path))',
    )
    .eq('patient_id', patientId)
    .gte('scheduled_for', start.toISOString())
    .lt('scheduled_for', end.toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_for');
  if (error) throw error;

  const rawDoses = (data ?? []) as unknown as RawDose[];
  const courseDetails = new Map<string, RawDoseCourse>();
  for (const event of rawDoses) {
    const course = one(event.patient_medicine_courses);
    if (course) {
      courseDetails.set(course.id, course);
    }
  }

  const streakEventsByCourse = new Map<string, CourseStreakEvent[]>();
  const courses = [...courseDetails.values()];
  if (courses.length > 0) {
    const currentWeekStart = new Date(date);
    currentWeekStart.setDate(currentWeekStart.getDate() - ((currentWeekStart.getDay() + 6) % 7));
    const currentWeekStartKey = formatDateOnly(currentWeekStart);
    const firstStartDate = courses
      .map((course) => course.schedule_mode === 'ongoing' ? currentWeekStartKey : course.start_date)
      .sort()[0]!;
    const lastStreakDate = courses
      .map((course) =>
        course.schedule_mode === 'ongoing'
          ? addCalendarDays(currentWeekStartKey, 7)
          : addCalendarDays(course.start_date, Math.min(Math.max(course.duration_days ?? 7, 1), 13)),
      )
      .sort()
      .at(-1)!;
    const streakStart = parseDateOnly(firstStartDate);
    const streakEnd = parseDateOnly(lastStreakDate);

    if (streakStart && streakEnd) {
      const { data: streakData, error: streakError } = await supabase
        .from('patient_medicine_dose_events')
        .select('course_id, scheduled_for, status')
        .in(
          'course_id',
          courses.map((course) => course.id),
        )
        .gte('scheduled_for', streakStart.toISOString())
        .lt('scheduled_for', streakEnd.toISOString())
        .neq('status', 'cancelled')
        .order('scheduled_for');
      if (streakError) throw streakError;

      for (const event of (streakData ?? []) as RawStreakEvent[]) {
        const courseEvents = streakEventsByCourse.get(event.course_id) ?? [];
        courseEvents.push({
          scheduledFor: event.scheduled_for,
          status: event.status,
        });
        streakEventsByCourse.set(event.course_id, courseEvents);
      }
    }
  }

  const rowGroups = await Promise.all(rawDoses.map(async (event) => {
    const course = one(event.patient_medicine_courses);
    const medicine = course ? one(course.medicines) : null;
    const customMedicine = course ? one(course.patient_custom_medicines) : null;
    if (!course || (!medicine && !customMedicine)) return [];
    const hospital =
      one(course.hospitals)?.name ??
      one(course.patient_custom_hospitals)?.name ??
      medicine?.hospital_name ?? '';
    const imageUrl = customMedicine
      ? await getCustomMedicineImageUrl(customMedicine.image_path).catch(() => '')
      : medicine?.image_url ?? '';
    return [{
      completed: event.status === 'completed',
      courseId: course.id,
      eventId: event.id,
      hospitalName: hospital,
      imageUrl,
      medicineName: customMedicine?.name ?? medicine!.name,
      scheduledFor: event.scheduled_for,
      slot: event.slot,
      scheduleMode: course.schedule_mode,
      streakDays:
        course.schedule_mode === 'ongoing'
          ? buildCurrentWeekMedicineStreak(
              course.start_date,
              streakEventsByCourse.get(course.id) ?? [],
              date,
            )
          : buildMedicineStreak(
              course.start_date,
              course.duration_days ?? 7,
              streakEventsByCourse.get(course.id) ?? [],
            ),
      tabletsPerDose: Number(course.tablets_per_dose),
    } satisfies DoseRow];
  }));
  const rows = rowGroups.flat();

  return mapDoseRows(rows);
}

export async function fetchReminderDatesInRange(
  patientId: string,
  start: Date,
  end: Date,
): Promise<Set<string>> {
  await ensureSecureReportSession();
  const { data, error } = await supabase
    .from('patient_medicine_dose_events')
    .select('scheduled_for')
    .eq('patient_id', patientId)
    .gte('scheduled_for', start.toISOString())
    .lt('scheduled_for', end.toISOString())
    .neq('status', 'cancelled');
  if (error) throw error;

  return new Set(
    ((data ?? []) as Array<{ scheduled_for: string }>).map((row) =>
      formatDateOnly(new Date(row.scheduled_for)),
    ),
  );
}

export type MedicineReminder = {
  courseId: string;
  durationDays: number | null;
  hospitalName: string;
  imageUrl: string;
  medicineName: string;
  slots: DoseSlot[];
  startDate: string;
  tabletsPerDose: number;
};

type RawCourse = {
  duration_days: number | null;
  hospitals: { name: string } | Array<{ name: string }> | null;
  id: string;
  medicines:
    | { image_url: string | null; name: string }
    | Array<{ image_url: string | null; name: string }>
    | null;
  patient_custom_medicines:
    | { image_path: string; name: string }
    | Array<{ image_path: string; name: string }>
    | null;
  patient_custom_hospitals: { name: string } | Array<{ name: string }> | null;
  patient_medicine_course_slots: Array<{ slot: string }>;
  start_date: string;
  tablets_per_dose: number;
};

export async function fetchActiveMedicineReminders(
  patientId: string,
): Promise<MedicineReminder[]> {
  await ensureSecureReportSession();
  const { data, error } = await supabase
    .from('patient_medicine_courses')
    .select(
      'id, tablets_per_dose, start_date, duration_days, hospitals(name), patient_custom_hospitals(name), medicines(name, image_url), patient_custom_medicines(name, image_path), patient_medicine_course_slots(slot)',
    )
    .eq('patient_id', patientId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const groups = await Promise.all(((data ?? []) as unknown as RawCourse[]).map(async (row) => {
    const medicine = one(row.medicines);
    const customMedicine = one(row.patient_custom_medicines);
    if (!medicine && !customMedicine) return [];
    const hospitalName =
      one(row.hospitals)?.name ?? one(row.patient_custom_hospitals)?.name ?? '';
    return [
      {
        courseId: row.id,
        durationDays: row.duration_days,
        hospitalName,
        imageUrl: customMedicine
          ? await getCustomMedicineImageUrl(customMedicine.image_path).catch(() => '')
          : medicine?.image_url ?? '',
        medicineName: customMedicine?.name ?? medicine!.name,
        slots: row.patient_medicine_course_slots.map(
          (item) => item.slot as DoseSlot,
        ),
        startDate: row.start_date,
        tabletsPerDose: Number(row.tablets_per_dose),
      } satisfies MedicineReminder,
    ];
  }));
  return groups.flat();
}

export async function deleteMedicineReminder(courseId: string): Promise<void> {
  await deleteMedicineReminderWithAdapter(
    {
      cancelNotifications: cancelDoseNotifications,
      deleteCourse: deleteMedicineCourse,
      filterUnusedNotificationIds: async (identifiers) => {
        const { data, error } = await supabase
          .from('patient_medicine_dose_events')
          .select('notification_id')
          .eq('status', 'scheduled')
          .in('notification_id', [...identifiers]);
        if (error) throw error;
        const usedIds = new Set(
          (data ?? []).flatMap((row) =>
            row.notification_id ? [row.notification_id] : [],
          ),
        );
        return identifiers.filter((identifier) => !usedIds.has(identifier));
      },
      listNotificationIds: async (id) => {
        const { data, error } = await supabase
          .from('patient_medicine_dose_events')
          .select('notification_id')
          .eq('course_id', id)
          .not('notification_id', 'is', null);
        if (error) throw error;
        return (data ?? []).map((row) => row.notification_id);
      },
      queueCancellations: queueNotificationCancellations,
    },
    courseId,
  );
}

export async function completeDoseEvent(
  eventId: string,
  completed: boolean,
): Promise<void> {
  const { data: event, error: eventError } = await supabase
    .from('patient_medicine_dose_events')
    .select('course_id, notification_id, patient_medicine_courses!inner(schedule_mode)')
    .eq('id', eventId)
    .single();
  if (eventError) throw eventError;
  const { error } = await supabase
    .from('patient_medicine_dose_events')
    .update({
      completed_at: completed ? new Date().toISOString() : null,
      status: completed ? 'completed' : 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);
  if (error) throw error;
  if (completed && event.notification_id) {
    const { count: linkedScheduledCount, error: linkedCountError } =
      await supabase
        .from('patient_medicine_dose_events')
        .select('id', { count: 'exact', head: true })
        .eq('notification_id', event.notification_id)
        .eq('status', 'scheduled');
    if (!linkedCountError && (linkedScheduledCount ?? 0) === 0) {
      await cancelDoseNotifications([event.notification_id]).catch(
        () => undefined,
      );
    }
  }
  const { count, error: countError } = await supabase
    .from('patient_medicine_dose_events')
    .select('id', { count: 'exact', head: true })
    .eq('course_id', event.course_id)
    .eq('status', 'scheduled');
  if (countError) throw countError;
  const courseRelation = one(
    event.patient_medicine_courses as
      | { schedule_mode: string }
      | Array<{ schedule_mode: string }>,
  );
  const { error: courseError } = await supabase
    .from('patient_medicine_courses')
    .update({
      status:
        courseRelation?.schedule_mode !== 'ongoing' &&
        completed &&
        (count ?? 0) === 0
          ? 'completed'
          : 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('id', event.course_id);
  if (courseError) throw courseError;
}
