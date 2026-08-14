import { describe, expect, it } from 'vitest';

import {
  buildMedicineStreak,
  buildCurrentWeekMedicineStreak,
  mapDoseRows,
  selectNearestMedicine,
  selectNearestSession,
  shouldCompleteCourse,
} from './medicineCourse';

function localScheduledFor(day: number, hour: number): string {
  return new Date(2026, 6, day, hour).toISOString();
}

describe('buildMedicineStreak', () => {
  it('groups ongoing adherence into the current Monday-to-Sunday week', () => {
    const week = buildCurrentWeekMedicineStreak(
      '2026-07-20',
      [
        { scheduledFor: localScheduledFor(27, 8), status: 'completed' },
        { scheduledFor: localScheduledFor(28, 8), status: 'scheduled' },
      ],
      new Date(2026, 6, 28, 7, 59),
    );
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ date: '2026-07-27', completed: true });
    expect(week[1]).toMatchObject({ date: '2026-07-28', completed: false });
  });

  it('shows the ongoing-course flame after every reminder time is reached', () => {
    const events = [
      { scheduledFor: localScheduledFor(30, 8), status: 'scheduled' },
      { scheduledFor: localScheduledFor(30, 20), status: 'scheduled' },
    ];

    expect(
      buildCurrentWeekMedicineStreak(
        '2026-07-20',
        events,
        new Date(2026, 6, 30, 19, 59),
      ).find((day) => day.date === '2026-07-30')?.completed,
    ).toBe(false);

    expect(
      buildCurrentWeekMedicineStreak(
        '2026-07-20',
        events,
        new Date(2026, 6, 30, 20),
      ).find((day) => day.date === '2026-07-30')?.completed,
    ).toBe(true);
  });
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
      new Date(2026, 6, 30, 19, 59),
    );

    expect(streak).toEqual([
      {
        completed: true,
        completesAt: null,
        date: '2026-07-28',
        day: 28,
        scheduled: true,
        weekday: 'Tue',
      },
      {
        completed: false,
        completesAt: localScheduledFor(30, 20),
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

  it('replaces today’s date with a streak when its reminder time is reached', () => {
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
        new Date(2026, 6, 30, 8),
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
        new Date(2026, 6, 30, 20),
      )[0]?.completed,
    ).toBe(true);
  });
});

describe('mapDoseRows', () => {
  it('keeps the Dhruva catalogue image and hospital on Today', () => {
    expect(
      mapDoseRows([
        {
          completed: false,
          courseId: 'dhruva-course',
          eventId: 'dhruva-event',
          hospitalName: 'Dhruva Hospitals',
          imageUrl: 'https://db.test/dhruva/medicine.jpg',
          medicineName: 'AB NORM-100',
          scheduledFor: '2026-08-13T08:00:00.000Z',
          slot: 'morning',
          tabletsPerDose: 1,
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        hospitalName: 'Dhruva Hospitals',
        imageUrl: 'https://db.test/dhruva/medicine.jpg',
        name: 'AB NORM-100',
      }),
    ]);
  });

  it('keeps stored dose values and the database medicine image', () => {
    expect(
      mapDoseRows([
        {
          completed: true,
          courseId: 'course-1',
          description: 'Pain and fever relief',
          durationDays: 7,
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
        description: 'Pain and fever relief',
        durationDays: 7,
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
      eventId: 'afternoon',
      hospitalName: 'Hospital',
      imageUrl: '',
      medicineName: 'Afternoon medicine',
      scheduledFor: '2026-07-28T13:00:00+05:30',
      slot: 'afternoon',
      tabletsPerDose: 1,
    },
    {
      completed: false,
      courseId: 'course-3',
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
    ).toBe('afternoon');
  });

  it('advances from morning to afternoon when the morning time is reached', () => {
    expect(
      selectNearestMedicine(
        medicines,
        new Date('2026-07-28T07:59:59+05:30'),
      )?.id,
    ).toBe('morning');
    expect(
      selectNearestMedicine(
        medicines,
        new Date('2026-07-28T08:00:00+05:30'),
      )?.id,
    ).toBe('afternoon');
  });

  it('advances from afternoon to night when the afternoon time is reached', () => {
    expect(
      selectNearestMedicine(
        medicines,
        new Date('2026-07-28T12:59:59+05:30'),
      )?.id,
    ).toBe('afternoon');
    expect(
      selectNearestMedicine(
        medicines,
        new Date('2026-07-28T13:00:00+05:30'),
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
