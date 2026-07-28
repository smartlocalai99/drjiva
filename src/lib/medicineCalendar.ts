export type CalendarCell = {
  date: string;
  day: number;
  inMonth: boolean;
};

export function parseDateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year!, month! - 1, day!);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month! - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function formatDateOnly(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function addCalendarDays(value: string, amount: number): string {
  const date = parseDateOnly(value);
  if (!date) {
    return value;
  }
  date.setDate(date.getDate() + amount);
  return formatDateOnly(date);
}

export function getCourseEndDate(
  startDate: string,
  durationDays: number,
): string {
  return addCalendarDays(startDate, Math.max(1, durationDays) - 1);
}

export function isDateInRange(
  value: string,
  startDate: string,
  durationDays: number,
): boolean {
  const date = parseDateOnly(value);
  const start = parseDateOnly(startDate);
  const end = parseDateOnly(getCourseEndDate(startDate, durationDays));
  return Boolean(
    date &&
      start &&
      end &&
      date.getTime() >= start.getTime() &&
      date.getTime() <= end.getTime(),
  );
}

export function getCalendarCells(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      date: formatDateOnly(date),
      day: date.getDate(),
      inMonth: date.getMonth() === month,
    };
  });
}
