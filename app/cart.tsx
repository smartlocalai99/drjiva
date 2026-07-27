import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { SHOP_PRODUCTS, type ShopProduct } from '../src/data/shopProducts';
import { useCart } from '../src/lib/cart';
import { useLanguage } from '../src/lib/i18n';

const TINTS = {
  error: { bg: dashboardColors.errorTint, fg: dashboardColors.error },
  primary: { bg: dashboardColors.primaryTint, fg: dashboardColors.primary },
  success: { bg: dashboardColors.successTint, fg: dashboardColors.success },
  warning: { bg: dashboardColors.warningTint, fg: dashboardColors.warning },
} as const;

type CartLine = {
  product: ShopProduct;
  quantity: number;
};

export default function CartScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const { decrement, increment, quantities } = useCart();

  const lines = useMemo<CartLine[]>(() => {
    return SHOP_PRODUCTS.filter((product) => (quantities[product.id] ?? 0) > 0).map(
      (product) => ({ product, quantity: quantities[product.id] ?? 0 }),
    );
  }, [quantities]);

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [lines],
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleBrowseShop = () => {
    router.replace({ params: { phone }, pathname: '/shop' });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          hitSlop={12}
          onPress={handleBack}
          style={styles.backButton}
        >
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{t('cart')}</Text>
          {itemCount > 0 ? (
            <Text style={styles.headerCount}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
          ) : null}
        </View>
        <View style={styles.backButton} />
      </View>

      {lines.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons color={dashboardColors.textFaint} name="cart-outline" size={40} />
          </View>
          <Text style={styles.emptyTitle}>{t('cartEmptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('cartEmptySubtitle')}</Text>
          <PressableScale
            accessibilityLabel={t('shop')}
            onPress={handleBrowseShop}
            pressedScale={0.97}
            style={styles.browseButton}
          >
            <Text style={styles.browseButtonText}>{t('shop')}</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {lines.map((line) => {
              const tint = TINTS[line.product.tint];
              return (
                <View key={line.product.id} style={styles.row}>
                  <View style={[styles.thumb, { backgroundColor: tint.bg }]}>
                    <Ionicons color={tint.fg} name={line.product.icon} size={26} />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>{line.product.name}</Text>
                    <Text style={styles.rowPack}>{line.product.packSize}</Text>
                    <Text style={styles.rowPrice}>₹{line.product.price}</Text>
                  </View>
                  <View style={styles.stepper}>
                    <PressableScale
                      accessibilityLabel="Decrease quantity"
                      onPress={() => decrement(line.product.id)}
                      pressedScale={0.9}
                      style={styles.stepperButton}
                    >
                      <Ionicons
                        color={dashboardColors.primary}
                        name={line.quantity === 1 ? 'trash-outline' : 'remove'}
                        size={16}
                      />
                    </PressableScale>
                    <Text style={styles.stepperValue}>{line.quantity}</Text>
                    <PressableScale
                      accessibilityLabel="Increase quantity"
                      onPress={() => increment(line.product.id)}
                      pressedScale={0.9}
                      style={styles.stepperButton}
                    >
                      <Ionicons color={dashboardColors.primary} name="add" size={16} />
                    </PressableScale>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + dashboardSpacing.gap }]}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>{t('cartTotal')}</Text>
              <Text style={styles.totalValue}>₹{total}</Text>
            </View>
            <PressableScale
              accessibilityLabel={t('checkout')}
              onPress={() => Alert.alert(t('checkout'), t('comingSoon'))}
              pressedScale={0.98}
              style={styles.checkoutButton}
            >
              <Text style={styles.checkoutButtonText}>{t('checkout')}</Text>
            </PressableScale>
          </View>
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
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
  },
  backButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  headerCount: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: dashboardSpacing.xl,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 48,
    height: 96,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.xl,
    width: 96,
  },
  emptyTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  browseButton: {
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    marginTop: dashboardSpacing.xl,
    paddingHorizontal: dashboardSpacing.xl,
    paddingVertical: 14,
  },
  browseButtonText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  row: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    marginBottom: dashboardSpacing.md,
    padding: dashboardSpacing.md,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  thumb: {
    alignItems: 'center',
    borderRadius: dashboardRadii.card - 8,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 15,
  },
  rowPack: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  rowPrice: {
    ...dashboardTypography.body,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
    marginTop: 2,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.sm,
    paddingVertical: 6,
  },
  stepperButton: {
    alignItems: 'center',
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  stepperValue: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  footer: {
    borderTopColor: dashboardColors.track,
    borderTopWidth: 1,
    paddingBottom: dashboardSpacing.xl,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.gap,
  },
  totalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: dashboardSpacing.gap,
  },
  totalLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
  },
  totalValue: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  checkoutButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    height: 52,
    justifyContent: 'center',
  },
  checkoutButtonText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
});
