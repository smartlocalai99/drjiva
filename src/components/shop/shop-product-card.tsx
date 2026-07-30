import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardRadii, dashboardSpacing, dashboardTypography } from '../../dashboardTheme';
import { formatShopProductPrice } from '../../lib/currency';
import type { ShopProduct } from '../../data/shopProducts';
import { ProductQuantityControl } from './product-quantity-control';

export function ShopProductCard({
  onAdd,
  onDecrement,
  onIncrement,
  onOpen,
  product,
  quantity,
}: {
  onAdd: () => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onOpen: () => void;
  product: ShopProduct;
  quantity: number;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`${product.name}, ${product.packSize}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.pressable}
      >
        <View style={styles.imageWrap}>
          <Image
            accessibilityLabel={product.name}
            cachePolicy="memory-disk"
            contentFit="contain"
            recyclingKey={product.id}
            source={{ uri: product.imageUrl }}
            style={styles.image}
            transition={120}
          />
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {product.packSize}
          </Text>
        </View>
      </Pressable>

      <View style={styles.chipRow}>
        <View style={styles.priceChip}>
          <Ionicons color={dashboardColors.primary} name="pricetag-outline" size={13} />
          <Text style={styles.priceChipText}>{formatShopProductPrice(product.price)}</Text>
        </View>

        <ProductQuantityControl
          onAdd={onAdd}
          onDecrement={onDecrement}
          onIncrement={onIncrement}
          productName={product.name}
          quantity={quantity}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    marginBottom: dashboardSpacing.gap,
    overflow: 'hidden',
  },
  pressable: {
    width: '100%',
  },
  imageWrap: {
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    height: 152,
    justifyContent: 'center',
    width: '100%',
  },
  image: {
    height: '82%',
    width: '82%',
  },
  copy: {
    padding: dashboardSpacing.md,
    paddingBottom: dashboardSpacing.sm,
  },
  name: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    lineHeight: 19,
  },
  meta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  chipRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    justifyContent: 'space-between',
    paddingBottom: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.md,
  },
  priceChip: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 5,
    height: 40,
    paddingHorizontal: 12,
  },
  priceChipText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
});
