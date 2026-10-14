import { useMemo, useState, type ReactNode } from 'react';

import type { CareVaccineRecord } from '../../lib/care';
import { useCareCopy } from '../../lib/careCopy';
import { childAge, type CarePlan } from '../../lib/careSchedule';
import { childVisits, currentChildVisit } from '../../lib/childGrowth';
import { ChildAgeStrip } from './ChildAgeStrip';
import { ChildVisitCard } from './ChildVisitCard';

// Child Growth Chart: the strip of visits by age on top, the chosen visit
// (picture of a child that age, what most children do, the vaccines with
// exact dates), then `children` (the next visit card). Read only: the nurse
// marks vaccines given in her portal.
export function ChildGrowthSection({
  children,
  plan,
  records,
  today,
}: {
  children?: ReactNode;
  plan: CarePlan;
  records: readonly CareVaccineRecord[];
  today: string;
}) {
  const { c } = useCareCopy();
  const visits = useMemo(() => childVisits(plan, records, today), [plan, records, today]);
  const current = currentChildVisit(visits);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visits.find((visit) => visit.visit.id === selectedId) ?? current;
  const birthDate = plan.birthDate ?? plan.startDate;

  if (!selected) return null;
  return (
    <>
      <ChildAgeStrip onSelect={setSelectedId} selectedId={selected.visit.id} visits={visits} />
      <ChildVisitCard ageNow={ageText(c, birthDate, today)} total={visits.length} visit={selected} />
      {children}
    </>
  );
}

function ageText(c: ReturnType<typeof useCareCopy>['c'], birthDate: string, today: string): string {
  const age = childAge(birthDate, today);
  if (age.unit === 'week') return age.value === 0 ? c('ageNewborn') : age.value === 1 ? c('ageWeek1') : c('ageWeeks', { n: age.value });
  if (age.unit === 'month') return age.value === 1 ? c('ageMonth1') : c('ageMonths', { n: age.value });
  return age.value === 1 ? c('ageYear1') : c('ageYears', { n: age.value });
}
