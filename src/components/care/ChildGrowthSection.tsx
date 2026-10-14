import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import type { CareVaccineRecord } from '../../lib/care';
import { markVisitGiven, ChildCareError } from '../../lib/careChild';
import type { ChildReminderPrefs } from '../../lib/careChildPrefs';
import { useCareCopy } from '../../lib/careCopy';
import { childAge, type CarePlan } from '../../lib/careSchedule';
import { childDisplayName, childVisits, currentChildVisit, type ChildDose, type ChildVisit } from '../../lib/childGrowth';
import { PressableScale } from '../PressableScale';
import { CareDateField } from './CareDateField';
import { CareSheet } from './CareSheet';
import { ChildAgeStrip } from './ChildAgeStrip';
import { ChildFormSheet } from './ChildFormSheet';
import { ChildOptionalCard } from './ChildOptionalCard';
import { ChildVisitCard } from './ChildVisitCard';
import { VaccineSheet } from './VaccineSheet';
import { careFonts } from './careStyles';

// Child Growth Chart: the child at each visit's age, the vaccines with exact
// dates, and a strip of every visit by age. `children` (the next visit card)
// goes under the strip.
export function ChildGrowthSection({
  children,
  onPlanChanged,
  onPrefs,
  onRecords,
  phone,
  plan,
  prefs,
  records,
  today,
}: {
  children?: ReactNode;
  onPlanChanged: (plan: CarePlan) => void;
  onPrefs: (prefs: ChildReminderPrefs) => void;
  onRecords: (records: CareVaccineRecord[]) => void;
  phone: string;
  plan: CarePlan;
  prefs: ChildReminderPrefs;
  records: readonly CareVaccineRecord[];
  today: string;
}) {
  const { c, date, pick } = useCareCopy();
  const visits = useMemo(() => childVisits(plan, records, today), [plan, records, today]);
  const current = currentChildVisit(visits);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = visits.find((visit) => visit.visit.id === selectedId) ?? current;
  const [dose, setDose] = useState<ChildDose | null>(null);
  const [marking, setMarking] = useState<ChildVisit | null>(null);
  const [editing, setEditing] = useState(false);
  const birthDate = plan.birthDate ?? plan.startDate;
  const optional = visits.flatMap((visit) => visit.doses.filter((item) => item.kind === 'optional'));

  const toggleVisitReminder = (visitId: string) => {
    const on = prefs.visits.includes(visitId);
    onPrefs({ ...prefs, visits: on ? prefs.visits.filter((id) => id !== visitId) : [...prefs.visits, visitId] });
  };
  const toggleOptional = (itemId: string, on: boolean) => {
    onPrefs({ ...prefs, optional: on ? [...new Set([...prefs.optional, itemId])] : prefs.optional.filter((id) => id !== itemId) });
  };

  if (!selected) return null;
  return (
    <>
      <ChildVisitCard
        ageNow={ageText(c, birthDate, today)}
        autoReminder={selected.visit.id === current?.visit.id}
        childName={childDisplayName(plan.personName, c('childNoName'))}
        onDose={setDose}
        onEdit={() => setEditing(true)}
        onMarkComplete={() => setMarking(selected)}
        onToggleReminder={() => toggleVisitReminder(selected.visit.id)}
        reminderOn={selected.visit.id === current?.visit.id || prefs.visits.includes(selected.visit.id)}
        total={visits.length}
        visit={selected}
      />
      <ChildAgeStrip onSelect={setSelectedId} selectedId={selected.visit.id} visits={visits} />
      {children}
      <ChildOptionalCard doses={optional} onDose={setDose} onToggle={toggleOptional} remindIds={new Set(prefs.optional)} />

      <VaccineSheet
        birthDate={birthDate}
        dose={dose}
        onClose={() => setDose(null)}
        onSaved={onRecords}
        phone={phone}
        planId={plan.id}
        today={today}
      />
      <MarkCompleteSheet
        birthDate={birthDate}
        onClose={() => setMarking(null)}
        onSaved={onRecords}
        phone={phone}
        planId={plan.id}
        subtitle={marking ? `${pick(marking.visit.titleEn, marking.visit.titleTe)} · ${date(marking.dueDate)}` : null}
        today={today}
        visit={marking}
      />
      <ChildFormSheet
        child={plan}
        onClose={() => setEditing(false)}
        onSaved={onPlanChanged}
        phone={phone}
        subtitle={null}
        today={today}
        visible={editing}
      />
    </>
  );
}

function ageText(c: ReturnType<typeof useCareCopy>['c'], birthDate: string, today: string): string {
  const age = childAge(birthDate, today);
  if (age.unit === 'week') return age.value === 0 ? c('ageNewborn') : age.value === 1 ? c('ageWeek1') : c('ageWeeks', { n: age.value });
  if (age.unit === 'month') return age.value === 1 ? c('ageMonth1') : c('ageMonths', { n: age.value });
  return age.value === 1 ? c('ageYear1') : c('ageYears', { n: age.value });
}

// "Mark as complete": every vaccine of the visit given on one day.
function MarkCompleteSheet({
  birthDate,
  onClose,
  onSaved,
  phone,
  planId,
  subtitle,
  today,
  visit,
}: {
  birthDate: string;
  onClose: () => void;
  onSaved: (records: CareVaccineRecord[]) => void;
  phone: string;
  planId: string;
  subtitle: string | null;
  today: string;
  visit: ChildVisit | null;
}) {
  const { c } = useCareCopy();
  const [givenOn, setGivenOn] = useState<string | null>(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!visit || !givenOn) return;
    setBusy(true);
    setError(null);
    try {
      onSaved(await markVisitGiven(phone, planId, visit.visit.id, givenOn));
      onClose();
    } catch (saveError) {
      setError(c(saveError instanceof ChildCareError ? saveError.copyKey : 'childErrSave'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <CareSheet onClose={onClose} subtitle={subtitle} title={c('markComplete')} visible={Boolean(visit)}>
      <CareDateField label={c('vaccineGivenOn')} max={today} min={birthDate} onChange={setGivenOn} value={givenOn} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <PressableScale accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.save, busy && styles.busy]}>
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveText}>{c('markComplete')}</Text>}
      </PressableScale>
    </CareSheet>
  );
}

const styles = StyleSheet.create({
  busy: {
    opacity: 0.6,
  },
  error: {
    color: '#B91C1C',
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  save: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderCurve: 'continuous',
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 54,
  },
  saveText: {
    color: '#FFFFFF',
    fontFamily: careFonts.bold,
    fontSize: 17,
  },
});
