import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardSpacing } from '../../dashboardTheme';
import { BABY_WEEKS, FIRST_BABY_WEEK, babyScale, clampBabyWeek } from '../../lib/babySize';
import { useCareCopy } from '../../lib/careCopy';
import { PressableScale } from '../PressableScale';
import { BABY_IMAGES } from './BabyWeekCard';
import { careFonts } from './careStyles';

const CHIP_WIDTH = 66;
const CHIP_GAP = 8;
const SIDE = dashboardSpacing.pagePadding;
const CONTENT_WIDTH = SIDE * 2 + BABY_WEEKS.length * CHIP_WIDTH + (BABY_WEEKS.length - 1) * CHIP_GAP;

// Week 4 … 40 side by side; the picked week stays in the middle.
export function WeekStrip({
  currentWeek,
  onSelect,
  selectedWeek,
}: {
  currentWeek: number;
  onSelect: (week: number) => void;
  selectedWeek: number;
}) {
  const { c } = useCareCopy();
  const scrollRef = useRef<ScrollView>(null);
  const placed = useRef(false);
  const [viewWidth, setViewWidth] = useState(0);

  useEffect(() => {
    if (!viewWidth) return;
    const index = clampBabyWeek(selectedWeek) - FIRST_BABY_WEEK;
    const centred = SIDE + index * (CHIP_WIDTH + CHIP_GAP) - (viewWidth - CHIP_WIDTH) / 2;
    const x = Math.min(Math.max(0, centred), Math.max(0, CONTENT_WIDTH - viewWidth));
    // Jump straight to this week the first time, glide after a tap.
    scrollRef.current?.scrollTo({ animated: placed.current, x, y: 0 });
    placed.current = true;
  }, [selectedWeek, viewWidth]);

  return (
    <ScrollView
      contentContainerStyle={styles.row}
      horizontal
      onLayout={(event) => setViewWidth(event.nativeEvent.layout.width)}
      ref={scrollRef}
      showsHorizontalScrollIndicator={false}
      style={styles.strip}
    >
      {BABY_WEEKS.map(({ stage, week }) => {
        const selected = week === selectedWeek;
        const now = week === currentWeek;
        const icon = Math.round(18 + 16 * babyScale(week));
        return (
          <PressableScale
            accessibilityLabel={now ? `${c('week', { week })}, ${c('thisWeek')}` : c('week', { week })}
            accessibilityState={{ selected }}
            key={week}
            onPress={() => onSelect(week)}
            style={[styles.chip, now && styles.chipNow, selected && styles.chipSelected]}
          >
            <View style={styles.iconWell}>
              <Image contentFit="contain" source={BABY_IMAGES[stage]} style={{ height: icon, width: icon }} />
            </View>
            <Text style={[styles.label, selected && styles.textSelected]}>{c('weekShort')}</Text>
            <Text style={[styles.number, selected && styles.textSelected]}>{week}</Text>
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
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 2,
    paddingBottom: 10,
    paddingTop: 8,
    width: CHIP_WIDTH,
  },
  chipNow: {
    borderColor: dashboardColors.primary,
  },
  chipSelected: {
    backgroundColor: dashboardColors.primary,
    borderColor: dashboardColors.primary,
  },
  iconWell: {
    alignItems: 'center',
    backgroundColor: '#C4614B',
    borderRadius: 21,
    height: 42,
    justifyContent: 'center',
    marginBottom: 4,
    width: 42,
  },
  label: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 13,
    lineHeight: 17,
  },
  number: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 20,
    lineHeight: 24,
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
