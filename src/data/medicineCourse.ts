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
