import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import {
  Dimensions,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { colors, layout, spacing } from '../theme';
import MarqueeRow, { type CarouselImage } from './MarqueeRow';
import type { MarqueeTileSize } from './PlaceholderTile';

export const CAROUSEL_IMAGES: CarouselImage[] = [
  require('../../assets/carousel/ritish.png'),
  require('../../assets/carousel/prime.png'),
      require('../../assets/carousel/rekha.png'),
  require('../../assets/carousel/prime2.png'),

  require('../../assets/carousel/holistics.png'),
    require('../../assets/carousel/asian.png'),

  require('../../assets/carousel/holistics2.png'),
];

const DEVICE_SCREEN_HEIGHT = Dimensions.get('screen').height;

export const PillMarquee = memo(function PillMarquee() {
  const { width } = useWindowDimensions();
  const tileSize: MarqueeTileSize =
    DEVICE_SCREEN_HEIGHT < 700 ? 88 : 104;
  const stride = tileSize + spacing.md;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.container}
    >
      <View style={styles.rows}>
        <MarqueeRow
          direction="left-to-right"
          images={CAROUSEL_IMAGES}
          itemOffset={0}
          phaseOffset={0}
          screenWidth={width}
          tileSize={tileSize}
        />
        <MarqueeRow
          direction="right-to-left"
          images={CAROUSEL_IMAGES}
          itemOffset={2}
          phaseOffset={-0.4 * stride}
          screenWidth={width}
          tileSize={tileSize}
        />
        <MarqueeRow
          direction="left-to-right"
          images={CAROUSEL_IMAGES}
          itemOffset={4}
          phaseOffset={-0.75 * stride}
          screenWidth={width}
          tileSize={tileSize}
        />
      </View>
      <LinearGradient
        colors={[colors.transparentWhite, colors.bg]}
        locations={[0, 1]}
        style={styles.fade}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    pointerEvents: 'none',
    width: '100%',
  },
  rows: {
    gap: spacing.md,
  },
  fade: {
    bottom: 0,
    height: layout.marqueeFadeHeight,
    left: 0,
    pointerEvents: 'none',
    position: 'absolute',
    right: 0,
  },
});

export default PillMarquee;
