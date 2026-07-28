import { describe, expect, it } from 'vitest';

import {
  generateCourseDates,
  getActiveDose,
  replaceEventSlotTime,
  validateMedicineCourseInput,
} from './medicineSchedule';

const validInput = {
  durationDays: 5,
  hospitalId: 'hospital-1',
  medicineId: 'medicine-1',
  slots: ['morning'] as const,
  tabletsPerDose: 1,
};

describe('medicine course validation', () => {
  it('requires catalogue and schedule selections', () => {
    expect(validateMedicineCourseInput({ ...validInput, hospitalId: '' })).toBe(
      'missingHospital',
    );
    expect(validateMedicineCourseInput({ ...validInput, medicineId: '' })).toBe(
      'missingMedicine',
    );
    expect(validateMedicineCourseInput({ ...validInput, slots: [] })).toBe(
      'missingSlot',
    );
  });

  it('accepts only bounded quarter tablets and course duration', () => {
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 0.3 })).toBe(
      'invalidTabletQuantity',
    );
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 0 })).toBe(
      'invalidTabletQuantity',
    );
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 10.25 })).toBe(
      'invalidTabletQuantity',
    );
    expect(validateMedicineCourseInput({ ...validInput, durationDays: 0 })).toBe(
      'invalidCourseDuration',
    );
    expect(validateMedicineCourseInput({ ...validInput, durationDays: 366 })).toBe(
      'invalidCourseDuration',
    );
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 0.25 })).toBe(
      null,
    );
  });
});

describe('replaceEventSlotTime', () => {
  it('keeps the calendar date while replacing its local slot time', () => {
    const changed = replaceEventSlotTime(
      '2026-07-28T08:00:00+05:30',
      '09:15',
    );
    const date = new Date(changed);
    expect([date.getHours(), date.getMinutes()]).toEqual([9, 15]);
    expect(date.getDate()).toBe(28);
  });
});

describe('generateCourseDates', () => {
  it('generates daily and alternate dates within the duration span', () => {
    expect(generateCourseDates('2026-07-28', 5, 'daily')).toEqual([
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ]);
    expect(generateCourseDates('2026-07-28', 5, 'alternate')).toEqual([
      '2026-07-28',
      '2026-07-30',
      '2026-08-01',
    ]);
  });
});

describe('getActiveDose', () => {
  const events = [
    { id: 'morning', scheduledFor: '2026-07-28T08:00:00+05:30' },
    { id: 'afternoon', scheduledFor: '2026-07-28T13:00:00+05:30' },
    { id: 'night', scheduledFor: '2026-07-28T20:00:00+05:30' },
  ];

  it('returns the current slot and expires the final slot at midnight', () => {
    expect(
      getActiveDose(events, new Date('2026-07-28T10:00:00+05:30'))?.id,
    ).toBe('morning');
    expect(
      getActiveDose(events, new Date('2026-07-28T18:00:00+05:30'))?.id,
    ).toBe('afternoon');
    expect(
      getActiveDose(events, new Date('2026-07-29T00:01:00+05:30')),
    ).toBeNull();
  });
});
