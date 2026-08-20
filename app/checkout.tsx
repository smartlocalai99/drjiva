import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { loadAddresses } from '../src/lib/addressStorage';
import {
  getDefaultAddress,
  type SavedAddress,
} from '../src/lib/addresses';
import { useCart } from '../src/lib/cart';
import { formatRupees, resolveShopProductPrice } from '../src/lib/currency';
import { confirmPlacedOrder } from '../src/lib/orderConfirmation';
import { showOrderReceiptNotification } from '../src/lib/orderReceiptNotification';
import {
  createOrderRequestId,
  placeCodOrder,
  type PlacedOrder,
} from '../src/lib/orders';
import { getPatientByPhone } from '../src/lib/patients';

const ORDER_SUCCESS_SOUND = require('../assets/sounds/success.wav');

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const cart = useCart();
  const successPlayer = useAudioPlayer(ORDER_SUCCESS_SOUND);

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>();
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder>();
  const requestIdRef = useRef<string | undefined>(undefined);

  // Checking out is account-based (needs a phone number for delivery) —
  // guests who reach this screen without one (e.g. a stale deep link) get
  // sent to log in first, per Apple guideline 5.1.1: browsing stays open,
  // registration is only required for account-based actions like this one.
  useEffect(() => {
    if (!phone) {
      router.replace('/');
    }
  }, [phone, router]);

  const lines = useMemo(
    () =>
      Object.entries(cart.quantities).flatMap(([id, quantity]) => {
        const product = cart.products[id];
        return product && quantity > 0 ? [{ product, quantity }] : [];
      }),
    [cart.products, cart.quantities],
  );
  const itemCount = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity, 0),
    [lines],
  );
  const subtotal = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + resolveShopProductPrice(line.product.price) * line.quantity,
        0,
      ),
    [lines],
  );
  const selectedAddress = useMemo(
    () =>
      addresses.find((address) => address.id === selectedAddressId) ??
      getDefaultAddress(addresses),
    [addresses, selectedAddressId],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoadingAddress(true);
      void loadAddresses(phone)
        .then((nextAddresses) => {
          if (cancelled) {
            return;
          }
          setAddresses(nextAddresses);
          setSelectedAddressId((current) => {
            if (current && nextAddresses.some((item) => item.id === current)) {
              return current;
            }
            return getDefaultAddress(nextAddresses)?.id;
          });
        })
        .catch(() => {
          if (!cancelled) {
            setAddresses([]);
            setSelectedAddressId(undefined);
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

  const placeOrder = async () => {
    if (!selectedAddress) {
      router.push({ params: { phone }, pathname: '/address-editor' });
      return;
    }
    if (isPlacingOrder) {
      return;
    }

    setIsPlacingOrder(true);
    const clientRequestId = requestIdRef.current ?? createOrderRequestId();
    requestIdRef.current = clientRequestId;
    try {
      const patient = await getPatientByPhone(phone);
      if (!patient) {
        throw new Error('Complete your patient profile before placing an order.');
      }
      const order = await placeCodOrder({
        address: selectedAddress,
        clientRequestId,
        items: lines.map((line) => ({
          medicineId: line.product.id,
          quantity: line.quantity,
        })),
        patientId: patient.patientId,
      });
      setPlacedOrder(order);
      requestIdRef.current = undefined;
      cart.clear();
      void confirmPlacedOrder(
        {
          notify: showOrderReceiptNotification,
          play: async () => {
            await successPlayer.seekTo(0);
            successPlayer.play();
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success,
            );
          },
        },
        order,
      );
    } catch (cause) {
      Alert.alert(
        'Order not placed',
        cause instanceof Error
          ? cause.message
          : 'We could not place your order. Please try again.',
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => router.back()}
          style={styles.headerSide}
        >
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Checkout</Text>
          {itemCount > 0 ? (
            <Text style={styles.headerSubtitle}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
          ) : null}
        </View>
        <View style={styles.headerSide} />
      </View>

      {placedOrder && selectedAddress ? (
        <OrderSuccess
          address={selectedAddress}
          onContinue={() =>
            router.replace({ params: { phone }, pathname: '/shop' })
          }
          order={placedOrder}
        />
      ) : lines.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons
            color={dashboardColors.textFaint}
            name="bag-handle-outline"
            size={44}
          />
          <Text style={styles.emptyTitle}>Your cart is empty</Text>
          <PressableScale
            onPress={() =>
              router.replace({ params: { phone }, pathname: '/shop' })
            }
            style={styles.shopButton}
          >
            <Text style={styles.shopButtonText}>Browse medicines</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: insets.bottom + 132 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.progressRow}>
              <ProgressStep active icon="cart" label="Cart" />
              <View style={styles.progressLine} />
              <ProgressStep active icon="location" label="Address" />
              <View style={styles.progressLine} />
              <ProgressStep active icon="cash" label="COD" />
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Delivery address</Text>
              {addresses.length > 0 ? (
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    router.push({
                      params: { phone },
                      pathname: '/saved-addresses',
                    })
                  }
                >
                  <Text style={styles.sectionAction}>Manage</Text>
                </Pressable>
              ) : null}
            </View>

            {isLoadingAddress ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={dashboardColors.primary} />
              </View>
            ) : addresses.length === 0 ? (
              <PressableScale
                onPress={() =>
                  router.push({
                    params: { phone },
                    pathname: '/address-editor',
                  })
                }
                style={styles.addAddressCard}
              >
                <View style={styles.addAddressIcon}>
                  <Ionicons
                    color={dashboardColors.primary}
                    name="add"
                    size={24}
                  />
                </View>
                <View style={styles.addAddressCopy}>
                  <Text style={styles.addAddressTitle}>Add delivery address</Text>
                  <Text style={styles.addAddressText}>
                    Add an address to continue with your order.
                  </Text>
                </View>
                <Ionicons
                  color={dashboardColors.textFaint}
                  name="chevron-forward"
                  size={20}
                />
              </PressableScale>
            ) : (
              <View style={styles.addressList}>
                {addresses.map((address) => (
                  <CheckoutAddress
                    address={address}
                    key={address.id}
                    onSelect={() => setSelectedAddressId(address.id)}
                    selected={selectedAddress?.id === address.id}
                  />
                ))}
              </View>
            )}

            <Text style={styles.sectionTitle}>Order summary</Text>
            <View style={styles.orderCard}>
              {lines.map((line, index) => (
                <View key={line.product.id}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <View style={styles.orderRow}>
                    <View style={styles.productThumb}>
                      <Image
                        accessibilityLabel={line.product.name}
                        contentFit="contain"
                        source={{ uri: line.product.imageUrl }}
                        style={styles.productImage}
                      />
                    </View>
                    <View style={styles.productCopy}>
                      <Text numberOfLines={2} style={styles.productName}>
                        {line.product.name}
                      </Text>
                      <Text style={styles.productMeta}>
                        {line.product.packSize}
                      </Text>
                    </View>
                    <View style={styles.productTrailing}>
                      <Text style={styles.productPrice}>
                        {formatRupees(
                          resolveShopProductPrice(line.product.price) * line.quantity,
                        )}
                      </Text>
                      <View
                        accessibilityLabel={`Quantity for ${line.product.name}`}
                        style={styles.quantityControl}
                      >
                        <PressableScale
                          accessibilityHint={
                            line.quantity === 1
                              ? 'Removes this medicine from your order'
                              : 'Reduces the quantity by one'
                          }
                          accessibilityLabel={
                            line.quantity === 1
                              ? `Remove ${line.product.name}`
                              : `Decrease ${line.product.name} quantity`
                          }
                          hitSlop={4}
                          onPress={() => cart.decrement(line.product.id)}
                          pressedScale={0.88}
                          style={styles.quantityButton}
                        >
                          <Ionicons
                            color={dashboardColors.primary}
                            name="remove"
                            size={16}
                          />
                        </PressableScale>
                        <Text
                          accessibilityLabel={`Quantity ${line.quantity}`}
                          style={styles.quantityValue}
                        >
                          {line.quantity}
                        </Text>
                        <PressableScale
                          accessibilityHint="Increases the quantity by one"
                          accessibilityLabel={`Increase ${line.product.name} quantity`}
                          hitSlop={4}
                          onPress={() => cart.increment(line.product.id)}
                          pressedScale={0.88}
                          style={styles.quantityButton}
                        >
                          <Ionicons
                            color={dashboardColors.primary}
                            name="add"
                            size={16}
                          />
                        </PressableScale>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.sectionTitle}>Payment details</Text>
            <View style={styles.paymentCard}>
              <PriceRow label="Item total" value={formatRupees(subtotal)} />
              <PriceRow label="Delivery" value="FREE" valueSuccess />
              <PriceRow label="Payment" value="Cash on delivery" />
              <View style={styles.paymentDivider} />
              <PriceRow bold label="Amount to pay" value={formatRupees(subtotal)} />
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: insets.bottom + dashboardSpacing.sm },
            ]}
          >
            <View>
              <Text style={styles.footerLabel}>Total</Text>
              <Text style={styles.footerTotal}>{formatRupees(subtotal)}</Text>
            </View>
            <PressableScale
              accessibilityLabel={
                selectedAddress ? 'Place cash on delivery order' : 'Add delivery address'
              }
              accessibilityState={{ disabled: isPlacingOrder }}
              disabled={isPlacingOrder}
              onPress={() => void placeOrder()}
              style={[
                styles.placeOrderButton,
                isPlacingOrder && styles.placeOrderButtonDisabled,
              ]}
            >
              {isPlacingOrder ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <Text style={styles.placeOrderText}>
                    {selectedAddress ? 'Place COD order' : 'Add address'}
                  </Text>
                  <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
                </>
              )}
            </PressableScale>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function OrderSuccess({
  address,
  onContinue,
  order,
}: {
  address: SavedAddress;
  onContinue: () => void;
  order: PlacedOrder;
}) {
  const deliveryAddress = [
    address.building,
    address.area,
    address.landmark,
    address.city,
    address.state,
    address.pinCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <ScrollView
      contentContainerStyle={styles.successContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.successIcon}>
        <Ionicons color="#FFFFFF" name="checkmark" size={38} />
      </View>
      <View style={styles.successHeading}>
        <Text style={styles.successTitle}>Order placed</Text>
        <Text style={styles.successMessage}>
          We received your cash-on-delivery order. Rider updates will appear
          in Orders.
        </Text>
      </View>
      <View style={styles.receiptCard}>
        <View style={styles.receiptTopRow}>
          <View>
            <Text style={styles.receiptLabel}>ORDER NUMBER</Text>
            <Text style={styles.receiptNumber}>ORD-{order.orderNumber}</Text>
          </View>
          <View style={styles.codBadge}>
            <Ionicons color={dashboardColors.primary} name="cash" size={16} />
            <Text style={styles.codBadgeText}>COD</Text>
          </View>
        </View>
        <View style={styles.paymentDivider} />
        <PriceRow bold label="Amount to pay" value={formatRupees(order.total)} />
        <View style={styles.paymentDivider} />
        <View style={styles.successAddressRow}>
          <Ionicons
            color={dashboardColors.primary}
            name="location"
            size={20}
          />
          <View style={styles.successAddressCopy}>
            <Text style={styles.successAddressName}>
              {address.recipientName} · +91 {address.phone}
            </Text>
            <Text style={styles.successAddress}>{deliveryAddress}</Text>
          </View>
        </View>
      </View>
      <PressableScale onPress={onContinue} style={styles.continueButton}>
        <Text style={styles.placeOrderText}>Continue shopping</Text>
        <Ionicons color="#FFFFFF" name="arrow-forward" size={18} />
      </PressableScale>
    </ScrollView>
  );
}

function ProgressStep({
  active = false,
  icon,
  label,
}: {
  active?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.progressStep}>
      <View style={[styles.progressIcon, active && styles.progressIconActive]}>
        <Ionicons
          color={active ? '#FFFFFF' : dashboardColors.textFaint}
          name={icon}
          size={15}
        />
      </View>
      <Text style={[styles.progressLabel, active && styles.progressLabelActive]}>
        {label}
      </Text>
    </View>
  );
}

