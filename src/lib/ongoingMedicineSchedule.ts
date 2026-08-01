import {
  expandDoseEvents,
  type DoseSlot,
  type DraftDoseEvent,
} from './medicineSchedule';

export function buildRollingDoseEvents(
  course: {
    slotTimes: Partial<Record<DoseSlot, string>>;
    slots: readonly DoseSlot[];
  },
  fromDate: string,
  horizonDays = 14,
): DraftDoseEvent[] {
  if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 31) {
    throw new Error('Invalid ongoing reminder horizon.');
  }
  return expandDoseEvents({
    dayPattern: 'daily',
    durationDays: horizonDays,
    slotTimes: course.slotTimes,
    slots: course.slots,
    startDate: fromDate,
  });
}
