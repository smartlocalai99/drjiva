export type Medicine = {
  id: string;
  name: string;
  imageUrl: string;
  tabletCount: string;
  timing: string;
  doctorName: string;
  hospitalName: string;
  nextReminderTime: string;
  completed: boolean;
};

export type MedicineRow = {
  id: string;
  name: string;
  image_url: string | null;
  hospital_name: string;
};

const TABLET_COUNTS = ['1 tablet', '2 tablets', '½ tablet'] as const;
const TIMINGS = ['After breakfast', 'After lunch', 'After dinner'] as const;
const REMINDER_TIMES = ['8:00 AM', '1:00 PM', '8:00 PM'] as const;
const DOCTORS = [
  'Dr. Ananya Rao',
  'Dr. Vikram Reddy',
  'Dr. Meera Sharma',
] as const;

function hashId(id: string): number {
  return Array.from(id).reduce((total, character) => {
    return total + (character.codePointAt(0) ?? 0);
  }, 0);
}

export function getHospitalInitials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !['HOSPITAL', 'HOSPITALS'].includes(word.toUpperCase()));

  if (words.length === 0) {
    return 'H';
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function mapMedicineRows(rows: MedicineRow[]): Medicine[] {
  return rows
    .filter((row) => Boolean(row.image_url?.trim()))
    .slice(0, 3)
    .map((row) => {
      const hash = hashId(row.id);
      const scheduleIndex = Math.floor(hash / 3) % TIMINGS.length;

      return {
        completed: false,
        doctorName: DOCTORS[Math.floor(hash / 9) % DOCTORS.length]!,
        hospitalName: row.hospital_name,
        id: row.id,
        imageUrl: row.image_url!.trim(),
        name: row.name,
        nextReminderTime: REMINDER_TIMES[scheduleIndex]!,
        tabletCount: TABLET_COUNTS[hash % TABLET_COUNTS.length]!,
        timing: TIMINGS[scheduleIndex]!,
      };
    });
}
