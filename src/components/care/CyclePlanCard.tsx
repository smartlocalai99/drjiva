import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { cycleStepDays, nextCycleStep, type CareCycle } from '../../lib/careCycle';
import { WhoTag } from './CycleWho';
import { careFonts, careShared } from './careStyles';

const DONE = '#16A34A';

// The whole cycle at a glance: every hospital day with its date and who
// has to come; the next one is highlighted.
export function CyclePlanCard({ cycle, today }: { cycle: CareCycle; today: string }) {
  const { c, date, pick } = useCareCopy();
  const groups = cycleStepDays(cycle);
  const nextDate = nextCycleStep(cycle, today)?.date ?? null;

  return (
    <View style={careShared.card}>
      <View style={styles.head}>
        <Text style={careShared.cardTitle}>{c('cyclePlan')}</Text>
        <Text style={careShared.muted}>{c('cycleDayOne', { date: date(cycle.anchorDate, 'weekdayDayMonth') })}</Text>
      </View>

      <View>
        {groups.map((group, index) => {
          const isNext = group.date === nextDate;
          return (
            <View
              key={group.date}
              style={[styles.row, index > 0 && !isNext && groups[index - 1]?.date !== nextDate && styles.rowLine, isNext && styles.rowNext]}
            >
              <View style={styles.when}>
                <Text style={styles.day}>{c('cycleDay', { n: group.day })}</Text>
                <Text style={styles.date}>{date(group.date, 'weekdayDayMonth')}</Text>
                {isNext ? (
                  <View style={styles.nextPill}>
                    <Text style={styles.nextText}>{c('cycleNextBadge')}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.steps}>
                {group.steps.map((step) => {
                  const done = step.status === 'done' || step.status === 'not_needed';
                  return (
                    <View key={step.id} style={styles.step}>
                      <View style={styles.stepText}>
                        <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{pick(step.labelEn, step.labelTe)}</Text>
                        <WhoTag onTint={isNext} who={step.who} />
                      </View>
                      {done ? (
                        <Ionicons accessibilityLabel={c('cycleDone')} color={DONE} name="checkmark-circle" size={22} />
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      {cycle.doctorName || cycle.hospitalName ? (
        <View style={styles.footer}>
          <Ionicons color={dashboardColors.textMuted} name="person-circle-outline" size={20} />
          <Text style={[careShared.muted, styles.flex]}>{[cycle.doctorName, cycle.hospitalName].filter(Boolean).join(' · ')}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  date: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  day: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  flex: { flex: 1 },
  footer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  head: {
    gap: 2,
  },
  nextPill: {
    alignSelf: 'flex-start',
    backgroundColor: dashboardColors.primary,
    borderRadius: 999,
    marginTop: 4,
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  nextText: {
    color: '#FFFFFF',
    fontFamily: careFonts.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  rowLine: {
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowNext: {
    backgroundColor: dashboardColors.primaryTint,
    borderCurve: 'continuous',
    borderRadius: 16,
  },
  step: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stepLabel: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 16,
    lineHeight: 21,
  },
  stepLabelDone: {
    color: dashboardColors.textMuted,
  },
  stepText: {
    flex: 1,
    gap: 3,
  },
  steps: {
    flex: 1,
    gap: 10,
  },
  when: {
    width: 92,
  },
});
