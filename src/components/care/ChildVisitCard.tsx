import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { MILESTONES, type ChildDose, type ChildVisit } from '../../lib/childGrowth';
import { CHILD_STATUS, StatusPill } from './ChildStatus';
import { careFonts, careShared } from './careStyles';

const GIVEN = '#16A34A';

// One visit of the Child Growth Chart: its date and status, what most
// children do at that age and the vaccines. The nurse marks vaccines given
// in her portal; parents only read.
export function ChildVisitCard({ total, visit }: { total: number; visit: ChildVisit }) {
  const { c, date, language, pick } = useCareCopy();
  const doses = visit.doses.filter((dose) => dose.kind !== 'optional');
  // Doses that must wait longer than the visit date (an earlier dose was late).
  const waiting = doses.filter((dose) => dose.shifted && !dose.given && !dose.notNeeded && dose.dueDate > visit.dueDate);
  const completed = visit.status === 'completed';
  const isTenYears = /_10y$/.test(visit.visit.code);
  const ageTitle = pick(visit.visit.titleEn, visit.visit.titleTe);

  return (
    <View style={careShared.card}>
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.age}>{ageTitle}</Text>
          <StatusPill status={visit.status} />
        </View>
        <Text style={styles.meta}>
          {date(visit.dueDate)} · {c('visitOf', { n: visit.number, total })}
        </Text>
      </View>

      <View style={styles.facts}>
        <Text style={styles.canDo}>{visit.age.unit === 'birth' ? c('childCanDoBirth') : c('childCanDoAt', { age: ageTitle })}</Text>
        {MILESTONES[visit.age.milestones].map(([en, te]) => (
          <View key={en} style={styles.milestone}>
            <View style={styles.bullet} />
            <Text style={styles.milestoneText}>{language === 'te' ? te : en}</Text>
          </View>
        ))}
        <Text style={styles.note}>{c('childCanDoNote')}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>{c('vaccinesTitle')}</Text>
        <View style={styles.chips}>
          {doses.map((dose) => (
            <DoseChip dose={dose} key={dose.item.id} status={visit.status} />
          ))}
        </View>
        {waiting.map((dose) => (
          <View key={dose.item.id} style={styles.shift}>
            <Ionicons color="#B45309" name="time-outline" size={18} />
            <Text style={styles.shiftText}>
              {c('shiftedDose', { date: date(dose.dueDate), vaccine: pick(dose.item.labelEn, dose.item.labelTe) })}
            </Text>
          </View>
        ))}
      </View>

      {isTenYears ? (
        <View style={styles.hpv}>
          <Ionicons color={dashboardColors.primary} name="information-circle" size={20} />
          <Text style={[careShared.body, styles.flex]}>{c('hpvNote')}</Text>
        </View>
      ) : null}

      {completed && visit.givenOn ? (
        <View style={styles.given}>
          <Ionicons color={GIVEN} name="checkmark-circle" size={22} />
          <Text style={styles.givenText}>{c('givenOnDate', { date: date(visit.givenOn) })}</Text>
        </View>
      ) : null}
    </View>
  );
}

function DoseChip({ dose, status }: { dose: ChildDose; status: ChildVisit['status'] }) {
  const { c, pick } = useCareCopy();
  const given = Boolean(dose.given);
  const label = pick(dose.item.labelEn, dose.item.labelTe);
  const accent = CHILD_STATUS[status];
  return (
    <View
      accessibilityLabel={given ? `${label}, ${c('vaccineGiven')}` : label}
      accessible
      style={[
        styles.chip,
        given
          ? styles.chipGiven
          : dose.notNeeded
            ? styles.chipSkipped
            : { borderColor: status === 'upcoming' ? dashboardColors.track : accent.dot },
        dose.kind === 'onlyIf' && !given && styles.chipOnlyIf,
      ]}
    >
      {given ? <Ionicons color={GIVEN} name="checkmark-circle" size={18} /> : null}
      <Text style={[styles.chipText, given && styles.chipTextGiven, dose.notNeeded && styles.chipTextSkipped]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  age: {
    color: dashboardColors.text,
    flexShrink: 1,
    fontFamily: careFonts.bold,
    fontSize: 24,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  block: {
    gap: 10,
  },
  blockTitle: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  bullet: {
    backgroundColor: dashboardColors.primary,
    borderRadius: 3,
    height: 6,
    marginTop: 8,
    width: 6,
  },
  canDo: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 14,
    lineHeight: 19,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderCurve: 'continuous',
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipGiven: {
    backgroundColor: '#E9F9EF',
    borderColor: '#E9F9EF',
  },
  chipOnlyIf: {
    borderStyle: 'dashed',
  },
  chipSkipped: {
    backgroundColor: dashboardColors.bg,
    borderColor: dashboardColors.bg,
  },
  chipText: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  chipTextGiven: {
    color: '#15803D',
  },
  chipTextSkipped: {
    color: dashboardColors.textMuted,
    textDecorationLine: 'line-through',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  facts: {
    gap: 8,
  },
  flex: { flex: 1 },
  given: {
    alignItems: 'center',
    backgroundColor: '#E9F9EF',
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  givenText: {
    color: '#15803D',
    flex: 1,
    fontFamily: careFonts.bold,
    fontSize: 16,
  },
  hpv: {
    backgroundColor: dashboardColors.primaryTint,
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  meta: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 14,
    lineHeight: 19,
  },
  milestone: {
    flexDirection: 'row',
    gap: 8,
  },
  milestoneText: {
    color: dashboardColors.text,
    flex: 1,
    fontFamily: careFonts.semiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  note: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  shift: {
    alignItems: 'center',
    backgroundColor: dashboardColors.warningTint,
    borderCurve: 'continuous',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 6,
    padding: 10,
  },
  shiftText: {
    color: '#92400E',
    flex: 1,
    fontFamily: careFonts.semiBold,
    fontSize: 14,
    lineHeight: 19,
  },
});
