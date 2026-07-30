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
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '../../src/components/PressableScale';
import { MedicineDetailContent } from '../../src/components/shop/medicine-detail-content';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../src/dashboardTheme';
import { fetchShopProductById, type ShopProduct } from '../../src/data/shopProducts';
import { useCart } from '../../src/lib/cart';
import { useLanguage } from '../../src/lib/i18n';

export default function MedicineDetailScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ id?: string | string[]; phone?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { add, decrement, getQuantity, increment } = useCart();

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

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
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
        <ScrollView contentInsetAdjustmentBehavior="automatic">
          <MedicineDetailContent
            onAdd={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
              add(product);
            }}
            onDecrement={() => decrement(product.id)}
            onIncrement={() => increment(product.id)}
            product={product}
            quantity={getQuantity(product.id)}
          />
        </ScrollView>
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
});
