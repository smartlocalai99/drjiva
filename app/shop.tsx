import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  BottomNav,
  type NavTabKey,
} from '../src/components/dashboard/BottomNav';
import { PressableScale } from '../src/components/PressableScale';
import { ReminderMedicineList } from '../src/components/shop/reminder-medicine-list';
import { ShopProductRow } from '../src/components/shop/shop-product-row';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import {
  fetchActiveMedicineReminders,
} from '../src/data/medicines';
import {
  fetchShopProducts,
  type ShopProduct,
} from '../src/data/shopProducts';
import {
  buildReminderMedicineReorders,
  buildShopSections,
  getUniqueReminderMedicineNames,
  type ReminderMedicineReorder,
  type ShopProductSection,
} from '../src/data/shopSections';
import {
  loadAddresses,
} from '../src/lib/addressStorage';
import {
  getDefaultAddress,
  type SavedAddress,
} from '../src/lib/addresses';
import { useCart } from '../src/lib/cart';
import { formatRupees, resolveShopProductPrice } from '../src/lib/currency';
import { getTabRoute } from '../src/lib/dashboardNav';
import { useLanguage } from '../src/lib/i18n';
import { getPatientByPhone } from '../src/lib/patients';
import { getSessionPhone } from '../src/lib/session';

const PLACEHOLDER_QUERIES = [
  'Dolo-650',
  'Paracetamol',
  'Cold relief',
  'Pain management',
] as const;
const PLACEHOLDER_ROTATION_MS = 2400;
const DELIVERY_AGENT_IMAGE = require('../assets/shop/delivery-agent.png');

const SECTION_ICONS = {
  body_pains: 'body-outline',
  cold: 'snow-outline',
  fever: 'thermometer-outline',
  headache: 'happy-outline',
  search: 'search-outline',
  stomach_pain: 'nutrition-outline',
} as const;

const SECTION_TINTS = {
  body_pains: {
    backgroundColor: dashboardColors.primaryTint,
    color: dashboardColors.primary,
  },
  cold: {
    backgroundColor: '#E9F7F8',
    color: '#0F8A94',
  },
  fever: {
    backgroundColor: dashboardColors.errorTint,
    color: dashboardColors.error,
  },
  headache: {
    backgroundColor: dashboardColors.warningTint,
    color: '#C87906',
  },
  search: {
    backgroundColor: dashboardColors.primaryTint,
    color: dashboardColors.primary,
  },
  stomach_pain: {
    backgroundColor: '#F1EAFB',
    color: '#7C4DCC',
  },
} as const;

