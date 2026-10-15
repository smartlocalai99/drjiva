import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export type MedicineDoctor = { id: string; display_name: string };

export async function fetchMedicineDoctors(hospitalId: string): Promise<MedicineDoctor[]> {
  await ensureSecureReportSession();
  const { data, error } = await supabase.rpc('medicine_doctors_for_hospital', {
    p_hospital_id: hospitalId,
  });
  if (error) throw error;
  return (data ?? []) as MedicineDoctor[];
}
