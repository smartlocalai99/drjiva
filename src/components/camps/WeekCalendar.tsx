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

type WeekCalendarProps = {
  eventDateKeys: Set<string>;
  onSelectDate: (date: Date | null) => void;
  onSelectWeekStart: (date: Date) => void;
  selectedDate: Date | null;
  weekStart: Date;
};

export function WeekCalendar({
  eventDateKeys,
  onSelectDate,
  onSelectWeekStart,
  selectedDate,
  weekStart,
}: WeekCalendarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const today = new Date();
  const thisWeekStart = startOfWeek(today);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6]!;
  const activeOffset = Math.round(
    (weekStart.getTime() - thisWeekStart.getTime()) / (7 * 86_400_000),
  );

  const handlePickWeek = (offset: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onSelectWeekStart(addDays(thisWeekStart, offset * 7));
    onSelectDate(null);
    setMenuOpen(false);
  };

  const handlePressDay = (day: Date) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onSelectDate(selectedDate && isSameDay(selectedDate, day) ? null : day);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Pressable
          accessibilityLabel="Choose a different week"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => setMenuOpen((open) => !open)}
          style={styles.weekLabelButton}
        >
          <Text style={styles.weekLabel}>
            {formatMonthDay(weekStart)} – {formatMonthDay(weekEnd)}
          </Text>
          <Ionicons
            color={dashboardColors.textMuted}
            name={menuOpen ? 'chevron-up' : 'chevron-down'}
            size={16}
          />
        </Pressable>
      </View>

      {menuOpen ? (
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
      ) : (
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
      )}
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
  headerRow: {
    flexDirection: 'row',
    marginBottom: dashboardSpacing.sm,
  },
  menu: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    overflow: 'hidden',
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
  weekLabel: {
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  weekLabelButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  wrap: {
    width: '100%',
  },
});
