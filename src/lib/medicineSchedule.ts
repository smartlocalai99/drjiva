export type DoseSlot = 'morning' | 'afternoon' | 'night';
export type DayPattern = 'daily' | 'alternate';
export type FiniteCourseDays = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type CourseDuration =
  | { days: FiniteCourseDays; mode: 'finite' }
  | { mode: 'ongoing' };

export type MedicineCourseInput = {
  durationDays: number;
  hospitalId: string;
  medicineId: string;
  slots: readonly DoseSlot[];
  tabletsPerDose: number;
};

export type DraftDoseEvent = {
  scheduledFor: string;
  slot: DoseSlot;
};

const DEFAULT_SLOT_TIMES: Record<DoseSlot, string> = {
  afternoon: '13:00',
  morning: '08:00',
  night: '20:00',
};

export const MIN_TABLETS_PER_DOSE = 1;
export const MAX_TABLETS_PER_DOSE = 10;
export const TABLET_STEP = 1;

export function validateCourseDuration(
  duration: CourseDuration,
): string | null {
  if (duration.mode === 'ongoing') return null;
  return Number.isInteger(duration.days) && duration.days >= 1 && duration.days <= 7
    ? null
    : 'invalidCourseDuration';
}

export function adjustTabletCount(value: string, steps: number): string {
  const current = Number.parseFloat(value);
  const base = Number.isFinite(current) ? current : 1;
  const next = Math.min(
    MAX_TABLETS_PER_DOSE,
    Math.max(MIN_TABLETS_PER_DOSE, base + steps * TABLET_STEP),
  );
  return (Math.round(next / TABLET_STEP) * TABLET_STEP).toString();
}

function parseCalendarDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

function formatCalendarDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function validateMedicineCourseInput(
  input: MedicineCourseInput,
): string | null {
  if (!input.hospitalId.trim()) return 'missingHospital';
  if (!input.medicineId.trim()) return 'missingMedicine';
  if (input.slots.length === 0) return 'missingSlot';
  if (
    input.tabletsPerDose < MIN_TABLETS_PER_DOSE ||
    input.tabletsPerDose > MAX_TABLETS_PER_DOSE ||
    !Number.isInteger(input.tabletsPerDose / TABLET_STEP)
  ) {
    return 'invalidTabletQuantity';
  }
  if (
    !Number.isInteger(input.durationDays) ||
    input.durationDays < 1 ||
    input.durationDays > 7
  ) {
    return 'invalidCourseDuration';
  }
  return null;
}

export function generateCourseDates(
  startDate: string,
  durationDays: number,
  pattern: DayPattern,
): string[] {
  const start = parseCalendarDate(startDate);
  const step = pattern === 'alternate' ? 2 : 1;
  const dates: string[] = [];
  for (let offset = 0; offset < durationDays; offset += step) {
    const date = new Date(start);
    date.setDate(start.getDate() + offset);
    dates.push(formatCalendarDate(date));
  }
  return dates;
}

export function expandDoseEvents(input: {
  dayPattern: DayPattern;
  durationDays: number;
  slotTimes?: Partial<Record<DoseSlot, string>>;
  slots: readonly DoseSlot[];
  startDate: string;
}): DraftDoseEvent[] {
  const slotTimes = { ...DEFAULT_SLOT_TIMES, ...input.slotTimes };
  return generateCourseDates(
    input.startDate,
    input.durationDays,
    input.dayPattern,
  ).flatMap((date) =>
    input.slots.map((slot) => {
      const [hour, minute] = slotTimes[slot].split(':').map(Number);
      const scheduled = parseCalendarDate(date);
      scheduled.setHours(hour!, minute!, 0, 0);
      return { scheduledFor: scheduled.toISOString(), slot };
    }),
  );
}

export function getActiveDose<T extends { scheduledFor: string }>(
  events: readonly T[],
  now: Date,
): T | null {
  const today = formatCalendarDate(now);
  const candidates = events
    .filter((event) => {
      const scheduled = new Date(event.scheduledFor);
      return (
        formatCalendarDate(scheduled) === today &&
        scheduled.getTime() <= now.getTime()
      );
    })
    .sort(
      (left, right) =>
        new Date(right.scheduledFor).getTime() -
        new Date(left.scheduledFor).getTime(),
    );
  return candidates[0] ?? null;
}

export function replaceEventSlotTime(
  scheduledFor: string,
  time: string,
): string {
  const date = new Date(scheduledFor);
  const [hour, minute] = time.split(':').map(Number);
  date.setHours(hour!, minute!, 0, 0);
  return date.toISOString();
}
