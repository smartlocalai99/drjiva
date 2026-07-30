import { describe, expect, it } from 'vitest';

import {
  buildMedicineStreak,
  mapDoseRows,
  selectNearestMedicine,
  selectNearestSession,
  shouldCompleteCourse,
} from './medicineCourse';

function localScheduledFor(day: number, hour: number): string {
  return new Date(2026, 6, day, hour).toISOString();
}

describe('buildMedicineStreak', () => {
  it('shows scheduled dates only and checks only fully completed days', () => {
    const streak = buildMedicineStreak(
      '2026-07-28',
      10,
      [
        { scheduledFor: localScheduledFor(28, 8), status: 'completed' },
        { scheduledFor: localScheduledFor(28, 20), status: 'completed' },
        { scheduledFor: localScheduledFor(30, 8), status: 'completed' },
        { scheduledFor: localScheduledFor(30, 20), status: 'scheduled' },
      ],
      '2026-07-30',
    );

    expect(streak).toEqual([
      {
        completed: true,
        date: '2026-07-28',
        day: 28,
        scheduled: true,
        weekday: 'Tue',
      },
      {
        completed: false,
        date: '2026-07-30',
        day: 30,
        scheduled: true,
        weekday: 'Thu',
      },
    ]);
  });

  it('shows only the number of scheduled course dates and caps the strip at seven', () => {
    const events = Array.from({ length: 10 }, (_, index) => ({
      scheduledFor: localScheduledFor(28 + index, 8),
      status: 'scheduled',
    }));

    expect(buildMedicineStreak('2026-07-28', 2, events)).toHaveLength(2);
    expect(buildMedicineStreak('2026-07-28', 10, events)).toHaveLength(7);
  });

  it('turns a scheduled course day into a streak after that day passes', () => {
    const streak = buildMedicineStreak(
      '2026-07-30',
      2,
      [{ scheduledFor: localScheduledFor(30, 8), status: 'scheduled' }],
      '2026-07-31',
    );

    expect(streak[0]?.completed).toBe(true);
  });

  it('replaces today’s date with a streak after its scheduled time passes', () => {
    const event = {
      scheduledFor: localScheduledFor(30, 8),
      status: 'scheduled',
    };

    expect(
      buildMedicineStreak(
        '2026-07-30',
        1,
        [event],
        new Date(2026, 6, 30, 7, 59),
      )[0]?.completed,
    ).toBe(false);
    expect(
      buildMedicineStreak(
        '2026-07-30',
        1,
        [event],
        new Date(2026, 6, 30, 8, 1),
      )[0]?.completed,
    ).toBe(true);
  });

  it('waits for every scheduled time on a course day before showing its streak', () => {
    const events = [
      { scheduledFor: localScheduledFor(30, 8), status: 'scheduled' },
      { scheduledFor: localScheduledFor(30, 20), status: 'scheduled' },
    ];

    expect(
      buildMedicineStreak(
        '2026-07-30',
        1,
        events,
        new Date(2026, 6, 30, 9),
      )[0]?.completed,
    ).toBe(false);
    expect(
      buildMedicineStreak(
        '2026-07-30',
        1,
        events,
        new Date(2026, 6, 30, 20, 1),
      )[0]?.completed,
    ).toBe(true);
  });
});

describe('mapDoseRows', () => {
  it('keeps stored dose values and the database medicine image', () => {
    expect(
      mapDoseRows([
        {
          completed: true,
          courseId: 'course-1',
          eventId: 'event-1',
          hospitalName: 'Medico Hospital',
          imageUrl: 'https://db.test/dolo.jpg',
          medicineName: 'Dolo 650',
          scheduledFor: '2026-07-28T08:00:00.000Z',
          slot: 'morning',
          tabletsPerDose: 1.5,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        completed: true,
        courseId: 'course-1',
        id: 'event-1',
        imageUrl: 'https://db.test/dolo.jpg',
        slot: 'morning',
        tabletCount: '1.5 tablets',
        timing: 'Morning',
      }),
    ]);
  });

  it('keeps a dose whose catalogue medicine has no image', () => {
    expect(
      mapDoseRows([
        {
          completed: false,
          courseId: 'course-1',
          eventId: 'event-1',
          hospitalName: 'Hospital',
          imageUrl: '',
          medicineName: 'Unknown',
          scheduledFor: '2026-07-28T08:00:00.000Z',
          slot: 'morning',
          tabletsPerDose: 1,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'event-1',
        imageUrl: '',
        name: 'Unknown',
      }),
    ]);
  });
});

