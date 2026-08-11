import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { ShopProduct } from '../../data/shopProducts';
import {
  formatShopProductMrp,
  formatShopProductPrice,
  SHOP_DISCOUNT_PERCENT,
} from '../../lib/currency';
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
          <View style={styles.offerBadge}>
            <Ionicons color="#DC2626" name="pricetag" size={12} />
            <Text style={styles.offerBadgeText}>
              {SHOP_DISCOUNT_PERCENT}% OFF
            </Text>
          </View>
        </View>
        <View style={styles.copy}>
          <Text numberOfLines={2} style={styles.name}>
            {product.name}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {product.packSize}
          </Text>
          <View style={styles.deliveryBenefit}>
            <Ionicons
              color={dashboardColors.primary}
              name="bicycle-outline"
              size={15}
            />
            <Text style={styles.deliveryBenefitText}>Free delivery</Text>
          </View>
        </View>
      </Pressable>

      <View style={styles.chipRow}>
        <View style={styles.priceStack}>
          <View style={styles.mrpRow}>
            <Text style={styles.mrpLabel}>MRP</Text>
            <Text style={styles.mrpPrice}>
              {formatShopProductMrp(product.price)}
            </Text>
          </View>
          <Text style={styles.price}>
            {formatShopProductPrice(product.price)}
          </Text>
          <Text style={styles.offerText}>
            {SHOP_DISCOUNT_PERCENT}% offer
          </Text>
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
    backgroundColor: '#D9D9D9',
    height: 152,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  image: {
    height: '82%',
    width: '82%',
  },
  offerBadge: {
    alignItems: 'center',
    backgroundColor: '#FFF1F2',
    borderColor: '#FECDD3',
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    left: dashboardSpacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
    top: dashboardSpacing.sm,
  },
  offerBadgeText: {
    ...dashboardTypography.caption,
    color: '#DC2626',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    lineHeight: 12,
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
  deliveryBenefit: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 5,
    marginTop: dashboardSpacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  deliveryBenefitText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    lineHeight: 13,
  },
  chipRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    justifyContent: 'space-between',
    paddingBottom: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.md,
  },
  priceStack: {
    flexShrink: 1,
  },
  mrpRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  mrpLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 10,
  },
  mrpPrice: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 11,
    textDecorationLine: 'line-through',
  },
  price: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    marginTop: 1,
  },
  offerText: {
    ...dashboardTypography.caption,
    color: '#DC2626',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    marginTop: 1,
  },
});
