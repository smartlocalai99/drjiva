import { ensureSecureReportSession } from '../lib/reportAuth';
import { supabase } from '../lib/supabase';

export type HospitalEventType = 'medical' | 'dental' | 'other';

export type HospitalEvent = {
  id: string;
  hospitalName: string;
  hospitalLogoUrl: string | null;
  title: string;
  eventType: HospitalEventType;
  doctorName: string | null;
  description: string | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
};

type HospitalEventRow = {
  id: string;
  hospital_name: string;
  hospital_logo_url: string | null;
  title: string;
  event_type: HospitalEventType;
  doctor_name: string | null;
  description: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
};

function toHospitalEvent(row: HospitalEventRow): HospitalEvent {
  return {
    description: row.description,
    doctorName: row.doctor_name,
    endTime: row.end_time,
    eventDate: row.event_date,
    eventType: row.event_type,
    hospitalLogoUrl: row.hospital_logo_url,
    hospitalName: row.hospital_name,
    id: row.id,
    location: row.location,
    startTime: row.start_time,
    title: row.title,
  };
}

export async function fetchUpcomingHospitalEvents(): Promise<HospitalEvent[]> {
  const { data, error } = await supabase
    .from('hospital_events')
    .select(
      'id, hospital_name, hospital_logo_url, title, event_type, doctor_name, description, event_date, start_time, end_time, location',
    )
    .gte('event_date', new Date().toISOString().slice(0, 10))
    .order('event_date')
    .order('start_time');
  if (error) throw error;
  return ((data ?? []) as HospitalEventRow[]).map(toHospitalEvent);
}

export async function fetchRegisteredEventIds(): Promise<Set<string>> {
  const ownerUserId = await ensureSecureReportSession();
  const { data, error } = await supabase
    .from('hospital_event_registrations')
    .select('event_id')
    .eq('owner_user_id', ownerUserId);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.event_id as string));
}

export async function registerForHospitalEvent(input: {
  eventId: string;
  patientId?: string;
  mobile: string;
  name?: string;
}): Promise<void> {
  const ownerUserId = await ensureSecureReportSession();
  const { error } = await supabase.from('hospital_event_registrations').insert({
    event_id: input.eventId,
    mobile: input.mobile,
    name: input.name ?? null,
    owner_user_id: ownerUserId,
    patient_id: input.patientId ?? null,
  });
  if (error && error.code !== '23505') throw error; // 23505 = already registered, treat as success
}
