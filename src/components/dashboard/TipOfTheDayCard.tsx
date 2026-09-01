import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { getTodaysTipImage } from '../../data/tipOfTheDay';

export function TipOfTheDayCard() {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Tip of the day</Text>
      <Image
        cachePolicy="memory-disk"
        contentFit="contain"
        source={getTodaysTipImage()}
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    elevation: 2,
    marginBottom: dashboardSpacing.gap,
    padding: dashboardSpacing.md,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
  },
  eyebrow: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    letterSpacing: 0.6,
    marginBottom: dashboardSpacing.sm,
    textTransform: 'uppercase',
  },
  image: {
    borderRadius: dashboardRadii.card - 8,
    height: 240,
    width: '100%',
  },
});
