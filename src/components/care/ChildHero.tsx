import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardSpacing } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { childMonths } from '../../lib/childGrowth';
import { careFonts, careShared } from './careStyles';

// Photos chosen by the hospital: months 0–5, 6–11, and 1 year onwards.
const HERO = {
  baby: { position: 'center' as ImageContentPosition, source: require('../../../assets/month1.webp') },
  infant: { position: 'center' as ImageContentPosition, source: require('../../../assets/4months.jpg') },
  toddler: { position: 'right' as ImageContentPosition, source: require('../../../assets/oneyear.jpg') },
};

const HERO_HEIGHT = 270;

// Top of the child page: a big photo for the child's age that fades into
// the page, then the child's name, age and date of birth.
export function ChildHero({
  ageText,
  birthDate,
  bleedTop,
  name,
  today,
}: {
  ageText: string;
  birthDate: string;
  bleedTop: boolean;
  name: string;
  today: string;
}) {
  const { c, date } = useCareCopy();
  const months = childMonths(birthDate, today);
  const hero = months < 6 ? HERO.baby : months < 12 ? HERO.infant : HERO.toddler;

  return (
    <>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.hero, bleedTop && styles.heroTop]}>
        <Image contentFit="cover" contentPosition={hero.position} source={hero.source} style={styles.photo} transition={200} />
        <LinearGradient
          colors={['rgba(248,249,251,0)', 'rgba(248,249,251,0.85)', dashboardColors.bg]}
          locations={[0, 0.6, 1]}
          pointerEvents="none"
          style={styles.fade}
        />
      </View>

      <View accessibilityLabel={`${name}, ${ageText}, ${c('childBornOn', { date: date(birthDate) })}`} accessible style={[careShared.card, styles.card]}>
        <View style={styles.baby}>
          <Text style={styles.babyEmoji}>👶</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.line}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.divider}> | </Text>
            {ageText}
          </Text>
          <View style={styles.born}>
            <MaterialCommunityIcons color="#7C3AED" name="cake-variant-outline" size={20} />
            <Text style={styles.bornText}>{c('childBornOn', { date: date(birthDate) })}</Text>
          </View>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  baby: {
    alignItems: 'center',
    backgroundColor: '#FFF1E6',
    borderRadius: 30,
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  babyEmoji: {
    fontSize: 34,
    lineHeight: 40,
  },
  born: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bornText: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    marginTop: -64,
    paddingVertical: 18,
  },
  divider: {
    color: dashboardColors.textFaint,
    fontFamily: careFonts.medium,
  },
  fade: {
    bottom: 0,
    height: 110,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  hero: {
    height: HERO_HEIGHT,
    marginHorizontal: -dashboardSpacing.pagePadding,
  },
  heroTop: {
    marginTop: -dashboardSpacing.gap,
  },
  info: {
    flex: 1,
    gap: 6,
  },
  line: {
    color: dashboardColors.text,
    fontFamily: careFonts.medium,
    fontSize: 20,
    lineHeight: 26,
  },
  name: {
    fontFamily: careFonts.bold,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
});
