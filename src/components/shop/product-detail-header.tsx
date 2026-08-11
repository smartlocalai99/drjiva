import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { ShopProduct } from '../../data/shopProducts';
import {
  formatShopProductMrp,
  formatShopProductPrice,
  SHOP_DISCOUNT_PERCENT,
} from '../../lib/currency';

export function ProductDetailHeaderTitle({
  condensed,
  fallbackTitle,
  product,
}: {
  condensed: boolean;
  fallbackTitle: string;
  product: ShopProduct | null | undefined;
}) {
  if (!condensed || !product) {
    return (
      <Text numberOfLines={1} style={styles.fallbackTitle}>
        {fallbackTitle}
      </Text>
    );
  }

  return (
    <View style={styles.titleWrap}>
      <Text numberOfLines={1} style={styles.productName}>
        {product.name}
      </Text>
      <View style={styles.priceRow}>
        <Text style={styles.price}>{formatShopProductPrice(product.price)}</Text>
        <Text style={styles.mrp}>
          MRP {formatShopProductMrp(product.price)}
        </Text>
        <View style={styles.divider} />
        <Text style={styles.discount}>{SHOP_DISCOUNT_PERCENT}% off</Text>
      </View>
    </View>
  );
}

export function ProductDetailHeaderActions({
  cartCount,
  onOpenCart,
  onSearch,
}: {
  cartCount: number;
  onOpenCart: () => void;
  onSearch: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        accessibilityLabel="Search medicines"
        accessibilityRole="button"
        hitSlop={8}
        onPress={onSearch}
        style={styles.iconButton}
      >
        <Ionicons color={dashboardColors.text} name="search-outline" size={23} />
      </Pressable>
      <Pressable
        accessibilityLabel={`Open cart with ${cartCount} items`}
        accessibilityRole="button"
        hitSlop={8}
        onPress={onOpenCart}
        style={styles.iconButton}
      >
        <Ionicons color={dashboardColors.text} name="cart-outline" size={24} />
        {cartCount > 0 ? (
          <View style={styles.cartBadge}>
            <Text style={styles.cartBadgeText}>
              {cartCount > 99 ? '99+' : cartCount}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackTitle: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  titleWrap: {
    gap: 1,
    maxWidth: 190,
  },
  productName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    lineHeight: 17,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  price: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  mrp: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 9,
    textDecorationLine: 'line-through',
  },
  divider: {
    backgroundColor: dashboardColors.track,
    height: 12,
    width: 1,
  },
  discount: {
    ...dashboardTypography.caption,
    color: '#15803D',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    position: 'relative',
    width: 36,
  },
  cartBadge: {
    alignItems: 'center',
    backgroundColor: '#DC2626',
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -1,
    top: 1,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 8,
    fontVariant: ['tabular-nums'],
  },
});