describe('shouldCompleteCourse', () => {
  it('completes only when no scheduled doses remain', () => {
    expect(shouldCompleteCourse(0)).toBe(true);
    expect(shouldCompleteCourse(1)).toBe(false);
  });
});

describe('dose order', () => {
  it('keeps every dose for the day in chronological order', () => {
    const doses = mapDoseRows([
      {
        completed: false,
        courseId: 'course-1',
        eventId: 'night',
        hospitalName: 'Hospital',
        imageUrl: '',
        medicineName: 'Night medicine',
        scheduledFor: '2026-07-28T20:00:00+05:30',
        slot: 'night',
        tabletsPerDose: 1,
      },
      {
        completed: false,
        courseId: 'course-1',
        eventId: 'morning',
        hospitalName: 'Hospital',
        imageUrl: '',
        medicineName: 'Morning medicine',
        scheduledFor: '2026-07-28T08:00:00+05:30',
        slot: 'morning',
        tabletsPerDose: 1,
      },
      {
        completed: false,
        courseId: 'course-1',
        eventId: 'afternoon',
        hospitalName: 'Hospital',
        imageUrl: '',
        medicineName: 'Afternoon medicine',
        scheduledFor: '2026-07-28T13:00:00+05:30',
        slot: 'afternoon',
        tabletsPerDose: 1,
      },
    ]);

    expect(doses.map((dose) => dose.id)).toEqual([
      'morning',
      'afternoon',
      'night',
    ]);
  });
});

describe('selectNearestMedicine', () => {
  const medicines = mapDoseRows([
    {
      completed: false,
      courseId: 'course-1',
      eventId: 'morning',
      hospitalName: 'Hospital',
      imageUrl: '',
      medicineName: 'Morning medicine',
      scheduledFor: '2026-07-28T08:00:00+05:30',
      slot: 'morning',
      tabletsPerDose: 1,
    },
    {
      completed: false,
      courseId: 'course-2',
      eventId: 'night',
      hospitalName: 'Hospital',
      imageUrl: '',
      medicineName: 'Night medicine',
      scheduledFor: '2026-07-28T20:00:00+05:30',
      slot: 'night',
      tabletsPerDose: 1,
    },
  ]);

  it('returns only the nearest upcoming dose', () => {
    expect(
      selectNearestMedicine(
        medicines,
        new Date('2026-07-28T12:00:00+05:30'),
      )?.id,
    ).toBe('night');
  });

  it('returns the closest overdue dose when nothing remains upcoming', () => {
    expect(
      selectNearestMedicine(
        medicines,
        new Date('2026-07-28T22:00:00+05:30'),
      )?.id,
    ).toBe('night');
  });
});

describe('selectNearestSession', () => {
  it('returns every medicine in the nearest upcoming dose slot', () => {
    const medicines = mapDoseRows([
      {
        completed: false,
        courseId: 'course-1',
        eventId: 'morning-1',
        hospitalName: 'Hospital',
        imageUrl: '',
        medicineName: 'Tablet one',
        scheduledFor: '2026-07-30T08:00:00+05:30',
        slot: 'morning',
        tabletsPerDose: 1,
      },
      {
        completed: false,
        courseId: 'course-2',
        eventId: 'morning-2',
        hospitalName: 'Hospital',
        imageUrl: '',
        medicineName: 'Tablet two',
        scheduledFor: '2026-07-30T08:30:00+05:30',
        slot: 'morning',
        tabletsPerDose: 1,
      },
      {
        completed: false,
        courseId: 'course-3',
        eventId: 'night',
        hospitalName: 'Hospital',
        imageUrl: '',
        medicineName: 'Night tablet',
        scheduledFor: '2026-07-30T20:00:00+05:30',
        slot: 'night',
        tabletsPerDose: 1,
      },
    ]);

    expect(
      selectNearestSession(
        medicines,
        new Date('2026-07-30T07:00:00+05:30'),
      ).map((medicine) => medicine.id),
    ).toEqual(['morning-1', 'morning-2']);
  });
});
