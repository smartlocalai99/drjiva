import { describe, expect, it } from 'vitest';

import { mapDoseRows } from './medicineCourse';

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
