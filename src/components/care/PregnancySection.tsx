import { useState } from 'react';

import { clampBabyWeek } from '../../lib/babySize';
import { pregnancyWeek, type CarePlan } from '../../lib/careSchedule';
import { BabyWeekCard } from './BabyWeekCard';
import { WeekStrip } from './WeekStrip';

// The baby this week, and a strip to look at any other week.
export function PregnancySection({ plan, today }: { plan: CarePlan; today: string }) {
  const actualWeek = pregnancyWeek(plan, today);
  const startWeek = clampBabyWeek(actualWeek);
  // A pick only lasts while the week is the same; a new week starts on it.
  const [pick, setPick] = useState({ fromWeek: startWeek, week: startWeek });
  const week = pick.fromWeek === startWeek ? pick.week : startWeek;

  return (
    <>
      <BabyWeekCard dueDate={plan.eddDate} isCurrent={week === actualWeek} week={week} />
      <WeekStrip
        currentWeek={actualWeek}
        onSelect={(next) => setPick({ fromWeek: startWeek, week: next })}
        selectedWeek={week}
      />
    </>
  );
}
