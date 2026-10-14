import { Ionicons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { cycleDayOf, nextCycleStep, stepDays, stepsOn, type CareCycle } from '../../lib/careCycle';
import { addDaysIso } from '../../lib/careSchedule';
import { WhoTag } from './CycleWho';
import { careFonts, careShared } from './careStyles';

const DIAL = 128;
const RING = 52;
const DONE = '#16A34A';

// One day of the treatment: a dial of the whole cycle (step days marked)
// on the left, what happens that day on the right.
export function CycleDayCard({
  cycle,
  day,
  length,
  today,
}: {
  cycle: CareCycle;
  day: number;
  length: number;
  today: string;
}) {
  const { c, date, pick } = useCareCopy();
  const todayDay = cycleDayOf(cycle, today);
  const dayDate = addDaysIso(cycle.anchorDate, day - 1);
  const steps = stepsOn(cycle, dayDate);
  const next = steps.length ? null : nextCycleStep(cycle, dayDate);
  // Advice is for before a step ("avoid intercourse 3–5 days before").
  const notes = steps.filter((step) => !step.status).map((step) => pick(step.noteEn ?? '', step.noteTe ?? '')).filter(Boolean);
  const notStarted = todayDay < 1;

  return (
    <View style={careShared.card}>
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.day}>{c('cycleDay', { n: day })}</Text>
          {day === todayDay ? (
            <View style={styles.nowPill}>
              <Text style={styles.nowText}>{c('today')}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[careShared.muted, styles.meta]}>
          {notStarted ? c('cycleStarts', { date: date(cycle.anchorDate, 'weekdayDayMonth') }) : `${date(dayDate, 'weekdayDayMonth')} · ${pick(cycle.titleEn, cycle.titleTe)}`}
        </Text>
      </View>

      <View style={styles.body}>
        <CycleDial cycle={cycle} length={length} selectedDay={day} todayDay={todayDay} />

        <View style={styles.facts}>
          {steps.length ? (
            steps.map((step) => {
              const done = step.status === 'done' || step.status === 'not_needed';
              return (
                <View accessibilityLabel={`${pick(step.labelEn, step.labelTe)}${done ? `, ${c('cycleDone')}` : ''}`} accessible key={step.id} style={styles.step}>
                  <Ionicons
                    color={done ? DONE : dashboardColors.primary}
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    style={styles.stepIcon}
                  />
                  <View style={styles.stepText}>
                    <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{pick(step.labelEn, step.labelTe)}</Text>
                    <WhoTag who={step.who} />
                  </View>
                </View>
              );
            })
          ) : (
            <>
              <Text style={careShared.muted}>{c('cycleNoStep')}</Text>
              {next ? (
                <View style={styles.next}>
                  <Text style={styles.nextLabel}>{c('cycleNext', { step: pick(next.labelEn, next.labelTe) })}</Text>
                  <Text style={careShared.muted}>
                    {c('cycleNextOn', { date: date(next.date, 'weekdayDayMonth'), n: cycleDayOf(cycle, next.date) })}
                  </Text>
                </View>
              ) : day > todayDay ? null : (
                <Text style={careShared.body}>{c('cycleOver')}</Text>
              )}
            </>
          )}
        </View>
      </View>

      {notes.map((note) => (
        <View key={note} style={styles.note}>
          <Ionicons color="#B45309" name="information-circle" size={20} style={styles.noteIcon} />
          <Text style={[careShared.body, styles.flex]}>{note}</Text>
        </View>
      ))}
    </View>
  );
}

// Every day of the cycle round a circle, starting at the top: big dots
// on step days (green once done), small ones for the rest, a ring on the
// day shown.
function CycleDial({ cycle, length, selectedDay, todayDay }: { cycle: CareCycle; length: number; selectedDay: number; todayDay: number }) {
  const { c } = useCareCopy();
  const marks = stepDays(cycle);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.dial}>
      {Array.from({ length }, (_, index) => {
        const day = index + 1;
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / length;
        const mark = marks.get(day);
        const size = mark ? 10 : 5;
        const color = mark
          ? mark.done
            ? DONE
            : dashboardColors.primary
          : day <= todayDay
            ? '#9DBAD6'
            : dashboardColors.track;
        const x = DIAL / 2 + RING * Math.cos(angle);
        const y = DIAL / 2 + RING * Math.sin(angle);
        return (
          <Fragment key={day}>
            {day === selectedDay ? <View style={[styles.ring, { left: x - 10, top: y - 10 }]} /> : null}
            <View style={[styles.dot, { backgroundColor: color, borderRadius: size / 2, height: size, left: x - size / 2, top: y - size / 2, width: size }]} />
          </Fragment>
        );
      })}
      <View style={styles.dialCenter}>
        <Text style={styles.dialLabel}>{c('dayShort')}</Text>
        <Text style={styles.dialNumber}>{selectedDay}</Text>
        <Text style={styles.dialLabel}>{c('cycleOfDays', { n: length })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  day: {
    color: dashboardColors.text,
    flexShrink: 1,
    fontFamily: careFonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  dial: {
    height: DIAL,
    width: DIAL,
  },
  dialCenter: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  dialLabel: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  dialNumber: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 36,
    letterSpacing: -1,
    lineHeight: 42,
  },
  dot: {
    position: 'absolute',
  },
  facts: {
    flex: 1,
    gap: 10,
  },
  flex: { flex: 1 },
  meta: {
    marginTop: 2,
  },
  next: {
    gap: 2,
  },
  nextLabel: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 17,
    lineHeight: 23,
  },
  note: {
    backgroundColor: dashboardColors.warningTint,
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  noteIcon: {
    marginTop: 2,
  },
  nowPill: {
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  nowText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 15,
  },
  ring: {
    borderColor: dashboardColors.text,
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    position: 'absolute',
    width: 20,
  },
  step: {
    flexDirection: 'row',
    gap: 8,
  },
  stepIcon: {
    marginTop: 1,
  },
  stepLabel: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
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
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
});
