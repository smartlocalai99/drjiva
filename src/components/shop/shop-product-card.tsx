import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../dashboardTheme";
import type { ShopProduct } from "../../data/shopProducts";
import {
  formatShopProductMrp,
  formatShopProductPrice,
  SHOP_DISCOUNT_PERCENT,
} from "../../lib/currency";
import { getShopProductRating } from "../../lib/shop-product-rating";
import { HospitalLogo } from "../HospitalLogo";
import { ProductQuantityControl } from "./product-quantity-control";

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
  const rating = getShopProductRating(product.id, product.name);

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
          <View style={styles.supplierRow}>
            <HospitalLogo hospitalName={product.hospitalName} size={18} />
            <Text numberOfLines={1} style={styles.supplier}>
              {product.hospitalName}
            </Text>
          </View>
          <View style={styles.ratingRow}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingValue}>{rating.label}</Text>
              <Ionicons color="#FFFFFF" name="star" size={12} />
            </View>
            <Text style={styles.ratingCount}>{rating.count} ratings</Text>
          </View>
          <View style={styles.fulfilmentRow}>
            <View style={styles.deliveryEta}>
              <View style={styles.deliveryIcon}>
                <Ionicons
                  color={dashboardColors.primary}
                  name="bicycle-outline"
                  size={18}
                />
              </View>
              <View style={styles.deliveryCopy}>
                <Text style={styles.deliveryTitle}>Get it in 15 mins</Text>
                <Text style={styles.deliverySubtitle}>Fast delivery</Text>
              </View>
            </View>
            <View style={styles.freeDeliveryBadge}>
              <Ionicons color="#15803D" name="cube-outline" size={14} />
              <Text style={styles.freeDeliveryText}>Free delivery</Text>
            </View>
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
    overflow: "hidden",
  },
  pressable: {
    width: "100%",
  },
  imageWrap: {
    alignItems: "center",
    backgroundColor: dashboardColors.productImageBg,
    height: 164,
    justifyContent: "center",
    position: "relative",
    width: "100%",
  },
  image: {
    height: "94%",
    width: "94%",
  },
  offerBadge: {
    alignItems: "center",
    backgroundColor: "#FFF1F2",
    borderColor: "#FECDD3",
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    left: dashboardSpacing.sm,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: "absolute",
    top: dashboardSpacing.sm,
  },
  offerBadgeText: {
    ...dashboardTypography.caption,
    color: "#DC2626",
    fontFamily: "Inter_700Bold",
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
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    lineHeight: 19,
  },
  meta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  supplierRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    marginTop: 5,
  },
  supplier: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    flex: 1,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
  },
  ratingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
    marginTop: dashboardSpacing.sm,
  },
  ratingBadge: {
    alignItems: "center",
    backgroundColor: "#15803D",
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  ratingValue: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    lineHeight: 15,
  },
  ratingCount: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 12,
  },
  fulfilmentRow: {
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderColor: dashboardColors.track,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: dashboardSpacing.sm,
    justifyContent: "space-between",
    marginTop: dashboardSpacing.sm,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  deliveryEta: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  deliveryIcon: {
    alignItems: "center",
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 16,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  deliveryCopy: {
    flex: 1,
    minWidth: 0,
  },
  deliveryTitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    lineHeight: 14,
  },
  deliverySubtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: "Inter_600SemiBold",
    fontSize: 10,
    lineHeight: 13,
    marginTop: 1,
  },
  freeDeliveryBadge: {
    alignItems: "center",
    backgroundColor: "#ECFDF3",
    borderRadius: dashboardRadii.pill,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  freeDeliveryText: {
    ...dashboardTypography.caption,
    color: "#15803D",
    fontFamily: "Inter_700Bold",
    fontSize: 10,
    lineHeight: 13,
  },
  chipRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
    justifyContent: "space-between",
    minHeight: 64,
    paddingBottom: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.md,
    paddingTop: dashboardSpacing.xs,
  },
  priceStack: {
    flexShrink: 1,
    gap: 1,
  },
  mrpRow: {
    alignItems: "center",
    flexDirection: "row",
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
    textDecorationLine: "line-through",
  },
  price: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.primaryDark,
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    marginTop: 1,
  },
});
