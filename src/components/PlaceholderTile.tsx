import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii } from '../theme';

export type MarqueeTileSize = 88 | 104;

const PLACEHOLDER_EMOJIS = ['💊', '🩺', '🧴'] as const;

export interface PlaceholderTileProps {
  index: number;
  size: MarqueeTileSize;
}

export const PlaceholderTile = memo(function PlaceholderTile({
  index,
  size,
}: PlaceholderTileProps) {
  const normalizedIndex =
    ((index % PLACEHOLDER_EMOJIS.length) + PLACEHOLDER_EMOJIS.length) %
    PLACEHOLDER_EMOJIS.length;
  const emoji = PLACEHOLDER_EMOJIS[normalizedIndex];
  const tileStyle =
    size === 88 ? styles.compactTile : styles.regularTile;
  const emojiStyle =
    size === 88 ? styles.compactEmoji : styles.regularEmoji;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={tileStyle}
    >
      <Text style={emojiStyle}>{emoji}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  regularTile: {
    alignItems: 'center',
    backgroundColor: colors.tileTint,
    borderRadius: radii.tile,
    height: 104,
    justifyContent: 'center',
    width: 104,
  },
  compactTile: {
    alignItems: 'center',
    backgroundColor: colors.tileTint,
    borderRadius: radii.tile,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  regularEmoji: {
    fontSize: 44,
    lineHeight: 58,
  },
  compactEmoji: {
    fontSize: 38,
    lineHeight: 50,
  },
});

export default PlaceholderTile;
