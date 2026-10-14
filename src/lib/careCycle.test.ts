import { describe, expect, it } from 'vitest';

import {
  cycleDayOf,
  cycleLength,
  cycleStepDays,
  nextCycleStep,
  stepDays,
  stepsOn,
  upcomingStepDays,
  type CareCycle,
  type CareCycleStep,
} from './careCycle';

function step(id: string, day: number, date: string, extra: Partial<CareCycleStep> = {}): CareCycleStep {
  return { baseDate: date, code: id, date, day, doneOn: null, id, labelEn: id, labelTe: id, noteEn: null, noteTe: null, nurseName: null, status: null, who: 'wife', ...extra };
}

const cycle: Pick<CareCycle, 'anchorDate' | 'lengthDays' | 'steps'> = {
  anchorDate: '2026-10-06',
  lengthDays: 31,
  steps: [
    step('scan', 2, '2026-10-07', { status: 'done' }),
    step('semen', 2, '2026-10-07', { who: 'husband' }),
    step('follicle', 9, '2026-10-14'),
    step('trigger', 13, '2026-10-19'), // moved a day later by the nurse
    step('iui', 14, '2026-10-20', { who: 'couple' }),
    step('upt', 31, '2026-11-05'),
  ],
};

describe('OI-TI / IUI cycle', () => {
  it('counts Day 1 as the anchor', () => {
    expect(cycleDayOf(cycle, '2026-10-06')).toBe(1);
    expect(cycleDayOf(cycle, '2026-10-14')).toBe(9);
  });

  it('finds the steps of a day and the next one to do', () => {
    expect(stepsOn(cycle, '2026-10-07').map((s) => s.id)).toEqual(['scan', 'semen']);
    expect(nextCycleStep(cycle, '2026-10-14')?.id).toBe('follicle');
    expect(nextCycleStep(cycle, '2026-10-15')?.id).toBe('trigger');
    expect(nextCycleStep(cycle, '2026-11-06')).toBeNull();
  });

  it('marks step days, done only when every step that day is done', () => {
    const days = stepDays(cycle);
    expect(days.get(2)).toEqual({ done: false });
    expect(days.get(14)).toEqual({ done: false });
    expect(days.has(3)).toBe(false);
  });

  it('groups steps by date and lists what is still to do', () => {
    expect(cycleStepDays(cycle).map((group) => [group.day, group.steps.length])).toEqual([[2, 2], [9, 1], [14, 1], [15, 1], [31, 1]]);
    expect(upcomingStepDays(cycle, '2026-10-07', 2).map((group) => [group.day, group.steps.map((s) => s.id)])).toEqual([
      [2, ['semen']],
      [9, ['follicle']],
    ]);
    expect(upcomingStepDays(cycle, '2026-10-15', 5).map((group) => group.day)).toEqual([14, 15, 31]);
  });

  it('shows at least the protocol length, longer if a step moved later', () => {
    expect(cycleLength(cycle)).toBe(31);
    expect(cycleLength({ ...cycle, steps: [...cycle.steps, step('late', 31, '2026-11-08')] })).toBe(34);
  });
});
