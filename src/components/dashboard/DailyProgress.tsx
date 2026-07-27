import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';

type DailyProgressProps = {
  completed: number;
  total: number;
  isToday: boolean;
};

export function DailyProgress({ completed, total, isToday }: DailyProgressProps) {
  const progress = useSharedValue(0);
  const ratio = total > 0 ? completed / total : 0;

  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 500 });
  }, [progress, ratio]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (total === 0) {
    return null;
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <Text style={styles.label}>
        {completed} of {total} medicines completed{isToday ? ' today' : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginTop: dashboardSpacing.gap,
    width: '100%',
  },
  track: {
    backgroundColor: dashboardColors.track,
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    backgroundColor: dashboardColors.success,
    borderRadius: 3,
    height: '100%',
  },
  label: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
  },
});
