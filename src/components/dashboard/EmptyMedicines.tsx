import { Image } from 'expo-image';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { useLanguage } from '../../lib/i18n';

const illustrationSource = require('../../../assets/notabs.png');
const ILLUSTRATION_ASPECT_RATIO = 1080 / 1350;

export function EmptyMedicines() {
  const { t } = useLanguage();

  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.wrapper}>
      <Image
        accessibilityLabel="Empty medicine strip"
        contentFit="contain"
        source={illustrationSource}
        style={styles.illustration}
      />
      <Text style={styles.title}>{t('noMedicinesToday')}</Text>
      <Text style={styles.subtitle}>{t('tapAddMedicine')}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    justifyContent: 'center',
  },
  illustration: {
    alignSelf: 'center',
    aspectRatio: ILLUSTRATION_ASPECT_RATIO,
    marginBottom: dashboardSpacing.xl,
    width: 160,
  },
  title: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    textAlign: 'center',
  },
  subtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
});
