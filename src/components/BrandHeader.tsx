import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  ReduceMotion,
  useReducedMotion,
} from 'react-native-reanimated';

import { copy } from '../copy';
import {
  colors,
  layout,
  spacing,
  typography,
} from '../theme';

const logoSource = require('../../assets/logo.png');
const teluguHeadlines = [
  copy.headlineTe,
  ...copy.headlineTeAlternates,
] as const;
const HEADLINE_ROTATION_MS = 3200;
const headlineEntering = FadeInDown.duration(360)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);
const headlineExiting = FadeOutUp.duration(240)
  .easing(Easing.in(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

type BrandHeaderProps = {
  rotateTelugu?: boolean;
  subtitle?: ReactNode;
};

export function BrandHeader({
  rotateTelugu = false,
  subtitle,
}: BrandHeaderProps) {
  const reduceMotion = useReducedMotion();
  const [teluguHeadlineIndex, setTeluguHeadlineIndex] = useState(0);
  const shouldRotateTelugu = rotateTelugu && !reduceMotion;

  useEffect(() => {
    if (!shouldRotateTelugu) {
      setTeluguHeadlineIndex(0);
      return;
    }

    const rotationTimer = setInterval(() => {
      setTeluguHeadlineIndex(
        (current) => (current + 1) % teluguHeadlines.length,
      );
    }, HEADLINE_ROTATION_MS);

    return () => {
      clearInterval(rotationTimer);
    };
  }, [shouldRotateTelugu]);

  const teluguHeadline = teluguHeadlines[teluguHeadlineIndex];

  return (
    <View style={styles.container}>
      <View style={styles.logoFrame}>
        <Image
          accessibilityLabel={`${copy.appName} logo`}
          cachePolicy="memory-disk"
          contentFit="contain"
          source={logoSource}
          style={styles.logo}
        />
      </View>

      <Text accessibilityRole="header" style={styles.headline}>
        {copy.headline}
      </Text>
      <View
        accessibilityLabel={teluguHeadline}
        accessible
        style={styles.teluguFrame}
      >
        {shouldRotateTelugu ? (
          <Animated.Text
            accessible={false}
            entering={headlineEntering}
            exiting={headlineExiting}
            key={teluguHeadline}
            style={styles.telugu}
          >
            {teluguHeadline}
          </Animated.Text>
        ) : (
          <Text accessible={false} style={styles.telugu}>
            {copy.headlineTe}
          </Text>
        )}
      </View>
      {subtitle ? (
        <View style={styles.subtitleWrap}>{subtitle}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  logoFrame: {
    alignItems: 'center',
    height: layout.logoSize,
    justifyContent: 'center',
    width: layout.logoSize,
  },
  logo: {
    height: layout.logoSize,
    width: layout.logoSize,
  },
  headline: {
    ...typography.headline,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  teluguFrame: {
    alignItems: 'center',
    height: 24,
    justifyContent: 'center',
    marginTop: spacing.xs,
    overflow: 'hidden',
    width: '100%',
  },
  telugu: {
    ...typography.telugu,
    color: colors.textMuted,
    left: 0,
    position: 'absolute',
    right: 0,
    textAlign: 'center',
    top: 0,
  },
  subtitleWrap: {
    alignItems: 'center',
    marginTop: spacing.sm,
    minHeight: 22,
    width: '100%',
  },
});
