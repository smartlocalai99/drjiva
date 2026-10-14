// OI-TI / IUI treatment cycles (pure logic, no React). Day 1 = first day of
// the woman's period; the database works out every step's date (a step on
// day N is on Day 1 + (N - 1); IUI is always the trigger date + 1).

import { daysBetween } from './careSchedule';

export type CycleWho = 'wife' | 'husband' | 'couple';

export type CareCycleStep = {
  id: string;
  code: string;
  day: number;
  labelEn: string;
  labelTe: string;
  who: CycleWho;
  noteEn: string | null;
  noteTe: string | null;
  baseDate: string;
  date: string;
  status: 'done' | 'not_needed' | null;
  doneOn: string | null;
  nurseName: string | null;
};

export type CareCycle = {
  id: string;
  kind: 'cycle';
  protocol: string;
  titleEn: string;
  titleTe: string;
  lengthDays: number;
  personName: string;
  partnerName: string | null;
  anchorDate: string;
  status: 'active' | 'positive' | 'negative' | 'stopped';
  hospitalId: string;
  hospitalName: string;
  doctorName: string | null;
  steps: CareCycleStep[];
};

// Steps of the OI-TI / IUI protocol the app treats specially.
export const TRIGGER_CODE = 'oi_trigger';
export const IUI_CODE = 'oi_iui';
export const TEST_CODE = 'oi_urine_pregnancy_test';

/** Best days for intercourse: the trigger day and the IUI / timed-intercourse day. */
export function bestDates(cycle: Pick<CareCycle, 'steps'>): Set<string> {
  return new Set(cycle.steps.filter((step) => step.code === TRIGGER_CODE || step.code === IUI_CODE).map((step) => step.date));
}

/**
 * While she waits after the IUI (the day after it until the day before the
 * test, test not yet done): days left and the test date. Otherwise null.
 */
export function testCountdown(cycle: Pick<CareCycle, 'steps'>, today: string): { date: string; days: number } | null {
  const iui = cycle.steps.find((step) => step.code === IUI_CODE);
  const test = cycle.steps.find((step) => step.code === TEST_CODE);
  if (!iui || !test || test.status || today <= iui.date || today >= test.date) return null;
  return { date: test.date, days: daysBetween(today, test.date) };
}

/** Day of the cycle for a date (Day 1 = anchor). */
export function cycleDayOf(cycle: Pick<CareCycle, 'anchorDate'>, date: string): number {
  return daysBetween(cycle.anchorDate, date) + 1;
}

/** Number of days the day strip shows: the protocol, or longer if a step moved later. */
export function cycleLength(cycle: Pick<CareCycle, 'anchorDate' | 'lengthDays' | 'steps'>): number {
  const last = cycle.steps.reduce((max, step) => Math.max(max, cycleDayOf(cycle, step.date)), 1);
  return Math.max(cycle.lengthDays || 1, last);
}

export function stepsOn(cycle: Pick<CareCycle, 'steps'>, date: string): CareCycleStep[] {
  return cycle.steps.filter((step) => step.date === date);
}

/** The next step still to do, today or later. */
export function nextCycleStep(cycle: Pick<CareCycle, 'steps'>, today: string): CareCycleStep | null {
  return (
    [...cycle.steps]
      .filter((step) => !step.status && step.date >= today)
      .sort((a, b) => (a.date === b.date ? a.day - b.day : a.date < b.date ? -1 : 1))[0] ?? null
  );
}

export type CycleStepDay = { date: string; day: number; steps: CareCycleStep[] };

const isFinished = (step: CareCycleStep) => step.status === 'done' || step.status === 'not_needed';

/** Steps grouped by date, earliest first. */
export function cycleStepDays(cycle: Pick<CareCycle, 'anchorDate' | 'steps'>): CycleStepDay[] {
  const byDate = new Map<string, CareCycleStep[]>();
  for (const step of cycle.steps) byDate.set(step.date, [...(byDate.get(step.date) ?? []), step]);
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([date, steps]) => ({ date, day: cycleDayOf(cycle, date), steps }));
}

/** The next few dates (today or later) that still have something to do. */
export function upcomingStepDays(cycle: Pick<CareCycle, 'anchorDate' | 'steps'>, today: string, limit: number): CycleStepDay[] {
  return cycleStepDays(cycle)
    .filter((group) => group.date >= today && group.steps.some((step) => !isFinished(step)))
    .map((group) => ({ ...group, steps: group.steps.filter((step) => !isFinished(step)) }))
    .slice(0, limit);
}

/** Days of the cycle that have a step, with whether all of that day's steps are done. */
export function stepDays(cycle: Pick<CareCycle, 'anchorDate' | 'steps'>): Map<number, { done: boolean }> {
  const days = new Map<number, { done: boolean }>();
  for (const step of cycle.steps) {
    const day = cycleDayOf(cycle, step.date);
    const done = isFinished(step);
    const current = days.get(day);
    days.set(day, { done: current ? current.done && done : done });
  }
  return days;
}
