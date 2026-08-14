import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View, type ColorValue } from 'react-native';

import {
  isMedicineStreakDayComplete,
  type MedicineStreakDay,
} from '../data/medicineCourse';
import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from '../dashboardTheme';
import { formatDateOnly } from '../lib/medicineCalendar';

type CourseStreakRowProps = {
  accentColor: ColorValue;
  backgroundColor: ColorValue;
  days: readonly MedicineStreakDay[];
  ongoing?: boolean;
};

export function CourseStreakRow({
  accentColor,
  backgroundColor,
  days,
  ongoing = false,
}: CourseStreakRowProps) {
  const [now, setNow] = useState(Date.now);
  const nextCompletionTime = useMemo(
    () =>
      days.reduce<number | null>((next, day) => {
        if (isMedicineStreakDayComplete(day, now) || !day.completesAt) {
          return next;
        }
        const completionTime = new Date(day.completesAt).getTime();
        if (Number.isNaN(completionTime) || completionTime <= now) {
          return next;
        }
        return next === null || completionTime < next
          ? completionTime
          : next;
      }, null),
    [days, now],
  );

  useEffect(() => {
    if (nextCompletionTime === null) return;
    const remaining = Math.max(0, nextCompletionTime - Date.now());
    const timeout = setTimeout(
      () => setNow(Date.now()),
      Math.min(remaining + 50, 2_147_483_647),
    );
    return () => clearTimeout(timeout);
  }, [nextCompletionTime]);

  if (days.length === 0) return null;

  const today = formatDateOnly(new Date());

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <View style={styles.heading}>
        <Ionicons color={dashboardColors.warning} name="flame" size={14} />
        <Text selectable style={styles.title}>
          {ongoing ? 'This week' : 'Course streak'}
        </Text>
      </View>

      <View style={styles.days}>
        {days.map((day) => {
          const isToday = day.date === today;
          const isCompleted = isMedicineStreakDayComplete(day, now);

          return (
            <View
              accessibilityLabel={`${day.weekday} ${day.day}${
                isCompleted
                  ? ', completed'
                  : day.scheduled
                    ? ', scheduled'
                    : ''
              }`}
              accessible
              key={day.date}
              style={styles.day}
            >
              <Text
                style={[
                  styles.weekday,
                  isToday && { color: accentColor },
                ]}
              >
                {day.weekday.slice(0, 1)}
              </Text>

              <View
                style={[
                  styles.dateBubble,
                  day.scheduled && styles.dateBubbleScheduled,
                  isToday && {
                    borderColor: accentColor,
                    borderWidth: 1.5,
                  },
                ]}
              >
                {isCompleted ? (
                  <Ionicons
                    color={dashboardColors.warning}
                    name="flame"
                    size={17}
                  />
                ) : (
                  <Text
                    style={[
                      styles.date,
                      !day.scheduled && styles.dateMuted,
                      isToday && { color: accentColor },
                    ]}
                  >
                    {day.day}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomColor: 'rgba(255,255,255,0.72)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 6,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: 8,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  title: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  days: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: 3,
    width: 28,
  },
  weekday: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    lineHeight: 11,
  },
  dateBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  dateBubbleScheduled: {
    backgroundColor: '#FFFFFF',
  },
  date: {
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  dateMuted: {
    color: dashboardColors.textFaint,
  },
});
