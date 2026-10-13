import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import {
  daysBetween,
  pregnancyWeek,
  timeline,
  trimester,
  type CarePlan,
  type TimelineEntry,
} from '../../lib/careSchedule';
import { CareTimeline } from './CareTimeline';
import { careFonts, careShared } from './careStyles';
import { VisitSheet } from './VisitSheet';

export function PregnancySection({
  everyVisitLine,
  onNotForMe,
  plan,
  today,
}: {
  everyVisitLine: string | null;
  onNotForMe: () => void;
  plan: CarePlan;
  today: string;
}) {
  const { c, date } = useCareCopy();
  const [showPast, setShowPast] = useState(false);
  const [openVisit, setOpenVisit] = useState<TimelineEntry | null>(null);
  const week = pregnancyWeek(plan, today);
  const { past, rest } = timeline(plan, today);
  const weekLabel = (entry: TimelineEntry) => {
    const from = Math.round(daysBetween(plan.startDate, entry.visit.fromDate) / 7);
    const to = Math.round((daysBetween(plan.startDate, entry.visit.toDate) + 1) / 7) - 1;
    return from === to ? c('week', { week: from }) : c('weeks', { from, to });
  };

  return (
    <View style={careShared.card}>
      <View>
        <Text style={careShared.label}>{c('pregnancy')}</Text>
        <Text style={careShared.cardTitle}>{plan.personName}</Text>
      </View>

      <View style={styles.progressBlock}>
        <Text style={styles.week}>{c('weekOf40', { week })}</Text>
        <View accessibilityLabel={c('weekOf40', { week })} accessibilityRole="progressbar" style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(100, (week / 40) * 100)}%` }]} />
        </View>
        <View style={styles.metaRow}>
          <Text style={careShared.muted}>{c(`trimester${trimester(week)}`)}</Text>
          {plan.eddDate ? <Text style={careShared.muted}>{c('dueDate', { date: date(plan.eddDate) })}</Text> : null}
        </View>
      </View>

      {everyVisitLine ? (
        <View style={styles.everyVisit}>
          <Ionicons color={dashboardColors.primary} name="repeat" size={18} />
          <Text style={[styles.everyVisitText]}>{everyVisitLine}</Text>
        </View>
      ) : null}

      {past.length > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => setShowPast((value) => !value)} style={styles.toggle}>
          <Text style={styles.toggleText}>{showPast ? c('hidePast') : c('showPast', { n: past.length })}</Text>
          <Ionicons color={dashboardColors.primary} name={showPast ? 'chevron-up' : 'chevron-down'} size={18} />
        </Pressable>
      ) : null}

      <CareTimeline entries={showPast ? [...past, ...rest] : rest} labelFor={weekLabel} onOpen={setOpenVisit} />

      <Pressable accessibilityRole="button" hitSlop={8} onPress={onNotForMe} style={styles.notForMe}>
        <Text style={styles.notForMeText}>{c('notForMe')}</Text>
      </Pressable>

      <VisitSheet
        onClose={() => setOpenVisit(null)}
        subtitle={openVisit ? weekLabel(openVisit) : ''}
        today={today}
        visit={openVisit?.visit ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  fill: {
    backgroundColor: dashboardColors.primary,
    borderRadius: 6,
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 2,
  },
  notForMe: {
    alignSelf: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  notForMeText: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    textDecorationLine: 'underline',
  },
  progressBlock: {
    gap: 8,
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
  track: {
    backgroundColor: dashboardColors.track,
    borderRadius: 6,
    height: 12,
    overflow: 'hidden',
  },
  week: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
});
