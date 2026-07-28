import type { DoseSlot } from './medicineSchedule';

const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isStoredTime(value: string): boolean {
  return VALID_TIME.test(value);
}

export function timeToMinutes(value: string): number {
  if (!isStoredTime(value)) return Number.NaN;
  const [hours, minutes] = value.split(':').map(Number);
  return hours! * 60 + minutes!;
}

export function formatTime12Hour(value: string): string {
  if (!isStoredTime(value)) return value;
  const [hours, minutes] = value.split(':').map(Number);
  const period = hours! >= 12 ? 'PM' : 'AM';
  const displayHour = hours! % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${period}`;
}

export function adjustTime(value: string, amountMinutes: number): string {
  const current = timeToMinutes(value);
  if (!Number.isFinite(current)) return value;
  const next = (current + amountMinutes + 24 * 60) % (24 * 60);
  return `${String(Math.floor(next / 60)).padStart(2, '0')}:${String(
    next % 60,
  ).padStart(2, '0')}`;
}

export function areSelectedSlotTimesOrdered(
  slots: readonly DoseSlot[],
  times: Record<DoseSlot, string>,
): boolean {
  const selected = (['morning', 'afternoon', 'night'] as const)
    .filter((slot) => slots.includes(slot))
    .map((slot) => timeToMinutes(times[slot]));
  return (
    selected.every(Number.isFinite) &&
    selected.every((value, index) => index === 0 || selected[index - 1]! < value)
  );
}

export function formatScheduledTime12Hour(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return formatTime12Hour(
    `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`,
  );
}
