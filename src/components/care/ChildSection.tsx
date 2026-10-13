import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { childAge, timeline, type CarePlan, type TimelineEntry } from '../../lib/careSchedule';
import { CareTimeline } from './CareTimeline';
import { careFonts, careShared } from './careStyles';
import { VisitSheet } from './VisitSheet';

export function ChildSection({
  everyVisit,
  onNotForMe,
  plan,
  today,
}: {
  everyVisit: { line: string | null; untilMonths: number | null };
  onNotForMe: () => void;
  plan: CarePlan;
  today: string;
}) {
  const { c, date } = useCareCopy();
  const [showAll, setShowAll] = useState(false);
  const [openVisit, setOpenVisit] = useState<TimelineEntry | null>(null);
  const birthDate = plan.birthDate ?? plan.startDate;
  const age = childAge(birthDate, today);
  const ageText =
    age.unit === 'week'
      ? age.value === 0 ? c('ageNewborn') : age.value === 1 ? c('ageWeek1') : c('ageWeeks', { n: age.value })
      : age.unit === 'month'
        ? age.value === 1 ? c('ageMonth1') : c('ageMonths', { n: age.value })
        : age.value === 1 ? c('ageYear1') : c('ageYears', { n: age.value });
  const ageMonths = age.unit === 'year' ? age.value * 12 : age.unit === 'month' ? age.value : 0;
  const showEveryVisit = Boolean(everyVisit.line) && (everyVisit.untilMonths === null || ageMonths < everyVisit.untilMonths);

  // Focus on what matters now: anything still pending, the current
  // visit and the next two. The rest is behind "Show full schedule".
  const { past, rest } = timeline(plan, today);
  const pending = rest.filter((entry) => entry.state === 'pending');
  const ahead = rest.filter((entry) => entry.state !== 'pending');
  const focused = [...pending, ...ahead.slice(0, 3)];
  const entries = showAll ? [...past, ...rest] : focused;
  const hiddenCount = past.length + rest.length - focused.length;
  const dateLabel = (entry: TimelineEntry) =>
    entry.visit.fromDate === entry.visit.toDate
      ? date(entry.visit.fromDate, 'dayMonth')
      : `${date(entry.visit.fromDate, 'dayMonth')} – ${date(entry.visit.toDate, 'dayMonth')}`;

  return (
    <View style={careShared.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Ionicons color={dashboardColors.primary} name="happy-outline" size={26} />
        </View>
        <View style={styles.flex}>
          <Text style={careShared.cardTitle}>{plan.personName}</Text>
          <Text style={styles.age}>{ageText}</Text>
        </View>
      </View>
      <Text style={careShared.label}>{c('vaccines')}</Text>

      {showEveryVisit ? (
        <View style={styles.everyVisit}>
          <Ionicons color={dashboardColors.primary} name="repeat" size={18} />
          <Text style={styles.everyVisitText}>{everyVisit.line}</Text>
        </View>
      ) : null}

      <CareTimeline entries={entries} labelFor={dateLabel} onOpen={setOpenVisit} />

      {hiddenCount > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setShowAll((value) => !value)} style={styles.toggle}>
          <Text style={styles.toggleText}>{showAll ? c('showLessVisits') : c('showMoreVisits')}</Text>
          <Ionicons color={dashboardColors.primary} name={showAll ? 'chevron-up' : 'chevron-down'} size={18} />
        </Pressable>
      ) : null}

      <Pressable accessibilityRole="button" hitSlop={8} onPress={onNotForMe} style={styles.notForMe}>
        <Text style={styles.notForMeText}>{c('notForMe')}</Text>
      </Pressable>

      <VisitSheet
        onClose={() => setOpenVisit(null)}
        subtitle={openVisit ? dateLabel(openVisit) : ''}
        today={today}
        visit={openVisit?.visit ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  age: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  everyVisit: {
    alignItems: 'flex-start',
    backgroundColor: dashboardColors.primaryTint,
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  everyVisitText: {
    color: dashboardColors.text,
    flex: 1,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  flex: { flex: 1 },
  head: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  notForMe: {
    alignSelf: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  notForMeText: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  toggle: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: 6,
    minHeight: 44,
  },
  toggleText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 16,
  },
});
