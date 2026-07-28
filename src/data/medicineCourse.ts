import type { DoseSlot } from '../lib/medicineSchedule';
import { formatScheduledTime12Hour } from '../lib/medicineTime';

export type Medicine = {
  completed: boolean;
  courseId: string;
  doctorName: string;
  hospitalName: string;
  id: string;
  imageUrl: string;
  name: string;
  nextReminderTime: string;
  slot: DoseSlot;
  tabletCount: string;
  timing: string;
};

export type DoseRow = {
  completed: boolean;
  courseId: string;
  eventId: string;
  hospitalName: string;
  imageUrl: string;
  medicineName: string;
  scheduledFor: string;
  slot: string;
  tabletsPerDose: number;
};

export function getHospitalInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !['HOSPITAL', 'HOSPITALS'].includes(word.toUpperCase()));
  if (words.length === 0) return 'H';
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function titleCase(value: string): string {
  return value ? `${value[0]!.toUpperCase()}${value.slice(1)}` : value;
}

export function mapDoseRows(rows: readonly DoseRow[]): Medicine[] {
  return rows
    .filter((row) => Boolean(row.imageUrl.trim()))
    .map((row) => ({
      completed: row.completed,
      courseId: row.courseId,
      doctorName: 'Care team',
      hospitalName: row.hospitalName,
      id: row.eventId,
      imageUrl: row.imageUrl.trim(),
      name: row.medicineName,
      nextReminderTime: formatScheduledTime12Hour(row.scheduledFor),
      slot: row.slot as DoseSlot,
      tabletCount: `${row.tabletsPerDose} tablet${
        row.tabletsPerDose === 1 ? '' : 's'
      }`,
      timing: titleCase(row.slot),
    }));
}

export function selectRelevantDoseRows(
  rows: readonly DoseRow[],
  now: Date,
  times: Record<'morning' | 'afternoon' | 'night', string>,
): DoseRow[] {
  const ordered = [...rows].sort(
    (left, right) =>
      new Date(left.scheduledFor).getTime() -
      new Date(right.scheduledFor).getTime(),
  );
  const latestStarted = ordered.findLast(
    (row) => new Date(row.scheduledFor).getTime() <= now.getTime(),
  );
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour! * 60 + minute!;
  };
  const configuredSlot =
    minutes >= toMinutes(times.night)
      ? 'night'
      : minutes >= toMinutes(times.afternoon)
        ? 'afternoon'
        : minutes >= toMinutes(times.morning)
          ? 'morning'
          : null;
  const slotRank = { afternoon: 1, morning: 0, night: 2 };
  const currentSlot =
    latestStarted &&
    (!configuredSlot ||
      slotRank[latestStarted.slot as keyof typeof slotRank] >
        slotRank[configuredSlot])
      ? latestStarted.slot
      : configuredSlot;
  const current = currentSlot
    ? ordered.filter(
        (row) =>
          row.slot === currentSlot &&
          new Date(row.scheduledFor).getTime() <= now.getTime(),
      )
    : [];
  const next = ordered.find(
    (row) => new Date(row.scheduledFor).getTime() > now.getTime(),
  );
  return next && !current.some((row) => row.eventId === next.eventId)
    ? [...current, next]
    : current;
}

export function shouldCompleteCourse(remainingScheduledDoses: number): boolean {
  return remainingScheduledDoses === 0;
}
