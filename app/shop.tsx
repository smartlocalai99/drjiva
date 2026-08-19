import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeInDown,
  FadeOutUp,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import {
  BottomNav,
  type NavTabKey,
} from '../src/components/dashboard/BottomNav';
import { DHRUVA_LOGO } from '../src/components/HospitalLogo';
import { PressableScale } from '../src/components/PressableScale';
import { ReminderMedicineList } from '../src/components/shop/reminder-medicine-list';
import { ShopProductCard } from '../src/components/shop/shop-product-card';
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
  getShopHospitalCode,
  SHOP_HOSPITALS,
  type ShopHospitalFilter,
} from '../src/data/shopProductModel';
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
import {
  countActiveOrders,
  listPatientOrders,
} from '../src/lib/patientOrders';
import { getPatientByPhone } from '../src/lib/patients';
import { getSessionPhone } from '../src/lib/session';

const PLACEHOLDER_QUERIES = [
  'Dolo',
  'Paracetamol',
  'Cold relief',
  'Pain management',
] as const;
const PLACEHOLDER_ROTATION_MS = 2400;
const BANNER_AUTO_SCROLL_MS = 3600;
const ADDRESS_HEADER_HEIGHT = 64;
const AnimatedSectionList = Animated.createAnimatedComponent(
  SectionList<ShopProduct, ShopProductSection>,
);
const SHOP_BANNERS = [
  {
    accessibilityLabel: 'Shop headache medicines',
    image: require('../assets/headachebanner.webp'),
    sectionCode: 'headache',
  },
  {
    accessibilityLabel: 'Shop fever medicines',
    image: require('../assets/feverbanner.webp'),
    sectionCode: 'fever',
  },
  {
    accessibilityLabel: 'Shop multivitamins',
    image: require('../assets/multivitaminsbanner.webp'),
    sectionCode: 'vitamins',
  },
] as const;

const SECTION_ICONS = {
  allergy_cough: 'medkit-outline',
  body_pains: 'body-outline',
  cold: 'snow-outline',
  diabetes_care: 'water-outline',
  dhruva: 'business-outline',
  fever: 'thermometer-outline',
  headache: 'happy-outline',
  heart_bp: 'heart-outline',
  search: 'search-outline',
  skin_care: 'bandage-outline',
  stomach_pain: 'nutrition-outline',
  vitamins: 'leaf-outline',
} as const;