export default function ShopScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone)
    ? params.phone[0]
    : params.phone;
  const routePhone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const insets = useSafeAreaInsets();
  const cart = useCart();

  const [activeTab, setActiveTab] = useState<NavTabKey>('shop');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);
  const [catalogueError, setCatalogueError] = useState(false);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(true);
  const [phone, setPhone] = useState(routePhone);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [query, setQuery] = useState('');
  const [reminderNames, setReminderNames] = useState<string[]>([]);

  useEffect(() => {
    if (routePhone) {
      setPhone(routePhone);
      return;
    }

    let cancelled = false;
    void getSessionPhone()
      .then((sessionPhone) => {
        if (!cancelled) {
          setPhone(
            (sessionPhone ?? '').replace(/\D/g, '').slice(-10),
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [routePhone]);

  useEffect(() => {
    if (query) {
      return;
    }
    const rotationTimer = setInterval(() => {
      setPlaceholderIndex(
        (current) => (current + 1) % PLACEHOLDER_QUERIES.length,
      );
    }, PLACEHOLDER_ROTATION_MS);
    return () => clearInterval(rotationTimer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoadingCatalogue(true);
    setCatalogueError(false);

    void fetchShopProducts('', controller.signal)
      .then((nextProducts) => {
        setProducts(nextProducts);
        const firstImages = buildShopSections(nextProducts)
          .flatMap((section) => section.data)
          .slice(0, 10)
          .map((product) => product.imageUrl);
        if (firstImages.length > 0) {
          void Image.prefetch(firstImages, 'memory-disk').catch(
            () => undefined,
          );
        }
      })
      .catch((error: unknown) => {
        if (
          !(error instanceof Error && error.name === 'AbortError') &&
          !controller.signal.aborted
        ) {
          setCatalogueError(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingCatalogue(false);
        }
      });

    return () => controller.abort();
  }, [catalogueAttempt]);

  useFocusEffect(
    useCallback(() => {
      if (!phone) {
        return undefined;
      }

      let cancelled = false;
      void Promise.all([
        loadAddresses(phone).catch(() => []),
        getPatientByPhone(phone)
          .then((patient) =>
            patient
              ? fetchActiveMedicineReminders(patient.patientId)
              : [],
          )
          .catch(() => []),
      ]).then(([nextAddresses, reminders]) => {
        if (cancelled) {
          return;
        }
        setAddresses(nextAddresses);
        setReminderNames(
          getUniqueReminderMedicineNames(
            reminders.map((reminder) => reminder.medicineName),
          ),
        );
      });

      return () => {
        cancelled = true;
      };
    }, [phone]),
  );

  const sections = useMemo(
    () => buildShopSections(products, query),
    [products, query],
  );
  const reminderMedicines = useMemo(
    () => buildReminderMedicineReorders(reminderNames, products),
    [products, reminderNames],
  );
  const isSearching = query.trim().length > 0;
  const deliveryAddress = useMemo(
    () => getDefaultAddress(addresses),
    [addresses],
  );
  const cartTotal = useMemo(
    () =>
      Object.entries(cart.quantities).reduce(
        (sum, [id, quantity]) =>
          sum + resolveShopProductPrice(cart.products[id]?.price ?? null) * quantity,
        0,
      ),
    [cart.products, cart.quantities],
  );

  const navBottomOffset =
    insets.bottom + dashboardLayout.navBottomGap;
  const bottomControlHeight =
    cart.totalItems > 0 ? 68 : dashboardLayout.bottomNavHeight;
  const listBottomPadding =
    navBottomOffset + bottomControlHeight + dashboardSpacing.xl;

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

  const openAddressSheet = () => {
    router.push({ params: { phone }, pathname: '/shop-address' });
  };

  const openProduct = useCallback(
    (product: ShopProduct) => {
      router.push({
        params: { id: product.id, phone },
        pathname: '/medicine/[id]',
      });
    },
    [phone, router],
  );

  const renderProduct = useCallback(
    ({ item }: { item: ShopProduct }) => (
      <ProductRow onOpen={() => openProduct(item)} product={item} />
    ),
    [openProduct],
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel={
            deliveryAddress
              ? 'Change delivery address'
              : 'Add delivery address'
          }
          accessibilityRole="button"
          onPress={openAddressSheet}
          style={styles.addressTrigger}
        >
          <View style={styles.locationIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="location"
              size={18}
            />
          </View>
          <View style={styles.addressTriggerCopy}>
            <Text style={styles.deliverTo}>Deliver to</Text>
            <View style={styles.addressValueRow}>
              <Text numberOfLines={1} style={styles.addressValue}>
                {formatAddressTrigger(deliveryAddress)}
              </Text>
              <Ionicons
                color={dashboardColors.textMuted}
                name="chevron-down"
                size={15}
              />
            </View>
          </View>
        </Pressable>

        <PressableScale
          accessibilityLabel={`${t('cart')}, ${cart.totalItems} items`}
          onPress={() =>
            router.push({ params: { phone }, pathname: '/cart' })
          }
          pressedScale={0.94}
          style={styles.bagButton}
        >
          <Ionicons
            color={dashboardColors.text}
            name="bag-handle-outline"
            size={23}
          />
          {cart.totalItems > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>
                {cart.totalItems > 99 ? '99+' : cart.totalItems}
              </Text>
            </View>
          ) : null}
        </PressableScale>
      </View>

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Ionicons
            color={dashboardColors.textFaint}
            name="search-outline"
            size={19}
          />
          <View style={styles.searchInputWrap}>
            <TextInput
              accessibilityLabel={t('searchMedicine')}
              autoCorrect={false}
              clearButtonMode="while-editing"
              onChangeText={setQuery}
              returnKeyType="search"
              style={styles.searchInput}
              value={query}
            />
            {!query ? (
              <Animated.Text
                entering={FadeInDown.duration(220)}
                exiting={FadeOutUp.duration(160)}
                key={placeholderIndex}
                pointerEvents="none"
                style={styles.searchPlaceholder}
              >
                Search “{PLACEHOLDER_QUERIES[placeholderIndex]}”
              </Animated.Text>
            ) : null}
          </View>
        </View>
      </View>

      {isLoadingCatalogue ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={dashboardColors.primary} />
          <Text style={styles.stateText}>Loading the medicine shop…</Text>
        </View>
      ) : catalogueError ? (
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="cloud-offline-outline"
              size={28}
            />
          </View>
          <Text style={styles.stateTitle}>Shop is unavailable</Text>
          <Text style={styles.stateText}>
            Check your connection and try loading again.
          </Text>
          <PressableScale
            onPress={() => setCatalogueAttempt((current) => current + 1)}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </PressableScale>
        </View>
      ) : (
        <SectionList
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPadding },
          ]}
          initialNumToRender={8}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<EmptySearch query={query} />}
          ListHeaderComponent={
            isSearching ? null : (
              <ShopListHeader
                onOpenProduct={openProduct}
                reminderMedicines={reminderMedicines}
              />
            )
          }
          maxToRenderPerBatch={8}
          renderItem={renderProduct}
          renderSectionHeader={({ section }) => (
            <ShopSectionHeader section={section} />
          )}
          sections={sections}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled={false}
          windowSize={7}
        />
      )}

      {cart.totalItems > 0 ? (
        <CheckoutBar
          bottomOffset={navBottomOffset}
          itemCount={cart.totalItems}
          onPress={() =>
            router.push({ params: { phone }, pathname: '/checkout' })
          }
          total={cartTotal}
        />
      ) : (
        <BottomNav
          activeTab={activeTab}
          bottomOffset={navBottomOffset}
          onSelectTab={handleSelectTab}
        />
      )}
    </SafeAreaView>
  );
}

function ShopListHeader({
  onOpenProduct,
  reminderMedicines,
}: {
  onOpenProduct: (product: ShopProduct) => void;
  reminderMedicines: ReminderMedicineReorder[];
}) {
  return (
    <View>
      <View style={styles.heroRow}>
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>DRJIVA HEALTH SHOP</Text>
          <Text style={styles.heroTitle}>Everyday care, made simple.</Text>
        </View>
        <Image
          accessibilityLabel="Masked medicine delivery agent"
          contentFit="contain"
          source={DELIVERY_AGENT_IMAGE}
          style={styles.heroAgent}
        />
      </View>

      <ReminderMedicineList
        medicines={reminderMedicines}
        onOpen={onOpenProduct}
      />

      <View style={styles.guidance}>
        <Ionicons
          color={dashboardColors.textMuted}
          name="shield-checkmark-outline"
          size={15}
        />
        <Text style={styles.guidanceText}>
          Use medicines only as directed by your clinician.
        </Text>
      </View>
    </View>
  );
}

function ShopSectionHeader({
  section,
}: {
  section: ShopProductSection;
}) {
  const tint = SECTION_TINTS[section.code];
  return (
    <View style={styles.sectionHeader}>
      <View
        style={[
          styles.sectionIcon,
          { backgroundColor: tint.backgroundColor },
        ]}
      >
        <Ionicons
          color={tint.color}
          name={SECTION_ICONS[section.code]}
          size={17}
        />
      </View>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      <Text style={styles.sectionCount}>{section.data.length}</Text>
    </View>
  );
}

function ProductRow({
  onOpen,
  product,
}: {
  onOpen: () => void;
  product: ShopProduct;
}) {
  const { add, decrement, getQuantity, increment } = useCart();
  const quantity = getQuantity(product.id);

  return (
    <ShopProductRow
      onAdd={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined,
        );
        add(product);
      }}
      onDecrement={() => decrement(product.id)}
      onIncrement={() => increment(product.id)}
      onOpen={onOpen}
      product={product}
      quantity={quantity}
    />
  );
}

