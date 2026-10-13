import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CarePlan } from './careSchedule';
import { linkPatientDevice } from './hospitalMedicineClaims';
import { toIndianE164 } from './phone';
import { ensureSecureReportSession } from './reportAuth';
import { supabase } from './supabase';

export type CareDepartment = 'gynecology' | 'pediatrics' | 'general';

export type CareFollowup = {
  id: string;
  planId: string | null;
  visitDate: string;
  nextDate: string;
  note: string | null;
  doctorName: string | null;
  department: CareDepartment;
  nurseName: string;
  updatedAt: string;
  hospital: { id: string; name: string; phone: string | null; logoUrl: string | null };
};

export type MyCare = {
  linked: boolean;
  today: string;
  patient?: { id: string; name: string | null };
  currentDoctor?: { name: string; department: CareDepartment; hospitalId: string; hospitalName: string } | null;
  followup?: CareFollowup | null;
  plans?: CarePlan[];
  everyVisit?: Partial<Record<CarePlan['type'], { en: string | null; te: string | null; untilMonths: number | null }>>;
};

export type CachedMyCare = { data: MyCare; savedAt: number };

const cacheKey = (phone: string) => `drjiva.myCare.v1.${phone}`;

async function getMyCare(mobile: string): Promise<MyCare> {
  const { data, error } = await supabase.rpc('care_get_my_care', { p_mobile: mobile });
  if (error) throw error;
  return data as MyCare;
}

// Loads My Care for this phone. The database only answers for a device
// linked to the number (same rule as medicine reminders). If the link
// is missing, it re-runs the existing login link step once.
export async function fetchMyCare(phone: string): Promise<MyCare> {
  await ensureSecureReportSession();
  const mobile = toIndianE164(phone);
  let care = await getMyCare(mobile);
  if (!care.linked) {
    await linkPatientDevice(phone);
    care = await getMyCare(mobile);
  }
  if (care.linked) {
    void AsyncStorage.setItem(cacheKey(phone), JSON.stringify({ data: care, savedAt: Date.now() } satisfies CachedMyCare)).catch(() => undefined);
  }
  return care;
}

export async function readCachedMyCare(phone: string): Promise<CachedMyCare | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(phone));
    return raw ? (JSON.parse(raw) as CachedMyCare) : null;
  } catch {
    return null;
  }
}

export async function hideCarePlan(phone: string, planId: string): Promise<void> {
  await ensureSecureReportSession();
  const { error } = await supabase.rpc('care_hide_plan', { p_mobile: toIndianE164(phone), p_plan_id: planId });
  if (error) throw error;
}
