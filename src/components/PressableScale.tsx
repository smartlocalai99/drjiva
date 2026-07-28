import type { ReactNode } from 'react';
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolateColor,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_SPRING = {
  damping: 18,
  mass: 0.5,
  reduceMotion: ReduceMotion.System,
  stiffness: 360,
} as const;

export interface PressableScaleProps
  extends Omit<
    PressableProps,
    'children' | 'onPressIn' | 'onPressOut' | 'style'
  > {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
  backgroundColor?: string;
  pressedBackgroundColor?: string;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
}

export function PressableScale({
  accessibilityRole,
  backgroundColor,
  children,
  disabled = false,
  onPressIn,
  onPressOut,
  pressedBackgroundColor,
  pressedScale = 0.97,
  style,
  ...pressableProps
}: PressableScaleProps) {
  const pressProgress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const animatedBackgroundColor =
      backgroundColor && pressedBackgroundColor
        ? interpolateColor(
            pressProgress.value,
            [0, 1],
            [backgroundColor, pressedBackgroundColor],
          )
        : backgroundColor;

    const transform = [
      {
        scale: 1 - pressProgress.value * Math.max(0, 1 - pressedScale),
      },
    ];

    if (!animatedBackgroundColor) {
      return { transform };
    }

    return {
      backgroundColor: animatedBackgroundColor,
      transform,
    };
  }, [backgroundColor, pressedBackgroundColor, pressedScale]);

  const handlePressIn = (event: GestureResponderEvent) => {
    pressProgress.value = withSpring(1, PRESS_SPRING);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    pressProgress.value = withSpring(0, PRESS_SPRING);
    onPressOut?.(event);
  };

  return (
    <AnimatedPressable
      accessibilityRole={accessibilityRole ?? 'button'}
      disabled={disabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, animatedStyle]}
      {...pressableProps}
    >
      {children}
    </AnimatedPressable>
  );
}
