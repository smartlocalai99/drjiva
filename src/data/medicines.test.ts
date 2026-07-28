import { describe, expect, it } from 'vitest';

import { mapDoseRows, selectRelevantDoseRows } from './medicineCourse';

describe('mapDoseRows', () => {
  it('keeps stored dose values and the database medicine image', () => {
    expect(
      mapDoseRows([
        {
          completed: true,
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
        id: 'event-1',
        imageUrl: 'https://db.test/dolo.jpg',
        tabletCount: '1.5 tablets',
        timing: 'Morning',
      }),
    ]);
  });

  it('rejects a dose whose catalogue medicine has no image', () => {
    expect(
      mapDoseRows([
        {
          completed: false,
          eventId: 'event-1',
          hospitalName: 'Hospital',
          imageUrl: '',
          medicineName: 'Unknown',
          scheduledFor: '2026-07-28T08:00:00.000Z',
          slot: 'morning',
          tabletsPerDose: 1,
        },
      ]),
    ).toEqual([]);
  });
});

describe('selectRelevantDoseRows', () => {
  it('drops a morning dose after the afternoon window begins', () => {
    const rows = [
      {
        completed: false,
        eventId: 'morning',
        hospitalName: 'Hospital',
        imageUrl: 'https://db.test/m.jpg',
        medicineName: 'Medicine',
        scheduledFor: '2026-07-28T08:00:00+05:30',
        slot: 'morning',
        tabletsPerDose: 1,
      },
      {
        completed: false,
        eventId: 'night',
        hospitalName: 'Hospital',
        imageUrl: 'https://db.test/m.jpg',
        medicineName: 'Medicine',
        scheduledFor: '2026-07-28T20:00:00+05:30',
        slot: 'night',
        tabletsPerDose: 1,
      },
    ];
    expect(
      selectRelevantDoseRows(
        rows,
        new Date('2026-07-28T18:00:00+05:30'),
        { afternoon: '13:00', morning: '08:00', night: '20:00' },
      ).map((row) => row.eventId),
    ).toEqual(['night']);
  });
});
