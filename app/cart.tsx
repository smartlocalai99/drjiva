import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import type { ShopProduct } from '../src/data/shopProducts';
import { loadAddresses } from '../src/lib/addressStorage';
import {
  getDefaultAddress,
  type SavedAddress,
} from '../src/lib/addresses';
import { useCart } from '../src/lib/cart';
import {
  formatRupees,
  formatShopProductPrice,
  resolveShopProductPrice,
} from '../src/lib/currency';
import { useLanguage } from '../src/lib/i18n';

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
  const { decrement, increment, products, quantities } = useCart();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);

  const lines = useMemo<CartLine[]>(() => {
    return Object.entries(quantities).flatMap(([id, quantity]) => {
      const product = products[id];
      return product && quantity > 0 ? [{ product, quantity }] : [];
    });
  }, [products, quantities]);

  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );

  const total = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + resolveShopProductPrice(line.product.price) * line.quantity,
        0,
      ),
    [lines],
  );
  const deliveryAddress = useMemo(
    () => getDefaultAddress(addresses),
    [addresses],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoadingAddress(true);
      void loadAddresses(phone)
        .then((nextAddresses) => {
          if (!cancelled) {
            setAddresses(nextAddresses);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setAddresses([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setIsLoadingAddress(false);
          }
        });

      return () => {
        cancelled = true;
      };
    }, [phone]),
  );

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    }
  };

  const handleBrowseShop = () => {
    router.replace({ params: { phone }, pathname: '/shop' });
  };

  const openDeliveryAddresses = () => {
    router.push({ params: { phone }, pathname: '/saved-addresses' });
  };

  const handleCheckout = () => {
    router.push({ params: { phone }, pathname: '/checkout' });
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
            <DeliveryAddressCard
              address={deliveryAddress}
              isLoading={isLoadingAddress}
              onPress={openDeliveryAddresses}
            />
            {lines.map((line) => {
              return (
                <View key={line.product.id} style={styles.row}>
                  <View style={styles.thumb}>
                    <Image
                      accessibilityLabel={line.product.name}
                      contentFit="contain"
                      source={{ uri: line.product.imageUrl }}
                      style={styles.thumbImage}
                    />
                  </View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowName}>{line.product.name}</Text>
                    <Text style={styles.rowPack}>{line.product.packSize}</Text>
                    <Text style={styles.rowPrice}>
                      {formatShopProductPrice(line.product.price)}
                    </Text>
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
              <Text style={styles.totalValue}>{formatRupees(total)}</Text>
            </View>
            <PressableScale
              accessibilityLabel={t('checkout')}
              onPress={handleCheckout}
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

function DeliveryAddressCard({
  address,
  isLoading,
  onPress,
}: {
  address: SavedAddress | undefined;
  isLoading: boolean;
  onPress: () => void;
}) {
  const label = address
    ? address.label === 'Other'
      ? address.customLabel || 'Other'
      : address.label
    : '';
  const addressLine = address
    ? [address.building, address.area, address.city, address.pinCode]
        .filter(Boolean)
        .join(', ')
    : '';

  return (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressTitleRow}>
          <Ionicons
            color={dashboardColors.primary}
            name="location-outline"
            size={20}
          />
          <Text style={styles.addressTitle}>Delivery address</Text>
        </View>
        {!isLoading ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
            <Text style={styles.addressAction}>
              {address ? 'Change' : 'Add address'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {isLoading ? (
        <ActivityIndicator
          color={dashboardColors.primary}
          style={styles.addressLoading}
        />
      ) : address ? (
        <>
          <Text style={styles.addressLabel}>
            {label} · {address.recipientName}
          </Text>
          <Text numberOfLines={2} style={styles.addressLine}>
            {addressLine}
          </Text>
        </>
      ) : (
        <Text style={styles.addressEmpty}>
          Add an address before checking out.
        </Text>
      )}
    </View>
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
  addressCard: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    marginBottom: dashboardSpacing.gap,
    padding: dashboardSpacing.md,
  },
  addressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  addressTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
  },
  addressTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
  },
  addressAction: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  addressLoading: {
    alignSelf: 'flex-start',
    marginTop: dashboardSpacing.md,
  },
  addressLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    marginTop: dashboardSpacing.md,
  },
  addressLine: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    lineHeight: 18,
    marginTop: 3,
  },
  addressEmpty: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.md,
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
    backgroundColor: '#F8FAFC',
    borderRadius: dashboardRadii.card - 8,
    height: 56,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 56,
  },
  thumbImage: {
    height: '100%',
    width: '100%',
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
