import { useState, type ReactNode } from 'react';

import { cycleDayOf, cycleLength, type CareCycle } from '../../lib/careCycle';
import { CycleDayCard } from './CycleDayCard';
import { CycleDayStrip } from './CycleDayStrip';
import { CyclePlanCard } from './CyclePlanCard';

// OI-TI / IUI: the day of the treatment in place of the baby's week.
// Opens on today; the strip picks any other day. `children` (the next
// visit card) goes between the strip and the full plan.
export function CycleSection({ children, cycle, today }: { children?: ReactNode; cycle: CareCycle; today: string }) {
  const length = cycleLength(cycle);
  const todayDay = cycleDayOf(cycle, today);
  const startDay = Math.min(Math.max(todayDay, 1), length);
  // A pick only lasts while the day is the same; a new day starts on it.
  const [pick, setPick] = useState({ day: startDay, fromDay: startDay });
  const day = pick.fromDay === startDay ? Math.min(pick.day, length) : startDay;

  return (
    <>
      <CycleDayCard cycle={cycle} day={day} length={length} today={today} />
      <CycleDayStrip cycle={cycle} length={length} onSelect={(next) => setPick({ day: next, fromDay: startDay })} selectedDay={day} todayDay={todayDay} />
      {children}
      <CyclePlanCard cycle={cycle} today={today} />
    </>
  );
}
