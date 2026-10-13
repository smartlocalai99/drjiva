import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { dashboardColors } from '../../dashboardTheme';
import {
  HEAD_TO_HEEL_FROM_WEEK,
  babyScale,
  babyWeek,
  lengthAmount,
  lengthChange,
  weightAmount,
  weightChange,
  type Amount,
  type BabyStage,
} from '../../lib/babySize';
import { useCareCopy } from '../../lib/careCopy';
import { trimester } from '../../lib/careSchedule';
import { careFonts, careShared } from './careStyles';

export const BABY_IMAGES: Record<BabyStage, number> = {
  cells: require('../../../assets/care/baby-cells.webp'),
  early: require('../../../assets/care/baby-early.webp'),
  embryo: require('../../../assets/care/baby-embryo.webp'),
  fetus: require('../../../assets/care/baby-fetus.webp'),
  grown: require('../../../assets/care/baby-grown.webp'),
};
const WOMB_IMAGE = require('../../../assets/care/womb.webp');

// womb.webp is 600 × 680; the fluid inside is 125/150 of its width.
const WOMB_WIDTH = 216;
const WOMB_HEIGHT = Math.round((WOMB_WIDTH * 680) / 600);
const WOMB_INSIDE = (WOMB_WIDTH * 125) / 150;
const GROW = { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System } as const;

// One week of the pregnancy: the baby inside the womb, drawn bigger each
// week, and how big it is ("As big as a capsicum", weight, length).
export function BabyWeekCard({ dueDate, isCurrent, week }: { dueDate: string | null; isCurrent: boolean; week: number }) {
  const { c, date, language, pick } = useCareCopy();
  const info = babyWeek(week);
  const babySize = Math.round(WOMB_INSIDE * babyScale(week));
  const babyStyle = useAnimatedStyle(
    () => ({ height: withTiming(babySize, GROW), width: withTiming(babySize, GROW) }),
    [babySize],
  );

  const say = (amount: Amount) =>
    c(amount.unit === 'mm' ? 'amountMm' : amount.unit === 'cm' ? 'amountCm' : amount.unit === 'kg' ? 'amountKg' : 'amountG', {
      n: amount.amount,
    });
  const grams = weightChange(info.week);
  const cm = lengthChange(info.week);
  const fruit = pick(info.likeEn, info.likeTe);
  const [before = '', after = ''] = c('asBigAs').split('{fruit}');

  return (
    <View style={careShared.card}>
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.week}>{c('week', { week: info.week })}</Text>
          {isCurrent ? (
            <View style={styles.nowPill}>
              <Text style={styles.nowText}>{c('thisWeek')}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          <Text style={careShared.muted}>{c(`trimester${trimester(info.week)}`)}</Text>
          {dueDate ? (
            <>
              <View style={styles.metaDot} />
              <Text style={careShared.muted}>{c('dueDate', { date: date(dueDate) })}</Text>
            </>
          ) : null}
        </View>
      </View>

      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
        <Image contentFit="contain" source={WOMB_IMAGE} style={styles.womb} />
        <View style={styles.babyCenter}>
          <Animated.View style={babyStyle}>
            <Image contentFit="contain" source={BABY_IMAGES[info.stage]} style={styles.fill} transition={200} />
          </Animated.View>
        </View>
      </View>

      <Text style={styles.compare}>
        {before}
        <Text style={styles.compareFruit}>{fruit}</Text>
        {after}
      </Text>

      <View style={styles.stats}>
        <Stat
          caption={c('weight')}
          change={grams === null ? null : `+${say(weightAmount(grams))}`}
          value={info.weightG === null ? c('underOneGram') : say(weightAmount(info.weightG))}
        />
        <Stat
          caption={c(info.week >= HEAD_TO_HEEL_FROM_WEEK ? 'lengthHeadToHeel' : 'lengthHeadToBottom')}
          change={cm === null ? null : `+${say(lengthAmount(cm, info.lengthCm))}`}
          value={say(lengthAmount(info.lengthCm))}
        />
      </View>

      <Text style={[styles.note, language === 'te' && styles.noteTe]}>{c('averageNote')}</Text>
    </View>
  );
}

function Stat({ caption, change, value }: { caption: string; change: string | null; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      {change ? (
        <View style={styles.change}>
          <Text style={styles.changeText}>{change}</Text>
        </View>
      ) : null}
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
    alignSelf: 'center',
    height: WOMB_HEIGHT,
    width: WOMB_WIDTH,
  },
  babyCenter: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  change: {
    alignSelf: 'flex-start',
    backgroundColor: dashboardColors.successTint,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  changeText: {
    color: '#15803D',
    fontFamily: careFonts.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  compare: {
    color: dashboardColors.text,
    fontFamily: careFonts.medium,
    fontSize: 20,
    lineHeight: 27,
    textAlign: 'center',
  },
  compareFruit: {
    fontFamily: careFonts.bold,
  },
  fill: {
    height: '100%',
    width: '100%',
  },
  metaDot: {
    backgroundColor: dashboardColors.textMuted,
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  metaRow: {
    alignItems: 'center',
    columnGap: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  note: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  noteTe: {
    lineHeight: 21,
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
  stat: {
    backgroundColor: dashboardColors.bg,
    borderCurve: 'continuous',
    borderRadius: 18,
    flex: 1,
    gap: 4,
    padding: 14,
  },
  statCaption: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 14,
    lineHeight: 19,
  },
  statValue: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 21,
    lineHeight: 27,
  },
  stats: {
    flexDirection: 'row',
    gap: 10,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  week: {
    color: dashboardColors.text,
    flexShrink: 1,
    fontFamily: careFonts.bold,
    fontSize: 26,
    letterSpacing: -0.4,
    lineHeight: 32,
  },
  womb: {
    height: WOMB_HEIGHT,
    width: WOMB_WIDTH,
  },
});
