export type Medicine = {
  completed: boolean;
  doctorName: string;
  hospitalName: string;
  id: string;
  imageUrl: string;
  name: string;
  nextReminderTime: string;
  tabletCount: string;
  timing: string;
};

export type DoseRow = {
  completed: boolean;
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
      doctorName: 'Care team',
      hospitalName: row.hospitalName,
      id: row.eventId,
      imageUrl: row.imageUrl.trim(),
      name: row.medicineName,
      nextReminderTime: new Date(row.scheduledFor).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
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
  const minutes = now.getHours() * 60 + now.getMinutes();
  const toMinutes = (value: string) => {
    const [hour, minute] = value.split(':').map(Number);
    return hour! * 60 + minute!;
  };
  const currentSlot =
    minutes >= toMinutes(times.night)
      ? 'night'
      : minutes >= toMinutes(times.afternoon)
        ? 'afternoon'
        : minutes >= toMinutes(times.morning)
          ? 'morning'
          : null;
  const current = currentSlot
    ? rows.filter(
        (row) =>
          row.slot === currentSlot &&
          new Date(row.scheduledFor).getTime() <= now.getTime(),
      )
    : [];
  const next = rows.find(
    (row) => new Date(row.scheduledFor).getTime() > now.getTime(),
  );
  return next && !current.some((row) => row.eventId === next.eventId)
    ? [...current, next]
    : current;
}
