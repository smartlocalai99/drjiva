import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import type { CareVaccineRecord } from '../../lib/care';
import { useCareCopy } from '../../lib/careCopy';
import { childAge, type CarePlan } from '../../lib/careSchedule';
import { childDisplayName, childVisits, currentChildVisit } from '../../lib/childGrowth';
import { ChildAgeStrip } from './ChildAgeStrip';
import { ChildHero } from './ChildHero';
import { ChildVisitCard } from './ChildVisitCard';
import { careFonts } from './careStyles';

// The child page: a photo for the child's age, the name, age and date of
// birth, then `children` (the next visit card), then the Child Growth
// Chart (visits by age, each with its vaccines). Read only: the nurse marks
// vaccines given in her portal.
export function ChildGrowthSection({
  bleedTop,
  children,
  plan,
  records,
  today,
}: {
  bleedTop: boolean;
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

  return (
    <>
      <ChildHero
        ageText={ageText(c, birthDate, today)}
        birthDate={birthDate}
        bleedTop={bleedTop}
        name={childDisplayName(plan.personName, c('childNoName'))}
        today={today}
      />
      {children}
      {selected ? (
        <>
          <Text accessibilityRole="header" style={styles.title}>{c('childGrowthTitle')}</Text>
          <ChildAgeStrip onSelect={setSelectedId} selectedId={selected.visit.id} visits={visits} />
          <ChildVisitCard total={visits.length} visit={selected} />
        </>
      ) : null}
    </>
  );
}

function ageText(c: ReturnType<typeof useCareCopy>['c'], birthDate: string, today: string): string {
  const age = childAge(birthDate, today);
  if (age.unit === 'week') return age.value === 0 ? c('ageNewborn') : age.value === 1 ? c('ageWeek1') : c('ageWeeks', { n: age.value });
  if (age.unit === 'month') return age.value === 1 ? c('ageMonth1') : c('ageMonths', { n: age.value });
  return age.value === 1 ? c('ageYear1') : c('ageYears', { n: age.value });
}

const styles = StyleSheet.create({
  title: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 21,
    lineHeight: 27,
    marginBottom: -4,
    marginTop: 6,
  },
});
