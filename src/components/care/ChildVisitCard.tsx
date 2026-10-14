import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { MILESTONES, type ChildDose, type ChildStage, type ChildVisit } from '../../lib/childGrowth';
import { PressableScale } from '../PressableScale';
import { CHILD_STATUS, StatusPill } from './ChildStatus';
import { careFonts, careShared } from './careStyles';

// Free photos (credited in Profile → Photo credits), one child cut out of
// each: what a child of that age looks like.
export const CHILD_IMAGES: Record<ChildStage, number> = {
  crawl: require('../../../assets/care/child/crawl.webp'),
  headup: require('../../../assets/care/child/headup.webp'),
  newborn: require('../../../assets/care/child/newborn.webp'),
  run: require('../../../assets/care/child/run.webp'),
  school: require('../../../assets/care/child/school.webp'),
  sit: require('../../../assets/care/child/sit.webp'),
  smile: require('../../../assets/care/child/smile.webp'),
  stand: require('../../../assets/care/child/stand.webp'),
  walk: require('../../../assets/care/child/walk.webp'),
};

const GIVEN = '#16A34A';

// The top of the child page: a picture of a child at the chosen visit's
// age beside the child's name, then what most children do at that age, the
// exact due date and status, and the vaccines (tap one to record it).
export function ChildVisitCard({
  ageNow,
  autoReminder,
  childName,
  onDose,
  onEdit,
  onMarkComplete,
  onToggleReminder,
  reminderOn,
  total,
  visit,
}: {
  ageNow: string;
  autoReminder: boolean;
  childName: string;
  onDose: (dose: ChildDose) => void;
  onEdit: () => void;
  onMarkComplete: () => void;
  onToggleReminder: () => void;
  reminderOn: boolean;
  total: number;
  visit: ChildVisit;
}) {
  const { c, date, language, pick } = useCareCopy();
  const doses = visit.doses.filter((dose) => dose.kind !== 'optional');
  // Doses that must wait longer than the visit date (an earlier dose was late).
  const waiting = doses.filter((dose) => dose.shifted && !dose.given && !dose.notNeeded && dose.dueDate > visit.dueDate);
  const completed = visit.status === 'completed';
  const isTenYears = /_10y$/.test(visit.visit.code);
  const ageTitle = pick(visit.visit.titleEn, visit.visit.titleTe);

  return (
    <View style={careShared.card}>
      <View style={styles.hero}>
        <View style={styles.photoBox}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel={ageTitle}
            contentFit="contain"
            source={CHILD_IMAGES[visit.age.stage]}
            style={styles.photo}
            transition={200}
          />
        </View>
        <View style={styles.heroText}>
          <View style={styles.heroTitleRow}>
            <Text style={styles.chartTitle}>{c('childGrowthTitle')}</Text>
            <PressableScale accessibilityLabel={c('childEditTitle')} accessibilityRole="button" hitSlop={8} onPress={onEdit} style={styles.edit}>
              <Ionicons color={dashboardColors.primary} name="create-outline" size={18} />
            </PressableScale>
          </View>
          <Text numberOfLines={2} style={styles.name}>{childName}</Text>
          <Text style={styles.ageNow}>{ageNow}</Text>
          <View style={styles.visitRow}>
            <Text style={styles.age}>{ageTitle}</Text>
            <StatusPill status={visit.status} />
          </View>
          <Text style={styles.meta}>
            {date(visit.dueDate)} · {c('visitOf', { n: visit.number, total })}
          </Text>
        </View>
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
            <DoseChip dose={dose} key={dose.item.id} onPress={() => onDose(dose)} status={visit.status} />
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

      {completed ? (
        visit.givenOn ? (
          <View style={styles.given}>
            <Ionicons color={GIVEN} name="checkmark-circle" size={22} />
            <Text style={styles.givenText}>{c('givenOnDate', { date: date(visit.givenOn) })}</Text>
          </View>
        ) : null
      ) : (
        <>
          <View style={styles.actions}>
            <PressableScale accessibilityRole="button" onPress={onMarkComplete} style={[styles.button, styles.buttonPrimary]}>
              <Ionicons color="#FFFFFF" name="checkmark-done" size={20} />
              <Text style={styles.buttonPrimaryText}>{c('markComplete')}</Text>
            </PressableScale>
            <PressableScale
              accessibilityRole="switch"
              accessibilityState={{ checked: reminderOn, disabled: autoReminder }}
              disabled={autoReminder}
              onPress={onToggleReminder}
              style={[styles.button, reminderOn && styles.buttonOn]}
            >
              <Ionicons color={dashboardColors.primary} name={reminderOn ? 'notifications' : 'notifications-outline'} size={20} />
              <Text style={styles.buttonText}>{c(reminderOn ? 'reminderSet' : 'createReminder')}</Text>
            </PressableScale>
          </View>
          {reminderOn ? <Text style={styles.note}>{c('reminderAuto')}</Text> : null}
        </>
      )}
    </View>
  );
}

function DoseChip({ dose, onPress, status }: { dose: ChildDose; onPress: () => void; status: ChildVisit['status'] }) {
  const { c, pick } = useCareCopy();
  const given = Boolean(dose.given);
  const label = pick(dose.item.labelEn, dose.item.labelTe);
  const accent = CHILD_STATUS[status];
  return (
    <PressableScale
      accessibilityHint={c('vaccineGivenOn')}
      accessibilityLabel={given ? `${label}, ${c('vaccineGiven')}` : label}
      accessibilityRole="button"
      onPress={onPress}
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
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  age: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 18,
    lineHeight: 23,
  },
  ageNow: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  chartTitle: {
    color: dashboardColors.primary,
    flex: 1,
    fontFamily: careFonts.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  edit: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  heroText: {
    flex: 1,
    gap: 3,
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 24,
    letterSpacing: -0.3,
    lineHeight: 29,
  },
  photoBox: {
    alignItems: 'center',
    backgroundColor: '#F3F7FB',
    borderCurve: 'continuous',
    borderRadius: 22,
    height: 172,
    justifyContent: 'center',
    width: 132,
  },
  visitRow: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    gap: 6,
    marginTop: 8,
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
  button: {
    alignItems: 'center',
    borderColor: dashboardColors.primaryTint,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
  },
  buttonOn: {
    backgroundColor: dashboardColors.primaryTint,
  },
  buttonPrimary: {
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.primary,
  },
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontFamily: careFonts.bold,
    fontSize: 16,
  },
  buttonText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 16,
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
  photo: {
    height: 156,
    width: 120,
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
