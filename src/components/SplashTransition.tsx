import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import type { PropsWithChildren } from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { colors, layout } from '../theme';

const logoSource = require('../../assets/logo.png');

const ZOOM_HOLD_MS = 100;
const ZOOM_DURATION_MS = 620;
const ZOOM_FADE_MS = 220;
const ZOOM_SCALE = 1.45;
const SCREEN_REVEAL_MS = 280;

export function SplashTransitionProvider({
  children,
}: PropsWithChildren) {
  const hasTakenOverRef = useRef(false);
  const hasStartedRef = useRef(false);
  const [isLogoReady, setIsLogoReady] = useState(false);
  const [isNativeHidden, setIsNativeHidden] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(
    null,
  );
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const overlayOpacity = useSharedValue(1);

  useEffect(() => {
    let isMounted = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (isMounted) {
          setReduceMotion(enabled);
        }
      })
      .catch(() => {
        if (isMounted) {
          setReduceMotion(false);
        }
      });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const readinessFallback = setTimeout(() => {
      setReduceMotion((current) => current ?? false);
      setIsLogoReady(true);
    }, 2500);

    return () => {
      clearTimeout(readinessFallback);
    };
  }, []);

  const finishTransition = useCallback(() => {
    setIsComplete(true);
  }, []);

  useEffect(() => {
    if (
      !isLogoReady ||
      reduceMotion === null ||
      hasTakenOverRef.current
    ) {
      return;
    }

    hasTakenOverRef.current = true;
    const takeoverFrame = requestAnimationFrame(() => {
      SplashScreen.hide();
      setIsNativeHidden(true);
    });

    return () => {
      cancelAnimationFrame(takeoverFrame);
    };
  }, [isLogoReady, reduceMotion]);

  useEffect(() => {
    if (
      !isNativeHidden ||
      reduceMotion === null ||
      hasStartedRef.current
    ) {
      return;
    }

    hasStartedRef.current = true;

    if (reduceMotion) {
      logoOpacity.value = withTiming(0, {
        duration: 140,
        easing: Easing.out(Easing.cubic),
      });
      overlayOpacity.value = withDelay(
        140,
        withTiming(
          0,
          {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          },
          (finished) => {
            if (finished) {
              runOnJS(finishTransition)();
            }
          },
        ),
      );
      return;
    }

    logoScale.value = withDelay(
      ZOOM_HOLD_MS,
      withTiming(ZOOM_SCALE, {
        duration: ZOOM_DURATION_MS,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
      }),
    );
    logoOpacity.value = withDelay(
      ZOOM_HOLD_MS + ZOOM_DURATION_MS - ZOOM_FADE_MS,
      withTiming(0, {
        duration: ZOOM_FADE_MS,
        easing: Easing.in(Easing.cubic),
      }),
    );
    overlayOpacity.value = withDelay(
      ZOOM_HOLD_MS + ZOOM_DURATION_MS,
      withTiming(
        0,
        {
          duration: SCREEN_REVEAL_MS,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(finishTransition)();
          }
        },
      ),
    );
  }, [
    finishTransition,
    isNativeHidden,
    logoOpacity,
    logoScale,
    overlayOpacity,
    reduceMotion,
  ]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  return (
    <View style={styles.root}>
      <View
        accessibilityElementsHidden={!isComplete}
        importantForAccessibility={
          isComplete ? 'auto' : 'no-hide-descendants'
        }
        pointerEvents={isComplete ? 'auto' : 'none'}
        style={styles.content}
      >
        {children}
      </View>

      {!isComplete ? (
        <Animated.View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="auto"
          style={[styles.overlay, overlayAnimatedStyle]}
        >
          <Animated.View
            style={[styles.logoFrame, logoAnimatedStyle]}
          >
            <Image
              cachePolicy="memory-disk"
              contentFit="contain"
              onDisplay={() => setIsLogoReady(true)}
              onError={() => setIsLogoReady(true)}
              source={logoSource}
              style={styles.logo}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    flex: 1,
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    bottom: 0,
    elevation: 100,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 100,
  },
  logoFrame: {
    height: layout.logoSize,
    width: layout.logoSize,
  },
  logo: {
    height: layout.logoSize,
    width: layout.logoSize,
  },
});
