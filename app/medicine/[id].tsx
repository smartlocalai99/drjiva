import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PressableScale } from "../../src/components/PressableScale";
import { MedicineDetailContent } from "../../src/components/shop/medicine-detail-content";
import { ProductQuantityControl } from "../../src/components/shop/product-quantity-control";
import {
  ProductDetailHeaderActions,
  ProductDetailBackButton,
  ProductDetailHeaderTitle,
} from "../../src/components/shop/product-detail-header";
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from "../../src/dashboardTheme";
import { getShopProductRecommendations } from "../../src/data/shop-recommendations";
import {
  fetchShopProductById,
  fetchShopProducts,
  type ShopProduct,
} from "../../src/data/shopProducts";
import { useCart } from "../../src/lib/cart";
import { useLanguage } from "../../src/lib/i18n";
import { getShopProductRating } from "../../src/lib/shop-product-rating";

export default function MedicineDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string | string[];
    phone?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const phoneParam = Array.isArray(params.phone)
    ? params.phone[0]
    : params.phone;
  const phone = (phoneParam ?? "").replace(/\D/g, "").slice(-10);
  const cart = useCart();

  const [product, setProduct] = useState<ShopProduct | null>();
  const [relatedProducts, setRelatedProducts] = useState<ShopProduct[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [isHeaderCondensed, setIsHeaderCondensed] = useState(false);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      return;
    }

    const controller = new AbortController();
    setProduct(undefined);
    setError(false);

    fetchShopProductById(id, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setProduct(result);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true);
        }
      });

    return () => controller.abort();
  }, [attempt, id]);

  useEffect(() => {
    if (!product) {
      setRelatedProducts([]);
      return;
    }

    const controller = new AbortController();
    fetchShopProducts("", controller.signal)
      .then((catalogue) => {
        if (!controller.signal.aborted) {
          setRelatedProducts(getShopProductRecommendations(catalogue, product));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setRelatedProducts([]);
        }
      });

    return () => controller.abort();
  }, [product]);

  const isLoading = product === undefined;
  const quantity = product ? cart.getQuantity(product.id) : 0;
  const recentOrders = product
    ? getShopProductRating(product.id, product.name).recentOrders
    : 0;

  const actionBarHeight = 112 + insets.bottom;

  const openProduct = (nextProduct: ShopProduct) => {
    router.push({
      params: { id: nextProduct.id, phone },
      pathname: "/medicine/[id]",
    });
  };

  return (
    <View style={styles.safeArea}>
      <Stack.Screen
        options={{
          headerBackVisible: false,
          headerLeft: () => (
            <ProductDetailBackButton onPress={() => router.back()} />
          ),
          headerRight: isHeaderCondensed
            ? () => (
                <ProductDetailHeaderActions
                  cartCount={cart.totalItems}
                  onOpenCart={() =>
                    router.push({ params: { phone }, pathname: "/cart" })
                  }
                  onSearch={() =>
                    router.push({ params: { phone }, pathname: "/shop" })
                  }
                />
              )
            : undefined,
          headerShadowVisible: false,
          headerShown: true,
          headerStyle: { backgroundColor: "#FFFFFF" },
          headerTitle: () => (
            <ProductDetailHeaderTitle
              condensed={isHeaderCondensed}
              fallbackTitle={t("medicineDetails")}
              product={product}
            />
          ),
          headerTitleAlign: "left",
          title: t("medicineDetails"),
        }}
      />

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={dashboardColors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons
            color={dashboardColors.textFaint}
            name="cloud-offline-outline"
            size={28}
          />
          <Text style={styles.stateTitle}>Couldn't load this medicine</Text>
          <PressableScale
            onPress={() => setAttempt((current) => current + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </PressableScale>
        </View>
      ) : !product ? (
        <View style={styles.centerState}>
          <Ionicons
            color={dashboardColors.textFaint}
            name="medkit-outline"
            size={28}
          />
          <Text style={styles.stateTitle}>Medicine not found</Text>
          <Pressable onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingBottom: actionBarHeight + dashboardSpacing.md,
            }}
            contentInsetAdjustmentBehavior="automatic"
            onScroll={({ nativeEvent }) => {
              const shouldCondense = nativeEvent.contentOffset.y > 180;
              setIsHeaderCondensed((current) =>
                current === shouldCondense ? current : shouldCondense,
              );
            }}
            scrollEventThrottle={16}
          >
            <MedicineDetailContent
              onAddRelatedProduct={(relatedProduct) => {
                void Haptics.impactAsync(
                  Haptics.ImpactFeedbackStyle.Light,
                ).catch(() => undefined);
                cart.add(relatedProduct);
              }}
              onOpenRelatedProduct={openProduct}
              product={product}
              relatedProducts={relatedProducts}
            />
          </ScrollView>

          <View
            style={[styles.actionBar, { paddingBottom: insets.bottom }]}
          >
            <View style={styles.orderSignal}>
              <Ionicons color="#15803D" name="stats-chart" size={18} />
              <Text style={styles.orderSignalText}>
                {recentOrders} people ordered in the last 7 days
              </Text>
            </View>
            <View style={styles.actionControls}>
              {quantity === 0 ? (
                <PressableScale
                  accessibilityLabel={`Add ${product.name} to bag`}
                  onPress={() => {
                    void Haptics.impactAsync(
                      Haptics.ImpactFeedbackStyle.Light,
                    ).catch(() => undefined);
                    cart.add(product);
                  }}
                  pressedScale={0.97}
                  style={styles.addToCartButton}
                >
                  <Ionicons color="#FFFFFF" name="bag-add-outline" size={20} />
                  <Text style={styles.addToCartText}>Add to cart</Text>
                </PressableScale>
              ) : (
                <>
                  <ProductQuantityControl
                    onAdd={() => cart.add(product)}
                    onDecrement={() => cart.decrement(product.id)}
                    onIncrement={() => cart.increment(product.id)}
                    productName={product.name}
                    quantity={quantity}
                  />
                  <PressableScale
                    accessibilityLabel={`View cart with ${cart.totalItems} items`}
                    onPress={() =>
                      router.push({ params: { phone }, pathname: "/checkout" })
                    }
                    pressedScale={0.97}
                    style={styles.viewCartButton}
                  >
                    <Ionicons
                      color="#FFFFFF"
                      name="bag-check-outline"
                      size={19}
                    />
                    <View style={styles.viewCartCopy}>
                      <Text style={styles.viewCartTitle}>View cart</Text>
                      <Text style={styles.viewCartSubtitle}>
                        {cart.totalItems}{" "}
                        {cart.totalItems === 1 ? "item" : "items"}
                      </Text>
                    </View>
                    <Ionicons color="#FFFFFF" name="arrow-forward" size={17} />
                  </PressableScale>
                </>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: "#FFFFFF",
    flex: 1,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    gap: dashboardSpacing.sm,
    justifyContent: "center",
    paddingHorizontal: dashboardSpacing.xl,
  },
  stateTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    marginTop: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.xl,
    paddingVertical: dashboardSpacing.sm,
  },
  retryText: {
    ...dashboardTypography.body,
    color: dashboardColors.primary,
    fontFamily: "Inter_700Bold",
  },
  actionBar: {
    backgroundColor: "#FFFFFF",
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
  },
  orderSignal: {
    alignItems: "center",
    backgroundColor: "#E9FBF0",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
    height: 38,
    justifyContent: "center",
    paddingHorizontal: dashboardSpacing.md,
  },
  orderSignalText: {
    ...dashboardTypography.body,
    color: "#166534",
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  actionControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: dashboardSpacing.sm,
    height: 74,
    paddingHorizontal: dashboardSpacing.gap,
    paddingVertical: dashboardSpacing.md,
  },
  addToCartButton: {
    alignItems: "center",
    backgroundColor: dashboardColors.primary,
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: dashboardSpacing.sm,
    height: 50,
    justifyContent: "center",
  },
  addToCartText: {
    ...dashboardTypography.button,
    color: "#FFFFFF",
    fontSize: 15,
  },
  viewCartButton: {
    alignItems: "center",
    backgroundColor: dashboardColors.primary,
    borderRadius: 14,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    height: 50,
    paddingHorizontal: 13,
  },
  viewCartCopy: {
    flex: 1,
  },
  viewCartTitle: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
    fontSize: 13,
  },
  viewCartSubtitle: {
    color: "#D9E8F3",
    fontFamily: "Inter_500Medium",
    fontSize: 9,
  },
});
