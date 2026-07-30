import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dashboardColors, dashboardSpacing, dashboardTypography } from '../../dashboardTheme';
import { formatShopProductPrice } from '../../lib/currency';
import type { ShopProduct } from '../../data/shopProducts';
import { ProductQuantityControl } from './product-quantity-control';

export function ShopProductRow({
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
    <View style={styles.row}>
      <Pressable
        accessibilityLabel={`${product.name}, ${product.packSize}`}
        accessibilityRole="button"
        onPress={onOpen}
        style={styles.body}
      >
        <Image
          accessibilityLabel={product.name}
          cachePolicy="memory-disk"
          contentFit="contain"
          recyclingKey={product.id}
          source={{ uri: product.imageUrl }}
          style={styles.image}
          transition={120}
        />
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {product.packSize}
          </Text>
          <Text style={styles.price}>
            {formatShopProductPrice(product.price)}
          </Text>
        </View>
      </Pressable>

      <ProductQuantityControl
        onAdd={onAdd}
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        productName={product.name}
        quantity={quantity}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    paddingVertical: dashboardSpacing.md,
  },
  body: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
  },
  image: {
    height: 72,
    width: 72,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 18,
  },
  meta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  price: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 15,
    marginTop: 5,
  },
});
