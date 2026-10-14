import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardSpacing } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { stepDays, type CareCycle } from '../../lib/careCycle';
import { PressableScale } from '../PressableScale';
import { careFonts } from './careStyles';

const CHIP_WIDTH = 52;
const CHIP_GAP = 6;
const SIDE = dashboardSpacing.pagePadding;

// Day 1 … 31 side by side (like the pregnancy week strip); a dot under
// the days with a hospital step, green once done. The picked day stays in
// the middle.
export function CycleDayStrip({
  cycle,
  length,
  onSelect,
  selectedDay,
  todayDay,
}: {
  cycle: CareCycle;
  length: number;
  onSelect: (day: number) => void;
  selectedDay: number;
  todayDay: number;
}) {
  const { c } = useCareCopy();
  const scrollRef = useRef<ScrollView>(null);
  const placed = useRef(false);
  const [viewWidth, setViewWidth] = useState(0);
  const marks = useMemo(() => stepDays(cycle), [cycle]);
  const contentWidth = SIDE * 2 + length * CHIP_WIDTH + (length - 1) * CHIP_GAP;

  useEffect(() => {
    if (!viewWidth) return;
    const centred = SIDE + (selectedDay - 1) * (CHIP_WIDTH + CHIP_GAP) - (viewWidth - CHIP_WIDTH) / 2;
    const x = Math.min(Math.max(0, centred), Math.max(0, contentWidth - viewWidth));
    // Jump straight to the day the first time, glide after a tap.
    scrollRef.current?.scrollTo({ animated: placed.current, x, y: 0 });
    placed.current = true;
  }, [contentWidth, selectedDay, viewWidth]);

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      onLayout={(event) => setViewWidth(event.nativeEvent.layout.width)}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
    >
      {Array.from({ length }, (_, index) => {
        const day = index + 1;
        const selected = day === selectedDay;
        const now = day === todayDay;
        const mark = marks.get(day);
        const label = c('cycleDay', { n: day });
        return (
          <PressableScale
            accessibilityLabel={now ? `${label}, ${c('today')}` : label}
            accessibilityState={{ selected }}
            key={day}
            onPress={() => onSelect(day)}
            style={[styles.chip, now && styles.chipNow, selected && styles.chipSelected]}
          >
            <Text style={[styles.label, selected && styles.textSelected]}>{c('dayShort')}</Text>
            <Text style={[styles.number, selected && styles.textSelected]}>{day}</Text>
            <View
              style={[
                styles.dot,
                mark && { backgroundColor: selected ? '#FFFFFF' : mark.done ? '#16A34A' : dashboardColors.primary },
              ]}
            />
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingBottom: 6,
    paddingTop: 7,
    width: CHIP_WIDTH,
  },
  chipNow: {
    borderColor: dashboardColors.primary,
  },
  chipSelected: {
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.primary,
  },
  dot: {
    borderRadius: 3,
    height: 6,
    marginTop: 3,
    width: 6,
  },
  label: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  number: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  row: {
    gap: CHIP_GAP,
    paddingHorizontal: SIDE,
  },
  strip: {
    flexGrow: 0,
    marginHorizontal: -SIDE,
  },
  textSelected: {
    color: '#FFFFFF',
  },
});
