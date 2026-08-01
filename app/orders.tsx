import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { formatRupees } from '../src/lib/currency';
import {
  isActiveOrderStatus,
  listPatientOrders,
  type PatientOrder,
  patientOrderStatusLabel,
} from '../src/lib/patientOrders';
import { getPatientByPhone } from '../src/lib/patients';

const REFRESH_MS = 15_000;

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function OrdersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = firstParam(params.phone).replace(/\D/g, '').slice(-10);
  const [orders, setOrders] = useState<PatientOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadOrders = useCallback(
    async (quiet = false) => {
      if (!phone) {
        setError('Your phone number is missing. Please sign in again.');
        setIsLoading(false);
        return;
      }
      if (!quiet) {
        setError('');
      }
      try {
        const patient = await getPatientByPhone(phone);
        if (!patient) {
          throw new Error('Complete your profile to view orders.');
        }
        setOrders(await listPatientOrders(patient.patientId));
      } catch (cause) {
        if (!quiet) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'We could not load your orders. Please try again.',
          );
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [phone],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadOrders();
      const timer = setInterval(() => {
        if (active) {
          void loadOrders(true);
        }
      }, REFRESH_MS);
      return () => {
        active = false;
        clearInterval(timer);
      };
    }, [loadOrders]),
  );

  const activeOrders = useMemo(
    () => orders.filter((order) => isActiveOrderStatus(order.status)),
    [orders],
  );
  const pastOrders = useMemo(
    () => orders.filter((order) => !isActiveOrderStatus(order.status)),
    [orders],
  );

  const openOrder = (order: PatientOrder) => {
    router.push({
      params: { id: order.id, phone },
      pathname: '/order/[id]',
    });
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
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Your orders</Text>
          <Text style={styles.headerSubtitle}>Track medicines from hospital to home</Text>
        </View>
        <View style={styles.headerSide} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={dashboardColors.primary} />
          <Text style={styles.centerText}>Loading your orders…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons color={dashboardColors.error} name="alert-circle-outline" size={34} />
          </View>
          <Text style={styles.emptyTitle}>Orders unavailable</Text>
          <Text style={styles.centerText}>{error}</Text>
          <PressableScale onPress={() => void loadOrders()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Try again</Text>
          </PressableScale>
        </View>
      ) : orders.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons color={dashboardColors.primary} name="receipt-outline" size={36} />
          </View>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.centerText}>Your medicine orders and delivery updates will appear here.</Text>
          <PressableScale
            onPress={() => router.replace({ params: { phone }, pathname: '/shop' })}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Browse medicines</Text>
          </PressableScale>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              onRefresh={() => {
                setIsRefreshing(true);
                void loadOrders();
              }}
              refreshing={isRefreshing}
              tintColor={dashboardColors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {activeOrders.length > 0 ? (
            <OrderSection onOpen={openOrder} orders={activeOrders} title="Active orders" />
          ) : null}
          {pastOrders.length > 0 ? (
            <OrderSection onOpen={openOrder} orders={pastOrders} title="Order history" />
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OrderSection({
  onOpen,
  orders,
  title,
}: {
  onOpen: (order: PatientOrder) => void;
  orders: PatientOrder[];
  title: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {orders.map((order) => (
        <PressableScale
          accessibilityLabel={`Open order ORD-${order.orderNumber}`}
          key={order.id}
          onPress={() => onOpen(order)}
          pressedScale={0.985}
          style={styles.orderCard}
        >
          <View style={styles.orderTopRow}>
            <View>
              <Text style={styles.orderNumber}>ORD-{order.orderNumber}</Text>
              <Text style={styles.orderDate}>
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </Text>
            </View>
            <View
              style={[
                styles.statusPill,
                order.status === 'delivered' && styles.statusPillDelivered,
                order.status === 'cancelled' && styles.statusPillCancelled,
              ]}
            >
              <Text style={styles.statusText}>{patientOrderStatusLabel(order.status)}</Text>
            </View>
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.orderBottomRow}>
            <View style={styles.orderSummary}>
              <Text numberOfLines={1} style={styles.hospitalName}>{order.hospital.name}</Text>
              <Text numberOfLines={1} style={styles.itemSummary}>
                {order.items.map((item) => `${item.name} × ${item.quantity}`).join(', ')}
              </Text>
            </View>
            <View style={styles.totalWrap}>
              <Text style={styles.total}>{formatRupees(order.total)}</Text>
              <Ionicons color={dashboardColors.textFaint} name="chevron-forward" size={18} />
            </View>
          </View>
        </PressableScale>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: dashboardColors.bg, flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    flexDirection: 'row',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.gap,
  },
  headerSide: { alignItems: 'flex-start', justifyContent: 'center', width: 40 },
  headerCopy: { alignItems: 'center', flex: 1 },
  headerTitle: { ...dashboardTypography.title, color: dashboardColors.text },
  headerSubtitle: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginTop: 2 },
  content: { padding: dashboardSpacing.pagePadding, paddingBottom: 44 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  centerText: { ...dashboardTypography.body, color: dashboardColors.textMuted, marginTop: 10, textAlign: 'center' },
  emptyIcon: { alignItems: 'center', backgroundColor: dashboardColors.primaryTint, borderRadius: 36, height: 72, justifyContent: 'center', marginBottom: 18, width: 72 },
  emptyTitle: { ...dashboardTypography.title, color: dashboardColors.text, textAlign: 'center' },
  primaryButton: { backgroundColor: dashboardColors.primary, borderRadius: dashboardRadii.button, marginTop: 24, paddingHorizontal: 24, paddingVertical: 15 },
  primaryButtonText: { ...dashboardTypography.button, color: '#FFFFFF' },
  section: { marginBottom: 28 },
  sectionTitle: { ...dashboardTypography.title, color: dashboardColors.text, marginBottom: 12 },
  orderCard: { backgroundColor: dashboardColors.card, borderRadius: dashboardRadii.card, marginBottom: 12, padding: 18, shadowColor: dashboardColors.shadow, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.06, shadowRadius: 14 },
  orderTopRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  orderNumber: { ...dashboardTypography.cardTitle, color: dashboardColors.text },
  orderDate: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginTop: 3 },
  statusPill: { backgroundColor: dashboardColors.warningTint, borderRadius: dashboardRadii.pill, maxWidth: '56%', paddingHorizontal: 10, paddingVertical: 6 },
  statusPillDelivered: { backgroundColor: dashboardColors.successTint },
  statusPillCancelled: { backgroundColor: dashboardColors.errorTint },
  statusText: { ...dashboardTypography.caption, color: dashboardColors.text, textAlign: 'center' },
  cardDivider: { backgroundColor: dashboardColors.track, height: StyleSheet.hairlineWidth, marginVertical: 14 },
  orderBottomRow: { alignItems: 'center', flexDirection: 'row' },
  orderSummary: { flex: 1, marginRight: 12 },
  hospitalName: { ...dashboardTypography.body, color: dashboardColors.text },
  itemSummary: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginTop: 3 },
  totalWrap: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  total: { ...dashboardTypography.cardTitle, color: dashboardColors.text },
});
