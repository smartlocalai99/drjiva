import type { CourseDuration } from './medicineSchedule';

export const PRESET_COURSE_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export type CourseDurationPickerSelection =
  | 'custom'
  | 'ongoing'
  | 'preset';

export function getCourseDurationPickerSelection(
  value: CourseDuration,
): CourseDurationPickerSelection {
  if (value.mode === 'ongoing') return 'ongoing';
  return PRESET_COURSE_DAYS.some((days) => days === value.days)
    ? 'preset'
    : 'custom';
}