const SECTION_TINTS = {
  allergy_cough: {
    backgroundColor: '#F1F8E9',
    color: '#558B2F',
  },
  body_pains: {
    backgroundColor: dashboardColors.primaryTint,
    color: dashboardColors.primary,
  },
  cold: {
    backgroundColor: '#E9F7F8',
    color: '#0F8A94',
  },
  diabetes_care: {
    backgroundColor: dashboardColors.primaryTint,
    color: dashboardColors.primary,
  },
  dhruva: {
    backgroundColor: '#EAF3FF',
    color: '#3569A8',
  },
  fever: {
    backgroundColor: dashboardColors.errorTint,
    color: dashboardColors.error,
  },
  headache: {
    backgroundColor: dashboardColors.warningTint,
    color: '#C87906',
  },
  heart_bp: {
    backgroundColor: '#FDEBEE',
    color: '#C23A54',
  },
  search: {
    backgroundColor: dashboardColors.primaryTint,
    color: dashboardColors.primary,
  },
  skin_care: {
    backgroundColor: '#FBEFF6',
    color: '#B0509A',
  },
  stomach_pain: {
    backgroundColor: '#F1EAFB',
    color: '#7C4DCC',
  },
  vitamins: {
    backgroundColor: '#FFF8E1',
    color: '#B8860B',
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
  const sectionListRef = useRef<
    SectionList<ShopProduct, ShopProductSection>
  >(null);
  const pendingSectionCode = useRef<
    (typeof SHOP_BANNERS)[number]['sectionCode'] | null
  >(null);

  const shopScrollOffset = useSharedValue(0);
  const shopScrollHandler = useAnimatedScrollHandler((event) => {
    'worklet';
    shopScrollOffset.value = event.contentOffset.y;
  });
  const addressHeaderStyle = useAnimatedStyle(() => {
    const collapse = interpolate(
      shopScrollOffset.value,
      [0, ADDRESS_HEADER_HEIGHT],
      [0, ADDRESS_HEADER_HEIGHT],
      'clamp',
    );
    return {
      height: ADDRESS_HEADER_HEIGHT - collapse,
      opacity: interpolate(
        shopScrollOffset.value,
        [0, ADDRESS_HEADER_HEIGHT * 0.7],
        [1, 0],
        'clamp',
      ),
      transform: [{ translateY: -collapse * 0.45 }],
    };
  });
  const searchHeaderStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      shopScrollOffset.value,
      [0, ADDRESS_HEADER_HEIGHT],
      [dashboardColors.primary, '#FFFFFF'],
    ),
  }));

  const [activeTab, setActiveTab] = useState<NavTabKey>('shop');
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);
  const [catalogueError, setCatalogueError] = useState(false);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(true);
  const [phone, setPhone] = useState(routePhone);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [query, setQuery] = useState('');
  const [hospitalFilter, setHospitalFilter] =
    useState<ShopHospitalFilter>('all');
  const [reminderNames, setReminderNames] = useState<string[]>([]);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);

  useAnimatedReaction(
    () => shopScrollOffset.value >= ADDRESS_HEADER_HEIGHT - 1,
    (collapsed, previous) => {
      if (collapsed !== previous) {
        runOnJS(setIsHeaderCollapsed)(collapsed);
      }
    },
  );

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
          .then(async (patient) => {
            if (!patient) {
              return { activeOrders: 0, reminders: [] };
            }
            const [reminders, orders] = await Promise.all([
              fetchActiveMedicineReminders(patient.patientId).catch(() => []),
              listPatientOrders(patient.patientId).catch(() => []),
            ]);
            return {
              activeOrders: countActiveOrders(orders),
              reminders,
            };
          })
          .catch(() => ({ activeOrders: 0, reminders: [] })),
      ]).then(([nextAddresses, patientData]) => {
        if (cancelled) {
          return;
        }
        setAddresses(nextAddresses);
        setActiveOrderCount(patientData.activeOrders);
        setReminderNames(
          getUniqueReminderMedicineNames(
            patientData.reminders.map((reminder) => reminder.medicineName),
          ),
        );
      });

      return () => {
        cancelled = true;
      };
    }, [phone]),
  );

  const sections = useMemo(
    () => buildShopSections(products, query, hospitalFilter),
    [hospitalFilter, products, query],
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

  const scrollToSection = useCallback(
    (sectionCode: (typeof SHOP_BANNERS)[number]['sectionCode']) => {
      const sectionIndex = sections.findIndex(
        (section) => section.code === sectionCode,
      );
      if (sectionIndex < 0) {
        return;
      }

      pendingSectionCode.current = sectionCode;
      void Haptics.selectionAsync().catch(() => undefined);
      sectionListRef.current?.scrollToLocation({
        animated: true,
        itemIndex: 0,
        sectionIndex,
        viewOffset: dashboardSpacing.xs,
        viewPosition: 0,
      });
    },
    [sections],
  );

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        isHeaderCollapsed && styles.safeAreaCollapsed,
      ]}
    >
      <StatusBar style={isHeaderCollapsed ? 'dark' : 'light'} />
      <Animated.View
        pointerEvents="box-none"
        style={[styles.addressHeaderClip, addressHeaderStyle]}
      >
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
              <Ionicons color="#FFFFFF" name="location" size={18} />
            </View>
            <View style={styles.addressTriggerCopy}>
              <Text style={styles.deliverTo}>Deliver to</Text>
              <View style={styles.addressValueRow}>
                <Text numberOfLines={1} style={styles.addressValue}>
                  {formatAddressTrigger(deliveryAddress)}
                </Text>
                <Ionicons color="#FFFFFF" name="chevron-down" size={15} />
              </View>
            </View>
          </Pressable>

          <PressableScale
            accessibilityLabel={`Orders, ${activeOrderCount} active`}
            onPress={() =>
              router.push({ params: { phone }, pathname: '/orders' })
            }
            pressedScale={0.94}
            style={styles.bagButton}
          >
            <Ionicons
              color={dashboardColors.text}
              name="receipt-outline"
              size={23}
            />
            {activeOrderCount > 0 ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>
                  {activeOrderCount > 99 ? '99+' : activeOrderCount}
                </Text>
              </View>
            ) : null}
          </PressableScale>
        </View>
      </Animated.View>

      <Animated.View style={[styles.searchWrap, searchHeaderStyle]}>
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
              <View pointerEvents="none" style={styles.searchPlaceholderRow}>
                <Text style={styles.searchPlaceholderPrefix}>Search for </Text>
                <Animated.Text
                  entering={FadeInDown.duration(220)}
                  exiting={FadeOutUp.duration(160)}
                  key={placeholderIndex}
                  style={styles.searchPlaceholderQuery}
                >
                  {PLACEHOLDER_QUERIES[placeholderIndex]}
                </Animated.Text>
              </View>
            ) : null}
          </View>
        </View>
        {isSearching ? (
          <HospitalFilter
            onSelect={setHospitalFilter}
            selected={hospitalFilter}
          />
        ) : null}
      </Animated.View>

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
        <AnimatedSectionList
          ref={sectionListRef}
          onScroll={shopScrollHandler}
          onScrollToIndexFailed={(info) => {
            sectionListRef.current?.getScrollResponder()?.scrollTo({
              animated: true,
              y: info.averageItemLength * info.index,
            });
            const sectionCode = pendingSectionCode.current;
            if (sectionCode) {
              setTimeout(() => scrollToSection(sectionCode), 280);
            }
          }}
          scrollEventThrottle={16}
          style={styles.listSurface}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPadding },
          ]}
          initialNumToRender={8}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <EmptySearch hospitalFilter={hospitalFilter} query={query} />
          }
          ListHeaderComponent={
            isSearching ? null : (
              <ShopListHeader
                onOpenProduct={openProduct}
                onSelectSection={scrollToSection}
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
  onSelectSection,
  reminderMedicines,
}: {
  onOpenProduct: (product: ShopProduct) => void;
  onSelectSection: (
    sectionCode: (typeof SHOP_BANNERS)[number]['sectionCode'],
  ) => void;
  reminderMedicines: ReminderMedicineReorder[];
}) {
  return (
    <View>
      <ShopBannerCarousel onSelectSection={onSelectSection} />

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

function ShopBannerCarousel({
  onSelectSection,
}: {
  onSelectSection: (
    sectionCode: (typeof SHOP_BANNERS)[number]['sectionCode'],
  ) => void;
}) {
  const { width } = useWindowDimensions();
  const carouselRef = useRef<
    FlatList<(typeof SHOP_BANNERS)[number]>
  >(null);
  const activeIndexRef = useRef(0);
  const isDraggingRef = useRef(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const availableWidth = Math.min(
    width - dashboardSpacing.pagePadding * 2,
    720,
  );
  const bannerWidth = Math.max(260, availableWidth - 28);
  const snapInterval = bannerWidth + dashboardSpacing.md;

  const updateActiveIndex = useCallback((index: number) => {
    const boundedIndex = Math.max(
      0,
      Math.min(SHOP_BANNERS.length - 1, index),
    );
    activeIndexRef.current = boundedIndex;
    setActiveIndex(boundedIndex);
  }, []);

  useEffect(() => {
    carouselRef.current?.scrollToOffset({
      animated: false,
      offset: activeIndexRef.current * snapInterval,
    });
  }, [snapInterval]);

  useFocusEffect(
    useCallback(() => {
      const autoScrollTimer = setInterval(() => {
        if (isDraggingRef.current) {
          return;
        }
        const nextIndex =
          (activeIndexRef.current + 1) % SHOP_BANNERS.length;
        updateActiveIndex(nextIndex);
        carouselRef.current?.scrollToOffset({
          animated: true,
          offset: nextIndex * snapInterval,
        });
      }, BANNER_AUTO_SCROLL_MS);

      return () => clearInterval(autoScrollTimer);
    }, [snapInterval, updateActiveIndex]),
  );

  return (
    <View style={styles.bannerCarousel}>
      <FlatList
        ref={carouselRef}
        accessibilityLabel="Shop category offers"
        contentContainerStyle={styles.bannerTrack}
        data={SHOP_BANNERS}
        decelerationRate="fast"
        disableIntervalMomentum
        horizontal
        keyExtractor={(item) => item.sectionCode}
        onMomentumScrollEnd={(event) => {
          const nextIndex = Math.round(
            event.nativeEvent.contentOffset.x / snapInterval,
          );
          isDraggingRef.current = false;
          updateActiveIndex(nextIndex);
        }}
        onScrollBeginDrag={() => {
          isDraggingRef.current = true;
        }}
        onScrollEndDrag={() => {
          isDraggingRef.current = false;
        }}
        renderItem={({ item }) => (
          <PressableScale
            accessibilityLabel={item.accessibilityLabel}
            onPress={() => onSelectSection(item.sectionCode)}
            pressedScale={0.985}
            style={[styles.bannerCard, { width: bannerWidth }]}
          >
            <Image
              contentFit="cover"
              source={item.image}
              style={styles.bannerImage}
              transition={150}
            />
          </PressableScale>
        )}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={snapInterval}
      />
      <View
        accessibilityLabel={`Banner ${activeIndex + 1} of 3`}
        style={styles.bannerDots}
      >
        {SHOP_BANNERS.map((banner, index) => (
          <View
            key={banner.sectionCode}
            style={[
              styles.bannerDot,
              index === activeIndex && styles.bannerDotActive,
            ]}
          />
        ))}
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
  const isDhruvaSection = section.code === 'dhruva';
  return (
    <View style={styles.sectionHeader}>
      {isDhruvaSection ? (
        <View style={styles.dhruvaSectionLogoWrap}>
          <Image
            accessibilityLabel="Dhruva Hospitals"
            cachePolicy="memory"
            contentFit="contain"
            source={DHRUVA_LOGO}
            style={styles.dhruvaSectionLogo}
          />
        </View>
      ) : (
        <>
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
        </>
      )}
      {isDhruvaSection ? <View style={styles.sectionTitleSpacer} /> : null}
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
    <ShopProductCard
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

function HospitalFilter({
  onSelect,
  selected,
}: {
  onSelect: (filter: ShopHospitalFilter) => void;
  selected: ShopHospitalFilter;
}) {
  const options: Array<{ key: ShopHospitalFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'asian', label: 'Asian' },
    { key: 'dhruva', label: 'Dhruva' },
    { key: 'shankar', label: 'Shankar' },
  ];
  return (
    <View accessibilityRole="tablist" style={styles.hospitalFilters}>
      {options.map((option) => {
        const active = selected === option.key;
        return (
          <Pressable
            accessibilityLabel={`Show ${option.label} hospital medicines`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            key={option.key}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              onSelect(option.key);
            }}
            style={[
              styles.hospitalFilter,
              active && styles.hospitalFilterActive,
            ]}
          >
            <Text
              style={[
                styles.hospitalFilterText,
                active && styles.hospitalFilterTextActive,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function EmptySearch({
  hospitalFilter,
  query,
}: {
  hospitalFilter: ShopHospitalFilter;
  query: string;
}) {
  const supplier =
    hospitalFilter === 'all'
      ? 'Asian, Dhruva, and Shankar Hospitals'
      : hospitalFilter === 'asian'
        ? 'Asian Hospitals'
        : SHOP_HOSPITALS[hospitalFilter];
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
          ? `Try another name or ingredient in ${supplier}.`
          : `${supplier} medicines with a real photo will appear here.`}
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
    backgroundColor: dashboardColors.primary,
    flex: 1,
  },
  safeAreaCollapsed: {
    backgroundColor: '#FFFFFF',
  },
  addressHeaderClip: {
    backgroundColor: dashboardColors.primary,
    height: ADDRESS_HEADER_HEIGHT,
    overflow: 'hidden',
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.pagePadding,
    height: ADDRESS_HEADER_HEIGHT,
    paddingBottom: dashboardSpacing.xs,
    paddingTop: dashboardSpacing.xs,
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
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
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
    color: '#D9E8F3',
    fontSize: 10,
  },
  addressValueRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  addressValue: {
    ...dashboardTypography.body,
    color: '#FFFFFF',
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
    paddingTop: dashboardSpacing.xs,
  },
  hospitalFilters: {
    backgroundColor: dashboardColors.card,
    borderColor: '#E4E8F0',
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 3,
    marginTop: dashboardSpacing.sm,
    padding: 3,
  },
  hospitalFilter: {
    alignItems: 'center',
    borderRadius: dashboardRadii.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: dashboardSpacing.sm,
  },
  hospitalFilterActive: {
    backgroundColor: dashboardColors.primary,
    boxShadow: '0 2px 8px rgba(15, 23, 42, 0.14)',
  },
  hospitalFilterText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  hospitalFilterTextActive: {
    color: '#FFFFFF',
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
  searchPlaceholderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    left: 0,
    position: 'absolute',
  },
  searchPlaceholderPrefix: {
    ...dashboardTypography.body,
    color: dashboardColors.textFaint,
    fontSize: 14,
  },
  searchPlaceholderQuery: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  listSurface: {
    backgroundColor: '#F5F7FB',
  },
  listContent: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  dhruvaDiscovery: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E7F7',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    marginTop: dashboardSpacing.md,
    minHeight: 84,
    padding: dashboardSpacing.md,
    shadowColor: '#174E7D',
    shadowOffset: { height: 5, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  dhruvaDiscoveryLogoWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#E4EDF5',
    borderRadius: 14,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 5,
    width: 88,
  },
  dhruvaDiscoveryLogo: {
    height: 44,
    width: 78,
  },
  dhruvaDiscoveryCopy: {
    flex: 1,
  },
  dhruvaDiscoveryTitle: {
    ...dashboardTypography.body,
    color: '#174E7D',
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
  },
  dhruvaDiscoveryMeta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  dhruvaDiscoveryArrow: {
    alignItems: 'center',
    backgroundColor: '#EAF3FF',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  bannerCarousel: {
    marginTop: dashboardSpacing.md,
  },
  bannerTrack: {
    gap: dashboardSpacing.md,
    paddingRight: 28,
  },
  bannerCard: {
    aspectRatio: 1.95,
    backgroundColor: dashboardColors.card,
    borderRadius: 20,
    boxShadow: '0 5px 16px rgba(15, 23, 42, 0.08)',
    overflow: 'hidden',
  },
  bannerImage: {
    height: '100%',
    width: '100%',
  },
  bannerDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    minHeight: 28,
    paddingTop: dashboardSpacing.sm,
  },
  bannerDot: {
    backgroundColor: '#CBD2DC',
    borderRadius: 4,
    height: 7,
    width: 7,
  },
  bannerDotActive: {
    backgroundColor: dashboardColors.primary,
    width: 24,
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
    color: dashboardColors.primary,
    flex: 1,
    fontSize: 18,
  },
  sectionTitleSpacer: {
    flex: 1,
  },
  dhruvaSectionLogoWrap: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D6E7F7',
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    paddingHorizontal: 6,
    width: 124,
  },
  dhruvaSectionLogo: {
    height: 34,
    width: 110,
  },
  sectionCount: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  checkoutBar: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
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
    backgroundColor: dashboardColors.primary,
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
    color: '#D9E8F3',
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
    backgroundColor: '#F5F7FB',
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
