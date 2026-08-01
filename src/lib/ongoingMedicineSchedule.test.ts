import { describe, expect, it } from 'vitest';

import { buildRollingDoseEvents } from './ongoingMedicineSchedule';

describe('ongoing medicine scheduling', () => {
  it('builds a unique daily rolling horizon for each selected slot', () => {
    const events = buildRollingDoseEvents(
      {
        slotTimes: { morning: '08:00', night: '20:00' },
        slots: ['morning', 'night'],
      },
      '2026-08-01',
      14,
    );

    expect(events).toHaveLength(28);
    expect(new Set(events.map((event) => `${event.slot}:${event.scheduledFor}`)).size).toBe(28);
  });
});
