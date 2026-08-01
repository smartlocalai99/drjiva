import { describe, expect, it } from 'vitest';

import {
  adjustTabletCount,
  expandDoseEvents,
  generateCourseDates,
  getActiveDose,
  parseCustomCourseDays,
  replaceEventSlotTime,
  validateMedicineCourseInput,
  validateCourseDuration,
} from './medicineSchedule';

describe('course duration', () => {
  it('accepts finite courses through 365 days and open-ended Everyday', () => {
    expect(validateCourseDuration({ days: 7, mode: 'finite' })).toBeNull();
    expect(
      validateCourseDuration({ days: 8, mode: 'finite' } as never),
    ).toBeNull();
    expect(
      validateCourseDuration({ days: 365, mode: 'finite' } as never),
    ).toBeNull();
    expect(validateCourseDuration({ mode: 'ongoing' })).toBeNull();
    expect(
      validateCourseDuration({ days: 366, mode: 'finite' } as never),
    ).toBe('invalidCourseDuration');
  });

  it('parses only whole custom day values from 1 through 365', () => {
    expect(parseCustomCourseDays(' 30 ')).toBe(30);
    expect(parseCustomCourseDays('365')).toBe(365);
    expect(parseCustomCourseDays('')).toBeNull();
    expect(parseCustomCourseDays('   ')).toBeNull();
    expect(parseCustomCourseDays('1.5')).toBeNull();
    expect(parseCustomCourseDays('0')).toBeNull();
    expect(parseCustomCourseDays('-1')).toBeNull();
    expect(parseCustomCourseDays('366')).toBeNull();
    expect(parseCustomCourseDays('30days')).toBeNull();
  });
});

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

  it('accepts only bounded whole tablets and course duration', () => {
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 0.5 })).toBe(
      'invalidTabletQuantity',
    );
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 0 })).toBe(
      'invalidTabletQuantity',
    );
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 11 })).toBe(
      'invalidTabletQuantity',
    );
    expect(validateMedicineCourseInput({ ...validInput, durationDays: 0 })).toBe(
      'invalidCourseDuration',
    );
    expect(validateMedicineCourseInput({ ...validInput, durationDays: 366 })).toBe(
      'invalidCourseDuration',
    );
    expect(
      validateMedicineCourseInput({ ...validInput, durationDays: 365 }),
    ).toBeNull();
    expect(validateMedicineCourseInput({ ...validInput, tabletsPerDose: 10 })).toBe(
      null,
    );
  });
});

describe('adjustTabletCount', () => {
  it('steps by one whole tablet in either direction', () => {
    expect(adjustTabletCount('1', 1)).toBe('2');
    expect(adjustTabletCount('2', -1)).toBe('1');
  });

  it('clamps to the minimum and maximum bounds', () => {
    expect(adjustTabletCount('1', -1)).toBe('1');
    expect(adjustTabletCount('10', 1)).toBe('10');
  });

  it('falls back to a base of 1 for unparsable input', () => {
    expect(adjustTabletCount('', 1)).toBe('2');
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

describe('expandDoseEvents', () => {
  it('keeps a different saved time for each selected period', () => {
    const events = expandDoseEvents({
      dayPattern: 'alternate',
      durationDays: 3,
      slotTimes: { morning: '09:15', night: '21:30' },
      slots: ['morning', 'night'],
      startDate: '2026-07-28',
    });

    expect(events).toHaveLength(4);
    expect(
      events.slice(0, 2).map((event) => [
        event.slot,
        new Date(event.scheduledFor).getHours(),
        new Date(event.scheduledFor).getMinutes(),
      ]),
    ).toEqual([
      ['morning', 9, 15],
      ['night', 21, 30],
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
