import type { DoseSlot } from '../lib/medicineSchedule';
import {
  addCalendarDays,
  formatDateOnly,
  parseDateOnly,
} from '../lib/medicineCalendar';
import { formatScheduledTime12Hour } from '../lib/medicineTime';

export type MedicineStreakDay = {
  completed: boolean;
  date: string;
  day: number;
  scheduled: boolean;
  weekday: string;
};

export type Medicine = {
  completed: boolean;
  courseId: string;
  description: string;
  doctorName: string;
  durationDays: number | null;
  hospitalName: string;
  id: string;
  imageUrl: string;
  name: string;
  nextReminderTime: string;
  scheduledFor: string;
  slot: DoseSlot;
  scheduleMode?: 'finite' | 'ongoing';
  streakDays: MedicineStreakDay[];
  tabletCount: string;
  timing: string;
};

export type CourseStreakEvent = {
  scheduledFor: string;
  status: string;
};

export type DoseRow = {
  completed: boolean;
  courseId: string;
  description?: string | null;
  durationDays?: number | null;
  eventId: string;
  hospitalName: string;
  imageUrl: string;
  medicineName: string;
  scheduledFor: string;
  slot: string;
  scheduleMode?: 'finite' | 'ongoing';
  streakDays?: MedicineStreakDay[];
  tabletsPerDose: number;
};

function titleCase(value: string): string {
  return value ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function buildMedicineStreak(
  startDate: string,
  durationDays: number,
  events: readonly CourseStreakEvent[],
): MedicineStreakDay[] {
  const firstDate = parseDateOnly(startDate);
  if (!firstDate || !Number.isInteger(durationDays) || durationDays <= 0) {
    return [];
  }

  const courseEndDate = addCalendarDays(startDate, durationDays);
  const eventsByDate = new Map<string, CourseStreakEvent[]>();
  for (const event of events) {
    const eventDate = new Date(event.scheduledFor);
    if (Number.isNaN(eventDate.getTime())) {
      continue;
    }
    const dateKey = formatDateOnly(eventDate);
    if (dateKey < startDate || dateKey >= courseEndDate) {
      continue;
    }
    const dateEvents = eventsByDate.get(dateKey) ?? [];
    dateEvents.push(event);
    eventsByDate.set(dateKey, dateEvents);
  }

  return [...eventsByDate.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(0, 7)
    .map(([date, dateEvents]) => {
      const parsed = parseDateOnly(date)!;

      return {
        completed: dateEvents.every((event) => event.status === 'completed'),
        date,
        day: parsed.getDate(),
        scheduled: true,
        weekday: WEEKDAYS[parsed.getDay()]!,
      };
    });
}

export function buildCurrentWeekMedicineStreak(
  startDate: string,
  events: readonly CourseStreakEvent[],
  asOf: Date | string = new Date(),
): MedicineStreakDay[] {
  const asOfDate = typeof asOf === 'string' ? parseDateOnly(asOf) : new Date(asOf);
  const courseStart = parseDateOnly(startDate);
  if (!asOfDate || !courseStart) return [];
  const mondayOffset = (asOfDate.getDay() + 6) % 7;
  const weekStart = new Date(asOfDate);
  weekStart.setDate(asOfDate.getDate() - mondayOffset);
  const eventsByDate = new Map<string, CourseStreakEvent[]>();
  for (const event of events) {
    const date = new Date(event.scheduledFor);
    if (Number.isNaN(date.getTime())) continue;
    const key = formatDateOnly(date);
    const group = eventsByDate.get(key) ?? [];
    group.push(event);
    eventsByDate.set(key, group);
  }
  return Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    const key = formatDateOnly(date);
    const dateEvents = eventsByDate.get(key) ?? [];
    const scheduled = key >= startDate && dateEvents.length > 0;
    return {
      completed:
        scheduled &&
        dateEvents.every((event) => event.status === 'completed'),
      date: key,
      day: date.getDate(),
      scheduled,
      weekday: WEEKDAYS[date.getDay()]!,
    };
  });
}

export function mapDoseRows(rows: readonly DoseRow[]): Medicine[] {
  return [...rows]
    .sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() -
        new Date(right.scheduledFor).getTime(),
    )
    .map((row) => ({
      completed: row.completed,
      courseId: row.courseId,
      description: row.description?.trim() || 'Medicine reminder',
      doctorName: 'Care team',
      durationDays: row.durationDays ?? null,
      hospitalName: row.hospitalName,
      id: row.eventId,
      imageUrl: row.imageUrl.trim(),
      name: row.medicineName,
      nextReminderTime: formatScheduledTime12Hour(row.scheduledFor),
      scheduledFor: row.scheduledFor,
      slot: row.slot as DoseSlot,
      scheduleMode: row.scheduleMode ?? 'finite',
      streakDays: row.streakDays ?? [],
      tabletCount: `${row.tabletsPerDose} tablet${
        row.tabletsPerDose === 1 ? '' : 's'
      }`,
      timing: titleCase(row.slot),
    }));
}

export function selectNearestMedicine(
  medicines: readonly Medicine[],
  now: Date,
): Medicine | null {
  if (medicines.length === 0) {
    return null;
  }

  const nowTime = now.getTime();
  const pending = medicines.filter((medicine) => !medicine.completed);
  const upcoming = pending
    .filter(
      (medicine) => new Date(medicine.scheduledFor).getTime() >= nowTime,
    )
    .sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() -
        new Date(right.scheduledFor).getTime(),
    );
  if (upcoming[0]) {
    return upcoming[0];
  }

  const closestOverdue = pending.sort(
    (left, right) =>
      new Date(right.scheduledFor).getTime() -
      new Date(left.scheduledFor).getTime(),
  )[0];
  if (closestOverdue) {
    return closestOverdue;
  }

  return [...medicines].sort(
    (left, right) =>
      new Date(right.scheduledFor).getTime() -
      new Date(left.scheduledFor).getTime(),
  )[0]!;
}

export function selectNearestSession(
  medicines: readonly Medicine[],
  now: Date,
): Medicine[] {
  const nearest = selectNearestMedicine(medicines, now);
  if (!nearest) {
    return [];
  }

  const nearestDate = formatDateOnly(new Date(nearest.scheduledFor));
  return medicines
    .filter(
      (medicine) =>
        medicine.slot === nearest.slot &&
        formatDateOnly(new Date(medicine.scheduledFor)) === nearestDate,
    )
    .sort(
      (left, right) =>
        new Date(left.scheduledFor).getTime() -
        new Date(right.scheduledFor).getTime(),
    );
}

export function shouldCompleteCourse(remainingScheduledDoses: number): boolean {
  return remainingScheduledDoses === 0;
}
