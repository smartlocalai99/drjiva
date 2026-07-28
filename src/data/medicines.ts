import { supabase } from '../lib/supabase';
import {
  mapMedicineRows,
  type Medicine,
  type MedicineRow,
} from './medicineCourse';

export {
  getHospitalInitials,
  mapMedicineRows,
  type Medicine,
  type MedicineRow,
} from './medicineCourse';

export async function fetchMedicinesForDate(
  _date: Date,
): Promise<Medicine[]> {
  const { data, error } = await supabase
    .from('medicines')
    .select('id, name, image_url, hospital_name')
    .not('image_url', 'is', null)
    .order('created_at', { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return mapMedicineRows((data ?? []) as MedicineRow[]);
}
