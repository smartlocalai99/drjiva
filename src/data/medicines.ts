import { supabase } from '../lib/supabase';
import {
  mapDoseRows,
  selectRelevantDoseRows,
  type DoseRow,
  type Medicine,
} from './medicineCourse';

export {
  getHospitalInitials,
  mapDoseRows,
  type DoseRow,
  type Medicine,
} from './medicineCourse';

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

type RawDose = {
  id: string;
  scheduled_for: string;
  slot: string;
  status: string;
  patient_medicine_courses:
    | {
        tablets_per_dose: number;
        hospitals: { name: string } | Array<{ name: string }> | null;
        patient_custom_hospitals:
          | { name: string }
          | Array<{ name: string }>
          | null;
        medicines:
          | { image_url: string | null; name: string; hospital_name: string }
          | Array<{ image_url: string | null; name: string; hospital_name: string }>;
      }
    | Array<{
        tablets_per_dose: number;
        hospitals: { name: string } | Array<{ name: string }> | null;
        patient_custom_hospitals:
          | { name: string }
          | Array<{ name: string }>
          | null;
        medicines:
          | { image_url: string | null; name: string; hospital_name: string }
          | Array<{ image_url: string | null; name: string; hospital_name: string }>;
      }>;
};

export async function fetchMedicinesForDate(
  patientId: string,
  date: Date,
  now = new Date(),
): Promise<Medicine[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [{ data, error }, settingsResult] = await Promise.all([
    supabase
      .from('patient_medicine_dose_events')
      .select(
        'id, scheduled_for, slot, status, patient_medicine_courses!inner(tablets_per_dose, hospitals(name), patient_custom_hospitals(name), medicines!inner(name,image_url,hospital_name))',
      )
      .eq('patient_id', patientId)
      .gte('scheduled_for', start.toISOString())
      .lt('scheduled_for', end.toISOString())
      .neq('status', 'cancelled')
      .order('scheduled_for'),
    supabase
      .from('patient_notification_settings')
      .select('morning_time, afternoon_time, night_time')
      .eq('patient_id', patientId)
      .maybeSingle(),
  ]);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as RawDose[]).flatMap((event) => {
    const course = one(event.patient_medicine_courses);
    const medicine = course ? one(course.medicines) : null;
    if (!course || !medicine?.image_url) return [];
    const hospital =
      one(course.hospitals)?.name ??
      one(course.patient_custom_hospitals)?.name ??
      medicine.hospital_name;
    return [{
      completed: event.status === 'completed',
      eventId: event.id,
      hospitalName: hospital,
      imageUrl: medicine.image_url,
      medicineName: medicine.name,
      scheduledFor: event.scheduled_for,
      slot: event.slot,
      tabletsPerDose: Number(course.tablets_per_dose),
    } satisfies DoseRow];
  });

  const isToday = start.toDateString() === now.toDateString();
  if (!isToday) return mapDoseRows(rows);
  const settings = settingsResult.data;
  return mapDoseRows(
    selectRelevantDoseRows(rows, now, {
      afternoon: String(settings?.afternoon_time ?? '13:00').slice(0, 5),
      morning: String(settings?.morning_time ?? '08:00').slice(0, 5),
      night: String(settings?.night_time ?? '20:00').slice(0, 5),
    }),
  );
}

export async function completeDoseEvent(
  eventId: string,
  completed: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('patient_medicine_dose_events')
    .update({
      completed_at: completed ? new Date().toISOString() : null,
      status: completed ? 'completed' : 'scheduled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', eventId);
  if (error) throw error;
}
