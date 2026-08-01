import type { CourseDuration } from './medicineSchedule';

export const PRESET_COURSE_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const CUSTOM_DURATION_ACCESSORY_ID =
  'custom-course-duration-accessory';

export function getCourseDurationKeyboardConfig(isIOS: boolean) {
  return {
    behavior: isIOS ? ('padding' as const) : undefined,
    dismissMode: isIOS ? ('interactive' as const) : ('on-drag' as const),
    inputAccessoryViewID: isIOS ? CUSTOM_DURATION_ACCESSORY_ID : undefined,
  };
}

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