function CheckoutAddress({
  address,
  onSelect,
  selected,
}: {
  address: SavedAddress;
  onSelect: () => void;
  selected: boolean;
}) {
  const label =
    address.label === 'Other'
      ? address.customLabel || 'Other'
      : address.label;
  const location = [
    address.building,
    address.area,
    address.city,
    address.state,
    address.pinCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <PressableScale
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={[styles.addressCard, selected && styles.addressCardSelected]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.addressCopy}>
        <View style={styles.addressLabelRow}>
          <Text style={styles.addressLabel}>{label}</Text>
          {address.isDefault ? (
            <View style={styles.defaultBadge}>
              <Text style={styles.defaultBadgeText}>DEFAULT</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.recipient}>
          {address.recipientName} · +91 {address.phone}
        </Text>
        <Text numberOfLines={2} style={styles.addressLine}>
          {location}
        </Text>
      </View>
    </PressableScale>
  );
}

function PriceRow({
  bold = false,
  label,
  value,
  valueSuccess = false,
}: {
  bold?: boolean;
  label: string;
  value: string;
  valueSuccess?: boolean;
}) {
  return (
    <View style={styles.priceRow}>
      <Text style={[styles.priceLabel, bold && styles.priceBold]}>{label}</Text>
      <Text
        style={[
          styles.priceValue,
          bold && styles.priceBold,
          valueSuccess && styles.priceSuccess,
        ]}
      >
        {value}
      </Text>
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
  headerSide: {
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
  headerSubtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  content: {
    gap: dashboardSpacing.gap,
    padding: dashboardSpacing.pagePadding,
  },
  progressRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: dashboardSpacing.sm,
  },
  progressStep: {
    alignItems: 'center',
    gap: 4,
  },
  progressIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.track,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  progressIconActive: {
    backgroundColor: dashboardColors.primary,
  },
  progressLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 10,
  },
  progressLabelActive: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  progressLine: {
    backgroundColor: dashboardColors.primary,
    height: 2,
    marginHorizontal: 6,
    marginTop: 14,
    width: 52,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
  },
  sectionAction: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    minHeight: 92,
    justifyContent: 'center',
  },
  addAddressCard: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.primary,
    borderRadius: dashboardRadii.card,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.md,
  },
  addAddressIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  addAddressCopy: {
    flex: 1,
    gap: 2,
  },
  addAddressTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
  },
  addAddressText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  addressList: {
    gap: dashboardSpacing.sm,
  },
  addressCard: {
    alignItems: 'flex-start',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.md,
  },
  addressCardSelected: {
    borderColor: dashboardColors.primary,
    borderWidth: 2,
  },
  radio: {
    alignItems: 'center',
    borderColor: dashboardColors.textFaint,
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    marginTop: 2,
    width: 20,
  },
  radioSelected: {
    borderColor: dashboardColors.primary,
  },
  radioDot: {
    backgroundColor: dashboardColors.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  addressCopy: {
    flex: 1,
    gap: 3,
  },
  addressLabelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
  },
  addressLabel: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
  },
  defaultBadge: {
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  recipient: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
  },
  addressLine: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    lineHeight: 18,
  },
  orderCard: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    padding: dashboardSpacing.md,
  },
  orderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
  },
  divider: {
    backgroundColor: dashboardColors.track,
    height: StyleSheet.hairlineWidth,
    marginVertical: dashboardSpacing.md,
  },
  productThumb: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    height: 54,
    overflow: 'hidden',
    width: 54,
  },
  productImage: {
    height: '100%',
    width: '100%',
  },
  productCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  productName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  productMeta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  productPrice: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
  productTrailing: {
    alignItems: 'flex-end',
    gap: dashboardSpacing.sm,
  },
  quantityControl: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    minHeight: 44,
    paddingHorizontal: 3,
  },
  quantityButton: {
    alignItems: 'center',
    borderRadius: 16,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  quantityValue: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
    fontVariant: ['tabular-nums'],
    minWidth: 24,
    textAlign: 'center',
  },
  paymentCard: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    gap: dashboardSpacing.sm,
    padding: dashboardSpacing.md,
  },
  priceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
  },
  priceValue: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontVariant: ['tabular-nums'],
  },
  priceBold: {
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
  },
  priceSuccess: {
    color: dashboardColors.success,
    fontFamily: 'Inter_600SemiBold',
  },
  paymentDivider: {
    backgroundColor: dashboardColors.track,
    height: StyleSheet.hairlineWidth,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderTopColor: dashboardColors.track,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  footerLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  footerTotal: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    fontVariant: ['tabular-nums'],
  },
  placeOrderButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    minHeight: 52,
    paddingHorizontal: dashboardSpacing.xl,
  },
  placeOrderButtonDisabled: {
    opacity: 0.65,
  },
  placeOrderText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    gap: dashboardSpacing.md,
    justifyContent: 'center',
  },
  emptyTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  shopButton: {
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    paddingHorizontal: dashboardSpacing.xl,
    paddingVertical: dashboardSpacing.md,
  },
  shopButtonText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
  successContent: {
    alignItems: 'center',
    flexGrow: 1,
    gap: dashboardSpacing.gap,
    justifyContent: 'center',
    padding: dashboardSpacing.pagePadding,
  },
  successIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.success,
    borderRadius: 34,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  successHeading: {
    alignItems: 'center',
    gap: dashboardSpacing.sm,
  },
  successTitle: {
    ...dashboardTypography.largeTitle,
    color: dashboardColors.text,
  },
  successMessage: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    maxWidth: 320,
    textAlign: 'center',
  },
  receiptCard: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.xl,
    width: '100%',
  },
  receiptTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  receiptLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontFamily: 'Inter_600SemiBold',
  },
  receiptNumber: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    fontVariant: ['tabular-nums'],
  },
  codBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: dashboardSpacing.sm,
    paddingVertical: 6,
  },
  codBadgeText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
  },
  successAddressRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
  },
  successAddressCopy: {
    flex: 1,
    gap: 3,
  },
  successAddressName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
  },
  successAddress: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    lineHeight: 18,
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
  },
});
