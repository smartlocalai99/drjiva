import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardSpacing } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import type { ChildVisit } from '../../lib/childGrowth';
import { PressableScale } from '../PressableScale';
import { CHILD_STATUS } from './ChildStatus';
import { careFonts } from './careStyles';

const CHIP_WIDTH = 66;
const CHIP_GAP = 6;
const SIDE = dashboardSpacing.pagePadding;

// Every visit by age, Birth … 10 years, side by side like the pregnancy
// week strip; the dot is the visit's status. The picked visit stays in the
// middle.
export function ChildAgeStrip({
  onSelect,
  selectedId,
  visits,
}: {
  onSelect: (visitId: string) => void;
  selectedId: string;
  visits: readonly ChildVisit[];
}) {
  const { c, date } = useCareCopy();
  const scrollRef = useRef<ScrollView>(null);
  const placed = useRef(false);
  const [viewWidth, setViewWidth] = useState(0);
  const index = Math.max(0, visits.findIndex((visit) => visit.visit.id === selectedId));
  const contentWidth = SIDE * 2 + visits.length * CHIP_WIDTH + Math.max(0, visits.length - 1) * CHIP_GAP;

  useEffect(() => {
    if (!viewWidth) return;
    const centred = SIDE + index * (CHIP_WIDTH + CHIP_GAP) - (viewWidth - CHIP_WIDTH) / 2;
    const x = Math.min(Math.max(0, centred), Math.max(0, contentWidth - viewWidth));
    scrollRef.current?.scrollTo({ animated: placed.current, x, y: 0 });
    placed.current = true;
  }, [contentWidth, index, viewWidth]);

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      onLayout={(event) => setViewWidth(event.nativeEvent.layout.width)}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
    >
      {visits.map((visit) => {
        const selected = visit.visit.id === selectedId;
        const { unit, value } = visit.age;
        const unitText =
          unit === 'birth' ? c('ageBirth') : c(unit === 'week' ? 'ageUnitWeek' : unit === 'month' ? 'ageUnitMonth' : 'ageUnitYear');
        const status = CHILD_STATUS[visit.status];
        return (
          <PressableScale
            accessibilityLabel={`${unit === 'birth' ? unitText : `${value} ${unitText}`}, ${c(status.copy)}, ${date(visit.dueDate)}`}
            accessibilityState={{ selected }}
            key={visit.visit.id}
            onPress={() => onSelect(visit.visit.id)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            {unit === 'birth' ? (
              <Text numberOfLines={1} style={[styles.birth, selected && styles.textSelected]}>{unitText}</Text>
            ) : (
              <>
                <Text style={[styles.number, selected && styles.textSelected]}>{value}</Text>
                <Text numberOfLines={1} style={[styles.unit, selected && styles.textSelected]}>{unitText}</Text>
              </>
            )}
            <View style={[styles.dot, { backgroundColor: selected ? '#FFFFFF' : status.dot }]} />
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  birth: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 14,
    lineHeight: 34,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingBottom: 7,
    paddingTop: 6,
    width: CHIP_WIDTH,
  },
  chipSelected: {
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.primary,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    marginTop: 3,
    width: 8,
  },
  number: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 18,
    lineHeight: 21,
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
  unit: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 11,
    lineHeight: 13,
  },
});
