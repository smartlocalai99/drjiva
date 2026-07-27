import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { dashboardColors, dashboardLayout } from '../../dashboardTheme';

type MedicineToggleProps = {
  value: boolean;
  onValueChange: () => void;
};

const KNOB_TRAVEL =
  dashboardLayout.toggleWidth - dashboardLayout.toggleKnobSize - 4;

export function MedicineToggle({ value, onValueChange }: MedicineToggleProps) {
  const progress = useSharedValue(value ? 1 : 0);
  progress.value = withTiming(value ? 1 : 0, { duration: 220 });

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [dashboardColors.track, dashboardColors.success],
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: withSpring(progress.value * KNOB_TRAVEL, {
          damping: 16,
          mass: 0.5,
          stiffness: 260,
        }),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      hitSlop={10}
      onPress={onValueChange}
    >
      <Animated.View style={[styles.track, trackStyle]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: dashboardLayout.toggleHeight / 2,
    height: dashboardLayout.toggleHeight,
    justifyContent: 'center',
    padding: 2,
    width: dashboardLayout.toggleWidth,
  },
  knob: {
    backgroundColor: '#FFFFFF',
    borderRadius: dashboardLayout.toggleKnobSize / 2,
    height: dashboardLayout.toggleKnobSize,
    shadowColor: '#000000',
    shadowOffset: { height: 1, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    width: dashboardLayout.toggleKnobSize,
  },
});