function CheckoutBar({
  bottomOffset,
  itemCount,
  onPress,
  total,
}: {
  bottomOffset: number;
  itemCount: number;
  onPress: () => void;
  total: number;
}) {
  return (
    <PressableScale
      accessibilityLabel={`Checkout ${itemCount} items, ${formatRupees(total)}`}
      onPress={onPress}
      pressedScale={0.985}
      style={[styles.checkoutBar, { bottom: bottomOffset }]}
    >
      <View style={styles.checkoutBag}>
        <Ionicons color="#FFFFFF" name="bag-check-outline" size={21} />
      </View>
      <View style={styles.checkoutCopy}>
        <Text style={styles.checkoutTitle}>Checkout</Text>
        <Text style={styles.checkoutSubtitle}>
          {itemCount} {itemCount === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <Text style={styles.checkoutTotal}>{formatRupees(total)}</Text>
      <Ionicons color="#FFFFFF" name="arrow-forward" size={19} />
    </PressableScale>
  );
}

function EmptySearch({ query }: { query: string }) {
  return (
    <View style={styles.emptySearch}>
      <View style={styles.stateIcon}>
        <Ionicons
          color={dashboardColors.primary}
          name="search-outline"
          size={28}
        />
      </View>
      <Text style={styles.stateTitle}>
        {query ? 'No matching medicines' : 'No shop medicines yet'}
      </Text>
      <Text style={styles.stateText}>
        {query
          ? 'Try a different medicine name or active ingredient.'
          : 'Asian Hospitals medicines with a real photo will appear here.'}
      </Text>
    </View>
  );
}

function formatAddressTrigger(address: SavedAddress | undefined): string {
  if (!address) {
    return 'Add delivery address';
  }
  const label =
    address.label === 'Other'
      ? address.customLabel || 'Other'
      : address.label;
  const detail = [address.building, address.area]
    .filter(Boolean)
    .join(', ');
  return detail ? `${label} · ${detail}` : label;
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#F5F7FB',
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  addressTrigger: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    minHeight: 48,
  },
  locationIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  addressTriggerCopy: {
    flex: 1,
  },
  deliverTo: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 10,
  },
  addressValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  addressValue: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    flexShrink: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
  bagButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: '#E4E8F0',
    borderRadius: 20,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  cartBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.error,
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 2,
    height: 19,
    justifyContent: 'center',
    minWidth: 19,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -5,
    top: -5,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  searchWrap: {
    paddingBottom: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: '#E4E8F0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    height: 50,
    paddingHorizontal: dashboardSpacing.md,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
  },
  searchInputWrap: {
    flex: 1,
    height: 22,
    justifyContent: 'center',
  },
  searchInput: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 14,
    height: '100%',
    padding: 0,
    position: 'absolute',
    width: '100%',
  },
  searchPlaceholder: {
    ...dashboardTypography.body,
    color: dashboardColors.textFaint,
    fontSize: 14,
    left: 0,
    position: 'absolute',
  },
  listContent: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  heroRow: {
    alignItems: 'center',
    backgroundColor: '#102A56',
    borderRadius: 22,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginTop: dashboardSpacing.sm,
    minHeight: 176,
    overflow: 'hidden',
    paddingHorizontal: dashboardSpacing.gap,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: '#9DBCF7',
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    lineHeight: 26,
    marginTop: 5,
    maxWidth: 210,
  },
  heroAgent: {
    alignSelf: 'flex-end',
    flexShrink: 0,
    height: 168,
    width: 112,
  },
  guidance: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    marginTop: dashboardSpacing.md,
    paddingHorizontal: 2,
  },
  guidanceText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    backgroundColor: '#F5F7FB',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingBottom: dashboardSpacing.sm,
    paddingTop: dashboardSpacing.xl,
  },
  sectionIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  sectionTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    flex: 1,
    fontSize: 18,
  },
  sectionCount: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
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
  checkoutTotal: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: dashboardSpacing.xl,
  },
  stateIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 28,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  stateTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.md,
    textAlign: 'center',
  },
  stateText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    marginTop: dashboardSpacing.gap,
    paddingHorizontal: dashboardSpacing.xl,
    paddingVertical: 11,
  },
  retryText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
    fontSize: 13,
  },
  emptySearch: {
    alignItems: 'center',
    paddingHorizontal: dashboardSpacing.xl,
    paddingTop: 56,
  },
});
