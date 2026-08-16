import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
} from '../../dashboardTheme';
import { addDays, dateKey, formatMonthDay, isSameDay, startOfWeek } from '../../lib/dates';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const WEEK_OFFSET_OPTIONS = [
  { label: 'This week', offset: 0 },
  { label: 'Next week', offset: 1 },
  { label: 'Week after', offset: 2 },
] as const;

function weekOffsetFor(weekStart: Date): number {
  return Math.round(
    (weekStart.getTime() - startOfWeek(new Date()).getTime()) / (7 * 86_400_000),
  );
}

// The week-range label + dropdown trigger, meant to sit in the page header
// (top-right). The menu it opens floats below itself regardless of where
// it's placed.
export function WeekRangeSelector({
  onSelectDate,
  onSelectWeekStart,
  weekStart,
}: {
  onSelectDate: (date: Date | null) => void;
  onSelectWeekStart: (date: Date) => void;
  weekStart: Date;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const weekEnd = addDays(weekStart, 6);
  const activeOffset = weekOffsetFor(weekStart);

  const handlePickWeek = (offset: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onSelectWeekStart(addDays(startOfWeek(new Date()), offset * 7));
    onSelectDate(null);
    setMenuOpen(false);
  };

  return (
    <View style={styles.selectorWrap}>
      <Pressable
        accessibilityLabel="Choose a different week"
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setMenuOpen((open) => !open)}
        style={styles.weekLabelButton}
      >
        <Text style={styles.weekLabel} numberOfLines={1}>
          {formatMonthDay(weekStart)} – {formatMonthDay(weekEnd)}
        </Text>
        <Ionicons
          color={dashboardColors.textMuted}
          name={menuOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
        />
      </Pressable>

      {menuOpen ? (
        <>
          <Pressable onPress={() => setMenuOpen(false)} style={styles.menuScrim} />
          <View style={styles.menu}>
            {WEEK_OFFSET_OPTIONS.map((option) => {
              const active = option.offset === activeOffset;
              return (
                <Pressable
                  key={option.offset}
                  onPress={() => handlePickWeek(option.offset)}
                  style={[styles.menuItem, active && styles.menuItemActive]}
                >
                  <Text style={[styles.menuItemText, active && styles.menuItemTextActive]}>
                    {option.label}
                  </Text>
                  {active ? (
                    <Ionicons color={dashboardColors.primary} name="checkmark" size={16} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </View>
  );
}

// The 7-day row for the given week. Tapping a day narrows the list to it;
// tapping the same day again clears back to the whole week.
export function WeekDayStrip({
  eventDateKeys,
  onSelectDate,
  selectedDate,
  weekStart,
}: {
  eventDateKeys: Set<string>;
  onSelectDate: (date: Date | null) => void;
  selectedDate: Date | null;
  weekStart: Date;
}) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const handlePressDay = (day: Date) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onSelectDate(selectedDate && isSameDay(selectedDate, day) ? null : day);
  };

  return (
    <View style={styles.daysRow}>
      {days.map((day, index) => {
        const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
        const isToday = isSameDay(day, today);
        const hasEvents = eventDateKeys.has(dateKey(day));
        return (
          <Pressable
            accessibilityLabel={formatMonthDay(day)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            hitSlop={4}
            key={dateKey(day)}
            onPress={() => handlePressDay(day)}
            style={styles.dayCell}
          >
            <Text style={styles.dayLetter}>{WEEKDAY_LETTERS[index]}</Text>
            <View
              style={[
                styles.dayCircle,
                isSelected && styles.dayCircleSelected,
                !isSelected && isToday && styles.dayCircleToday,
              ]}
            >
              <Text
                style={[
                  styles.dayNumber,
                  isSelected && styles.dayNumberSelected,
                  !isSelected && isToday && styles.dayNumberToday,
                ]}
              >
                {day.getDate()}
              </Text>
            </View>
            <View style={[styles.eventDot, hasEvents && styles.eventDotVisible]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const DAY_CIRCLE_SIZE = 36;

const styles = StyleSheet.create({
  dayCell: {
    alignItems: 'center',
    gap: 6,
  },
  dayCircle: {
    alignItems: 'center',
    borderRadius: DAY_CIRCLE_SIZE / 2,
    height: DAY_CIRCLE_SIZE,
    justifyContent: 'center',
    width: DAY_CIRCLE_SIZE,
  },
  dayCircleSelected: {
    backgroundColor: dashboardColors.primary,
  },
  dayCircleToday: {
    borderColor: dashboardColors.primary,
    borderWidth: 1.5,
  },
  dayLetter: {
    color: dashboardColors.textFaint,
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  dayNumber: {
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  dayNumberSelected: {
    color: '#FFFFFF',
  },
  dayNumberToday: {
    color: dashboardColors.primary,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eventDot: {
    backgroundColor: 'transparent',
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  eventDotVisible: {
    backgroundColor: dashboardColors.primary,
  },
  menu: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    boxShadow: '0 8px 24px rgba(15,23,42,0.16)',
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 30,
    width: 160,
    zIndex: 30,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 12,
  },
  menuItemActive: {
    backgroundColor: dashboardColors.primaryTint,
  },
  menuItemText: {
    color: dashboardColors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  menuItemTextActive: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  menuScrim: {
    height: 1000,
    left: -1000,
    position: 'absolute',
    top: -1000,
    width: 2000,
    zIndex: 20,
  },
  selectorWrap: {
    position: 'relative',
  },
  weekLabel: {
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  weekLabelButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
});
