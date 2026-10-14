import { describe, expect, it } from 'vitest';

import {
  bestDates,
  cycleDayOf,
  cycleNextVisit,
  cycleLength,
  cycleStepDays,
  nextCycleStep,
  stepDays,
  stepsOn,
  testCountdown,
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

  it('marks the trigger day and the IUI day as the best days', () => {
    const real = {
      steps: [
        step('t', 13, '2026-10-19', { code: 'oi_trigger' }),
        step('i', 14, '2026-10-20', { code: 'oi_iui', who: 'couple' }),
        step('f', 9, '2026-10-14', { code: 'oi_follicle_d9' }),
      ],
    };
    expect([...bestDates(real)].sort()).toEqual(['2026-10-19', '2026-10-20']);
  });

  it('counts down to the pregnancy test only while waiting after the IUI', () => {
    const real = {
      steps: [
        step('i', 14, '2026-10-20', { code: 'oi_iui', who: 'couple' }),
        step('u', 31, '2026-11-05', { code: 'oi_urine_pregnancy_test' }),
      ],
    };
    expect(testCountdown(real, '2026-10-20')).toBeNull(); // IUI day itself
    expect(testCountdown(real, '2026-10-21')).toEqual({ date: '2026-11-05', days: 15 });
    expect(testCountdown(real, '2026-11-04')).toEqual({ date: '2026-11-05', days: 1 });
    expect(testCountdown(real, '2026-11-05')).toBeNull(); // test day shows the step
    expect(testCountdown({ steps: [real.steps[0]!, { ...real.steps[1]!, status: 'done' }] }, '2026-10-25')).toBeNull();
  });

  it('builds a next-visit card from the next step when the nurse saved none', () => {
    const full = {
      ...cycle,
      doctorName: 'Dr. Mounika',
      hospitalId: 'h1',
      hospitalName: 'Dhruva Hospitals',
      hospitalPhone: '0000000000',
      id: 'c1',
      kind: 'cycle' as const,
      partnerName: null,
      personName: 'A',
      protocol: 'oi_ti_iui',
      status: 'active' as const,
      titleEn: 'OI-TI / IUI',
      titleTe: 'OI-TI / IUI',
    };
    const card = cycleNextVisit(full, '2026-10-15');
    expect(card).toMatchObject({ doctorName: 'Dr. Mounika', nextDate: '2026-10-19', nurseName: '', hospital: { id: 'h1', logoUrl: null, name: 'Dhruva Hospitals', phone: '0000000000' } });
    expect(cycleNextVisit(full, '2026-11-06')).toBeNull();
  });
});
