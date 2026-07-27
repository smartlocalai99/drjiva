import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { SHOP_PRODUCTS, type ShopProduct } from '../src/data/shopProducts';
import { useCart } from '../src/lib/cart';
import { getTabRoute } from '../src/lib/dashboardNav';
import { useLanguage } from '../src/lib/i18n';

const TINTS = {
  error: { bg: dashboardColors.errorTint, fg: dashboardColors.error },
  primary: { bg: dashboardColors.primaryTint, fg: dashboardColors.primary },
  success: { bg: dashboardColors.successTint, fg: dashboardColors.success },
  warning: { bg: dashboardColors.warningTint, fg: dashboardColors.warning },
} as const;

const PLACEHOLDER_QUERIES = [
  'Dolo 650',
  'Crocin',
  'Combiflam',
  'Paracetamol',
  'Cetirizine',
  'ORS',
  'Volini',
  'Digene',
] as const;
const PLACEHOLDER_ROTATION_MS = 2200;

export default function ShopScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { totalItems } = useCart();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<NavTabKey>('shop');
  const [query, setQuery] = useState('');
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const scrollBottomPadding = navBottomOffset + dashboardLayout.bottomNavHeight + 24;

  useEffect(() => {
    if (query.length > 0) {
      return;
    }

    const rotationTimer = setInterval(() => {
      setPlaceholderIndex((current) => (current + 1) % PLACEHOLDER_QUERIES.length);
    }, PLACEHOLDER_ROTATION_MS);

    return () => {
      clearInterval(rotationTimer);
    };
  }, [query]);

  const filteredProducts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return SHOP_PRODUCTS;
    }
    return SHOP_PRODUCTS.filter((product) =>
      product.name.toLowerCase().includes(trimmed),
    );
  }, [query]);

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

  const handleOpenCart = () => {
    router.push({ params: { phone }, pathname: '/cart' });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerSide} />
        <Text style={styles.headerTitle}>{t('shop')}</Text>
        <Pressable
          accessibilityLabel={t('cart')}
          hitSlop={8}
          onPress={handleOpenCart}
          style={styles.headerSide}
        >
          <Ionicons color={dashboardColors.text} name="cart-outline" size={24} />
          {totalItems > 0 ? (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{totalItems}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.searchSection}>
        <Text style={styles.subtitle}>{t('shopSubtitle')}</Text>

        <View style={styles.searchBar}>
          <Ionicons color={dashboardColors.textFaint} name="search-outline" size={18} />
          <View style={styles.searchInputWrap}>
            <TextInput
              accessibilityLabel={t('searchMedicine')}
              onChangeText={setQuery}
              style={styles.searchInput}
              value={query}
            />
            {query.length === 0 ? (
              <Animated.Text
                entering={FadeInDown.duration(280)}
                exiting={FadeOutUp.duration(200)}
                key={placeholderIndex}
                pointerEvents="none"
                style={styles.searchPlaceholder}
              >
                {PLACEHOLDER_QUERIES[placeholderIndex]}
              </Animated.Text>
            ) : null}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: scrollBottomPadding },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </View>
      </ScrollView>

      <BottomNav
        activeTab={activeTab}
        bottomOffset={navBottomOffset}
        onSelectTab={handleSelectTab}
      />
    </SafeAreaView>
  );
}

function ProductCard({ product }: { product: ShopProduct }) {
  const { t } = useLanguage();
  const { decrement, getQuantity, increment } = useCart();
  const quantity = getQuantity(product.id);
  const tint = TINTS[product.tint];

  return (
    <View style={styles.card}>
      <View style={[styles.tile, { backgroundColor: tint.bg }]}>
        <Ionicons color={tint.fg} name={product.icon} size={40} />
        <View style={styles.packBadge}>
          <Text style={styles.packBadgeText}>{product.packSize}</Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.cardName}>
        {product.name}
      </Text>
      <Text style={styles.cardPrice}>₹{product.price}</Text>

      {quantity === 0 ? (
        <PressableScale
          accessibilityLabel={`${t('addToCart')}: ${product.name}`}
          onPress={() => increment(product.id)}
          pressedScale={0.96}
          style={styles.addButton}
        >
          <Text style={styles.addButtonText}>{t('addToCart')}</Text>
        </PressableScale>
      ) : (
        <View style={styles.stepper}>
          <PressableScale
            accessibilityLabel="Decrease quantity"
            onPress={() => decrement(product.id)}
            pressedScale={0.9}
            style={styles.stepperButton}
          >
            <Ionicons color={dashboardColors.primary} name="remove" size={16} />
          </PressableScale>
          <Text style={styles.stepperValue}>{quantity}</Text>
          <PressableScale
            accessibilityLabel="Increase quantity"
            onPress={() => increment(product.id)}
            pressedScale={0.9}
            style={styles.stepperButton}
          >
            <Ionicons color={dashboardColors.primary} name="add" size={16} />
          </PressableScale>
        </View>
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
  headerSide: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  cartBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.error,
    borderRadius: 8,
    height: 16,
    justifyContent: 'center',
    minWidth: 16,
    paddingHorizontal: 3,
    position: 'absolute',
    right: -4,
    top: -4,
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  searchSection: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  subtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
  },
  searchBar: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginTop: dashboardSpacing.gap,
    marginBottom: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.gap,
    paddingVertical: 12,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  searchInputWrap: {
    flex: 1,
    height: 20,
    justifyContent: 'center',
  },
  searchInput: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontSize: 15,
    height: '100%',
    padding: 0,
    position: 'absolute',
    width: '100%',
  },
  searchPlaceholder: {
    ...dashboardTypography.body,
    color: dashboardColors.textFaint,
    fontSize: 15,
    left: 0,
    position: 'absolute',
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dashboardSpacing.gap,
    marginTop: dashboardSpacing.sm,
  },
  card: {
    width: '47%',
  },
  tile: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: dashboardRadii.card,
    justifyContent: 'center',
    width: '100%',
  },
  packBadge: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.pill,
    paddingHorizontal: dashboardSpacing.sm,
    paddingVertical: 4,
    position: 'absolute',
    right: dashboardSpacing.sm,
    top: dashboardSpacing.sm,
  },
  packBadgeText: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    fontSize: 11,
  },
  cardName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  cardPrice: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    marginTop: 2,
    textAlign: 'center',
  },
  addButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    marginTop: dashboardSpacing.sm,
    paddingVertical: 10,
  },
  addButtonText: {
    ...dashboardTypography.body,
    color: dashboardColors.primary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.sm,
    paddingVertical: 8,
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
});
