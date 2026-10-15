import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, type ImageContentPosition } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardSpacing } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { careFonts, careShared } from './careStyles';

// Photos chosen by the hospital: months 0–5, 6–11, and 1 year onwards.
const HERO = {
  baby: { position: 'center' as ImageContentPosition, source: require('../../../assets/month1.webp') },
  infant: { position: 'center' as ImageContentPosition, source: require('../../../assets/4months.jpg') },
  toddler: { position: 'right' as ImageContentPosition, source: require('../../../assets/oneyear.jpg') },
};

const HERO_HEIGHT = 270;

// Top of the child page: a big photo for the age chosen on the Child Growth
// Chart (it changes with the strip), fading into the page, then the child's
// age and date of birth.
export function ChildHero({
  ageText,
  birthDate,
  bleedTop,
  photoMonths,
}: {
  ageText: string;
  birthDate: string;
  bleedTop: boolean;
  photoMonths: number;
}) {
  const { c, date } = useCareCopy();
  const hero = photoMonths < 6 ? HERO.baby : photoMonths < 12 ? HERO.infant : HERO.toddler;

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

      <View accessibilityLabel={`${ageText}, ${c('childBornOn', { date: date(birthDate) })}`} accessible style={[careShared.card, styles.card]}>
        <View style={styles.info}>
          <Text style={styles.line}>{ageText}</Text>
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
    fontFamily: careFonts.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  photo: {
    height: '100%',
    width: '100%',
  },
});
