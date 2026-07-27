import { Image, type ImageSource } from 'expo-image';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, layout, radii } from '../theme';
import PlaceholderTile, {
  type MarqueeTileSize,
} from './PlaceholderTile';

export type CarouselImage = ImageSource | number;
export type MarqueeDirection = 'left-to-right' | 'right-to-left';

export interface MarqueeRowProps {
  direction: MarqueeDirection;
  images: readonly CarouselImage[];
  itemOffset?: number;
  phaseOffset: number;
  screenWidth: number;
  tileSize: MarqueeTileSize;
}

interface MarqueeItem {
  index: number;
  source: CarouselImage | undefined;
}

interface MarqueeTileProps {
  index: number;
  size: MarqueeTileSize;
  source: CarouselImage | undefined;
}

const MarqueeTile = memo(function MarqueeTile({
  index,
  size,
  source,
}: MarqueeTileProps) {
  if (source === undefined) {
    return <PlaceholderTile index={index} size={size} />;
  }

  const tileStyle = size === 88 ? styles.compactTile : styles.regularTile;

  return (
    <View style={tileStyle}>
      <Image
        accessible={false}
        cachePolicy="memory-disk"
        contentFit="cover"
        source={source}
        style={styles.image}
      />
      <View pointerEvents="none" style={styles.imageOverlay} />
    </View>
  );
});

function getAnimationBounds(
  direction: MarqueeDirection,
  setWidth: number,
  phaseOffset: number,
) {
  if (direction === 'left-to-right') {
    return {
      start: -setWidth + phaseOffset,
      target: phaseOffset,
    };
  }

  return {
    start: phaseOffset,
    target: -setWidth + phaseOffset,
  };
}

export const MarqueeRow = memo(function MarqueeRow({
  direction,
  images,
  itemOffset = 0,
  phaseOffset,
  screenWidth,
  tileSize,
}: MarqueeRowProps) {
  const stride = tileSize + layout.tileGap;
  const itemCount = Math.max(
    1,
    images.length,
    Math.ceil((screenWidth * 1.5) / stride),
  );
  const setWidth = itemCount * stride;
  const duration = (setWidth / layout.marqueeSpeed) * 1000;
  const initialBounds = getAnimationBounds(
    direction,
    setWidth,
    phaseOffset,
  );
  const translateX = useSharedValue(initialBounds.start);

  const items = useMemo<MarqueeItem[]>(
    () =>
      Array.from({ length: itemCount }, (_, index) => ({
        index,
        source:
          images.length === 0
            ? undefined
            : images[(index + itemOffset) % images.length],
      })),
    [images, itemCount, itemOffset],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  useEffect(() => {
    const { start, target } = getAnimationBounds(
      direction,
      setWidth,
      phaseOffset,
    );

    cancelAnimation(translateX);
    translateX.value = start;
    translateX.value = withRepeat(
      withTiming(target, {
        duration,
        easing: Easing.linear,
      }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(translateX);
    };
  }, [
    direction,
    duration,
    phaseOffset,
    setWidth,
    translateX,
  ]);

  const rowStyle = tileSize === 88 ? styles.compactRow : styles.regularRow;
  const slotStyle =
    tileSize === 88 ? styles.compactSlot : styles.regularSlot;

  return (
    <View style={rowStyle}>
      <Animated.View style={[styles.track, animatedStyle]}>
        <View style={styles.tileSet}>
          {items.map((item) => (
            <View key={`first-${item.index}`} style={slotStyle}>
              <MarqueeTile
                index={item.index + itemOffset}
                size={tileSize}
                source={item.source}
              />
            </View>
          ))}
        </View>
        <View style={styles.tileSet}>
          {items.map((item) => (
            <View key={`second-${item.index}`} style={slotStyle}>
              <MarqueeTile
                index={item.index + itemOffset}
                size={tileSize}
                source={item.source}
              />
            </View>
          ))}
        </View>
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  regularRow: {
    height: 104,
    overflow: 'hidden',
    width: '100%',
  },
  compactRow: {
    height: 88,
    overflow: 'hidden',
    width: '100%',
  },
  track: {
    flexDirection: 'row',
  },
  tileSet: {
    flexDirection: 'row',
    flexShrink: 0,
  },
  regularSlot: {
    height: 104,
    width: 104 + layout.tileGap,
  },
  compactSlot: {
    height: 88,
    width: 88 + layout.tileGap,
  },
  regularTile: {
    backgroundColor: colors.tileTint,
    borderRadius: radii.tile,
    height: 104,
    overflow: 'hidden',
    width: 104,
  },
  compactTile: {
    backgroundColor: colors.tileTint,
    borderRadius: radii.tile,
    height: 88,
    overflow: 'hidden',
    width: 88,
  },
  image: {
    height: '100%',
    width: '100%',
  },
  imageOverlay: {
    backgroundColor: 'rgba(238, 247, 252, 0.38)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default MarqueeRow;
