// Pure My Care logic (no React, no network). Mirrors lib/nurse-schedule.js
// in the Doctor Studio so the nurse and the patient always see the same
// status. Dates are 'YYYY-MM-DD' strings (India date), so plain string
// comparison orders them correctly.

export type CareItemStatus = 'done' | 'not_needed' | null;

export type CareItem = {
  id: string;
  code: string;
  labelEn: string;
  labelTe: string;
  conditional: boolean;
  /** Optional vaccine ("ask your doctor"); reminders only if the parent turns them on. */
  optional?: boolean;
  fromDate: string;
  toDate: string;
  status: CareItemStatus;
  doneOn: string | null;
  nurseName: string | null;
};

export type CareVisit = {
  id: string;
  /** Appointment explicitly booked by the nurse; independent of the template window. */
  plannedDate?: string | null;
  code: string;
  titleEn: string;
  titleTe: string;
  fromDate: string;
  toDate: string;
  items: CareItem[];
};

export type CarePlan = {
  id: string;
  type: 'pregnancy' | 'child';
  status: 'active' | 'delivered' | 'ended';
  personName: string;
  lmpDate: string | null;
  eddDate: string | null;
  birthDate: string | null;
  gender: 'female' | 'male' | null;
  startDate: string;
  hospitalId: string;
  hospitalName: string;
  doctorName: string | null;
  startedByNurse: string | null;
  createdAt: string;
  hiddenByPatient: boolean;
  visits: CareVisit[];
};

export type ItemState = 'done' | 'not_needed' | 'due_now' | 'pending' | 'upcoming' | 'optional';
export type VisitState = 'done' | 'due_now' | 'pending' | 'upcoming' | 'optional';

export function itemState(item: Pick<CareItem, 'conditional' | 'fromDate' | 'status' | 'toDate'>, today: string): ItemState {
  if (item.status === 'done') return 'done';
  if (item.status === 'not_needed') return 'not_needed';
  if (today < item.fromDate) return 'upcoming';
  if (today <= item.toDate) return 'due_now';
  return item.conditional ? 'optional' : 'pending';
}

export function visitState(visit: Pick<CareVisit, 'items'>, today: string): VisitState {
  const states = visit.items.map((item) => itemState(item, today));
  const closed = (state: ItemState) => state === 'done' || state === 'not_needed';
  const required = visit.items
    .map((item, index) => ({ conditional: item.conditional, state: states[index] as ItemState }))
    .filter((entry) => !entry.conditional)
    .map((entry) => entry.state);
  if (required.length > 0 && required.every(closed)) return 'done';
  if (required.length === 0 && states.some(closed)) return 'done';
  if (states.includes('due_now')) return 'due_now';
  if (states.includes('pending')) return 'pending';
  if (states.includes('upcoming')) return 'upcoming';
  return 'optional';
}

function toUtc(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDaysIso(date: string, days: number): string {
  return new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10);
}

// Today's date in India, as 'YYYY-MM-DD'.
export function indiaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 5.5 * 3_600_000).toISOString().slice(0, 10);
}

export function pregnancyWeek(plan: Pick<CarePlan, 'startDate'>, today: string): number {
  return Math.max(0, Math.floor(daysBetween(plan.startDate, today) / 7));
}

// Month of pregnancy the way families count it (weeks 0–4 = 1st month …
// 36+ = 9th month). Same table as the nurse page.
const MONTH_ENDS = [4, 8, 13, 17, 22, 27, 31, 35];
export function pregnancyMonth(week: number): number {
  const index = MONTH_ENDS.findIndex((end) => week <= end);
  return index === -1 ? 9 : index + 1;
}

export function trimester(week: number): 1 | 2 | 3 {
  if (week < 14) return 1;
  if (week < 28) return 2;
  return 3;
}

export type ChildAge = { unit: 'week' | 'month' | 'year'; value: number };

export function childAge(birthDate: string, today: string): ChildAge {
  const days = Math.max(0, daysBetween(birthDate, today));
  if (days < 98) return { unit: 'week', value: Math.floor(days / 7) };
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ty, tm, td] = today.split('-').map(Number) as [number, number, number];
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  if (months < 24) return { unit: 'month', value: months };
  return { unit: 'year', value: Math.floor(months / 12) };
}

// The visit the patient should look at now: the first one not finished
// whose window has not ended (it may be due now or upcoming).
export function currentVisit(plan: Pick<CarePlan, 'visits'>, today: string): CareVisit | null {
  return (
    sortVisits(plan.visits).find(
      (visit) => visit.toDate >= today && visitState(visit, today) !== 'done',
    ) ?? null
  );
}

export function pendingVisitItems(visit: Pick<CareVisit, 'items'>): CareItem[] {
  return visit.items.filter((item) => !item.status && !item.conditional && !item.optional);
}

// A booked appointment wins over the pregnancy/child schedule. Completed
// and not-needed items never reappear as work for the next appointment.
export function visitForDate(plan: Pick<CarePlan, 'visits'>, date: string): CareVisit | null {
  const booked = plan.visits.filter((visit) => visit.plannedDate === date);
  if (booked.length) {
    const items = booked.flatMap(pendingVisitItems);
    return items.length ? { ...booked[0]!, items } : null;
  }
  const sorted = sortVisits(plan.visits).filter((visit) => !visit.plannedDate && pendingVisitItems(visit).length);
  return (
    sorted.find((visit) => visit.fromDate <= date && date <= visit.toDate) ??
    sorted.find((visit) => visit.fromDate > date) ??
    null
  );
}

export function sortVisits(visits: readonly CareVisit[]): CareVisit[] {
  return [...visits].sort((a, b) =>
    a.fromDate === b.fromDate ? (a.toDate < b.toDate ? -1 : 1) : a.fromDate < b.fromDate ? -1 : 1,
  );
}

export type TimelineEntry = { visit: CareVisit; state: VisitState };

// Timeline split the way the screen shows it: finished past visits
// (collapsed by default) and everything from now on.
export function timeline(plan: Pick<CarePlan, 'visits'>, today: string): {
  past: TimelineEntry[];
  rest: TimelineEntry[];
} {
  const entries = sortVisits(plan.visits).map((visit) => ({ state: visitState(visit, today), visit }));
  const past = entries.filter((entry) => entry.visit.toDate < today && entry.state === 'done');
  const rest = entries.filter((entry) => !(entry.visit.toDate < today && entry.state === 'done'));
  return { past, rest };
}

export function daysUntil(date: string, today: string): number {
  return daysBetween(today, date);
}

// Hospital phone numbers in the table are not always valid
// (e.g. '0000000000'). Only offer "Call" for a real-looking number.
export function dialableIndianPhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits;
  // Mobiles (6-9…) and landlines with STD code (e.g. 08562 → 8562…)
  // both dial correctly as +91 followed by the 10 digits.
  return /^[1-9]\d{9}$/.test(national) && !/^(\d)\1{9}$/.test(national) ? `+91${national}` : null;
}
