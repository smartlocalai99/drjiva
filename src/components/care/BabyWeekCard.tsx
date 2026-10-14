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
  type FruitPhoto,
} from '../../lib/babySize';
import { careMonth, useCareCopy } from '../../lib/careCopy';
import { pregnancyMonth } from '../../lib/careSchedule';
import { careFonts, careShared } from './careStyles';

// Free pictures (public domain / CC BY-SA), credited in Profile → Photo
// credits (src/lib/careCredits.ts). Weeks 9–27 share one drawing; it is
// drawn bigger each week.
const FETUS_IMAGE = require('../../../assets/care/baby-fetus.webp');
export const BABY_IMAGES: Record<BabyStage, number> = {
  cells: require('../../../assets/care/baby-cells.webp'),
  early: FETUS_IMAGE,
  embryo: require('../../../assets/care/baby-embryo.webp'),
  fetus: FETUS_IMAGE,
  grown: require('../../../assets/care/baby-grown.webp'),
};
const WOMB_IMAGE = require('../../../assets/care/womb.webp');

// Real photos, one item cut out of each (free licences, credited in
// src/lib/careCredits.ts).
const FRUIT_PHOTOS: Record<FruitPhoto, number> = {
  amla: require('../../../assets/care/fruits/amla.webp'),
  apple: require('../../../assets/care/fruits/apple.webp'),
  ashgourd: require('../../../assets/care/fruits/ashgourd.webp'),
  banana: require('../../../assets/care/fruits/banana.webp'),
  bottlegourd: require('../../../assets/care/fruits/bottlegourd.webp'),
  brinjal: require('../../../assets/care/fruits/brinjal.webp'),
  cabbage: require('../../../assets/care/fruits/cabbage.webp'),
  capsicum: require('../../../assets/care/fruits/capsicum.webp'),
  carrot: require('../../../assets/care/fruits/carrot.webp'),
  cauliflower: require('../../../assets/care/fruits/cauliflower.webp'),
  coconut: require('../../../assets/care/fruits/coconut.webp'),
  corn: require('../../../assets/care/fruits/corn.webp'),
  cucumber: require('../../../assets/care/fruits/cucumber.webp'),
  fig: require('../../../assets/care/fruits/fig.webp'),
  grape: require('../../../assets/care/fruits/grape.webp'),
  guava: require('../../../assets/care/fruits/guava.webp'),
  jackfruit: require('../../../assets/care/fruits/jackfruit.webp'),
  jamun: require('../../../assets/care/fruits/jamun.webp'),
  lemon: require('../../../assets/care/fruits/lemon.webp'),
  mango: require('../../../assets/care/fruits/mango.webp'),
  muskmelon: require('../../../assets/care/fruits/muskmelon.webp'),
  papaya: require('../../../assets/care/fruits/papaya.webp'),
  peanut: require('../../../assets/care/fruits/peanut.webp'),
  pineapple: require('../../../assets/care/fruits/pineapple.webp'),
  pomegranate: require('../../../assets/care/fruits/pomegranate.webp'),
  poppy: require('../../../assets/care/fruits/poppy.webp'),
  pumpkin: require('../../../assets/care/fruits/pumpkin.webp'),
  radish: require('../../../assets/care/fruits/radish.webp'),
  rice: require('../../../assets/care/fruits/rice.webp'),
  ridgegourd: require('../../../assets/care/fruits/ridgegourd.webp'),
  sapota: require('../../../assets/care/fruits/sapota.webp'),
  sesame: require('../../../assets/care/fruits/sesame.webp'),
  sweetpotato: require('../../../assets/care/fruits/sweetpotato.webp'),
  watermelon: require('../../../assets/care/fruits/watermelon.webp'),
};

// womb.webp is 600 × 680; the fluid inside is 125/150 of its width.
const WOMB_WIDTH = 120;
const WOMB_HEIGHT = Math.round((WOMB_WIDTH * 680) / 600);
const WOMB_INSIDE = (WOMB_WIDTH * 125) / 150;
const GROW = { duration: 280, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.System } as const;

// One week of the pregnancy: the baby inside the womb on the left, drawn
// bigger each week; on the right what it is as big as (with a photo),
// its average weight and its length.
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
  // "As big as {fruit}" / "{fruit} అంత ఉంటుంది": the words around the fruit.
  const [before = '', after = ''] = c('asBigAs').split('{fruit}').map((part) => part.trim());

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
          <Text style={careShared.muted}>{careMonth(language, pregnancyMonth(info.week))}</Text>
          {dueDate ? (
            <>
              <View style={styles.metaDot} />
              <Text style={careShared.muted}>{c('dueDate', { date: date(dueDate) })}</Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.art}>
          <Image contentFit="contain" source={WOMB_IMAGE} style={styles.womb} />
          <View style={styles.babyCenter}>
            <Animated.View style={babyStyle}>
              <Image contentFit="contain" source={BABY_IMAGES[info.stage]} style={styles.fill} transition={200} />
            </Animated.View>
          </View>
        </View>

        <View style={styles.facts}>
          <View accessibilityLabel={[before, fruit, after].filter(Boolean).join(' ')} accessible style={styles.compare}>
            {before ? <Text style={styles.lead}>{before}</Text> : null}
            <View style={styles.fruitRow}>
              <Image contentFit="contain" source={FRUIT_PHOTOS[info.photo]} style={styles.fruitPhoto} transition={150} />
              <Text style={styles.fruitName}>{fruit}</Text>
            </View>
            {after ? <Text style={styles.lead}>{after}</Text> : null}
          </View>

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
        </View>
      </View>
    </View>
  );
}

function Stat({ caption, change, value }: { caption: string; change: string | null; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      {change ? <Text style={styles.changeText}>{change}</Text> : null}
      <Text style={styles.statCaption}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  art: {
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
  body: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  changeText: {
    color: '#15803D',
    fontFamily: careFonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  compare: {
    gap: 4,
  },
  facts: {
    flex: 1,
    gap: 12,
  },
  fill: {
    height: '100%',
    width: '100%',
  },
  fruitName: {
    color: dashboardColors.text,
    flexShrink: 1,
    fontFamily: careFonts.bold,
    fontSize: 18,
    lineHeight: 23,
  },
  fruitPhoto: {
    height: 52,
    width: 52,
  },
  fruitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  lead: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
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
  statCaption: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
  stat: {
    flex: 1,
    gap: 1,
  },
  statValue: {
    color: dashboardColors.text,
    fontFamily: careFonts.bold,
    fontSize: 17,
    lineHeight: 22,
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
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
