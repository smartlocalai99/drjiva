import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import {
  Stack,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  BottomNav,
  type NavTabKey,
} from '../../src/components/dashboard/BottomNav';
import { PressableScale } from '../../src/components/PressableScale';
import { MedicineDetailContent } from '../../src/components/shop/medicine-detail-content';
import { ProductQuantityControl } from '../../src/components/shop/product-quantity-control';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../src/dashboardTheme';
import { fetchShopProductById, type ShopProduct } from '../../src/data/shopProducts';
import { useCart } from '../../src/lib/cart';
import { getTabRoute } from '../../src/lib/dashboardNav';
import { useLanguage } from '../../src/lib/i18n';

export default function MedicineDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[]; phone?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const cart = useCart();

  const [activeTab, setActiveTab] = useState<NavTabKey>('shop');
  const [product, setProduct] = useState<ShopProduct | null>();
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

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

  const isLoading = product === undefined;
  const quantity = product ? cart.getQuantity(product.id) : 0;

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const bottomBarHeight =
    cart.totalItems > 0 ? 68 : dashboardLayout.bottomNavHeight;
  const actionBarOffset = navBottomOffset + bottomBarHeight + dashboardSpacing.sm;
  const actionBarHeight = 76;

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === activeTab) {
      return;
    }
    const route = getTabRoute(tab);
    if (!route) {
      return;
    }
    setActiveTab(tab);
    router.replace({ params: { phone }, pathname: route });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <Stack.Screen
        options={{
          headerBackButtonDisplayMode: 'minimal',
          headerShadowVisible: false,
          headerShown: true,
          title: t('medicineDetails'),
        }}
      />

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={dashboardColors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons color={dashboardColors.textFaint} name="cloud-offline-outline" size={28} />
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
          <Ionicons color={dashboardColors.textFaint} name="medkit-outline" size={28} />
          <Text style={styles.stateTitle}>Medicine not found</Text>
          <Pressable onPress={() => router.back()} style={styles.retryButton}>
            <Text style={styles.retryText}>Back</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{
              paddingBottom: actionBarOffset + actionBarHeight + dashboardSpacing.md,
            }}
            contentInsetAdjustmentBehavior="automatic"
          >
            <MedicineDetailContent product={product} />
          </ScrollView>

          <View style={[styles.actionBar, { bottom: actionBarOffset }]}>
            {quantity === 0 ? (
              <PressableScale
                accessibilityLabel={`Add ${product.name} to bag`}
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
                    () => undefined,
                  );
                  cart.add(product);
                }}
                pressedScale={0.97}
                style={styles.addToCartButton}
              >
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
                  accessibilityLabel="Go to cart"
                  onPress={() =>
                    router.push({ params: { phone }, pathname: '/cart' })
                  }
                  pressedScale={0.97}
                  style={styles.goToCartButton}
                >
                  <Text style={styles.addToCartText}>Go to cart</Text>
                </PressableScale>
              </>
            )}
          </View>

          {cart.totalItems > 0 ? (
            <PressableScale
              accessibilityLabel={`Checkout ${cart.totalItems} items`}
              onPress={() =>
                router.push({ params: { phone }, pathname: '/checkout' })
              }
              pressedScale={0.985}
              style={[styles.checkoutBar, { bottom: navBottomOffset }]}
            >
              <View style={styles.checkoutBag}>
                <Ionicons color="#FFFFFF" name="bag-check-outline" size={21} />
              </View>
              <View style={styles.checkoutCopy}>
                <Text style={styles.checkoutTitle}>Checkout</Text>
                <Text style={styles.checkoutSubtitle}>
                  {cart.totalItems} {cart.totalItems === 1 ? 'item' : 'items'}
                </Text>
              </View>
              <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
            </PressableScale>
          ) : (
            <BottomNav
              activeTab={activeTab}
              bottomOffset={navBottomOffset}
              onSelectTab={handleSelectTab}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    gap: dashboardSpacing.sm,
    justifyContent: 'center',
    paddingHorizontal: dashboardSpacing.xl,
  },
  stateTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    textAlign: 'center',
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
    fontFamily: 'Inter_700Bold',
  },
  actionBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 60,
    justifyContent: 'space-between',
    left: dashboardSpacing.pagePadding,
    paddingHorizontal: dashboardSpacing.sm,
    position: 'absolute',
    right: dashboardSpacing.pagePadding,
  },
  addToCartButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    flex: 1,
    height: 46,
    justifyContent: 'center',
  },
  goToCartButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: dashboardSpacing.md,
  },
  addToCartText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
    fontSize: 14,
  },
  checkoutBar: {
    alignItems: 'center',
    backgroundColor: '#102A56',
    borderRadius: 22,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    height: 68,
    left: dashboardSpacing.pagePadding,
    paddingHorizontal: dashboardSpacing.md,
    position: 'absolute',
    right: dashboardSpacing.pagePadding,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
  },
  checkoutBag: {
    alignItems: 'center',
    backgroundColor: '#2563EB',
    borderRadius: 18,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  checkoutCopy: {
    flex: 1,
  },
  checkoutTitle: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  checkoutSubtitle: {
    color: '#AFC6F4',
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    marginTop: 1,
  },
});
