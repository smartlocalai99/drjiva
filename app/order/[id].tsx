import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
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
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../src/dashboardTheme';
import { formatRupees } from '../../src/lib/currency';
import {
  getPatientOrder,
  type PatientOrder,
  type PatientOrderStatus,
  patientOrderStatusLabel,
} from '../../src/lib/patientOrders';
import { getPatientByPhone } from '../../src/lib/patients';

const TRACKING_STEPS: Array<{ status: PatientOrderStatus; title: string }> = [
  { status: 'placed', title: 'Order placed' },
  { status: 'shared', title: 'Finding a rider' },
  { status: 'assigned', title: 'Rider assigned' },
  { status: 'collected', title: 'Collected from hospital' },
  { status: 'out_for_delivery', title: 'Out for delivery' },
  { status: 'delivered', title: 'Delivered' },
];

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string | string[];
    phone?: string | string[];
  }>();
  const id = firstParam(params.id);
  const phone = firstParam(params.phone).replace(/\D/g, '').slice(-10);
  const [order, setOrder] = useState<PatientOrder>();
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadOrder = useCallback(
    async (quiet = false) => {
      try {
        const patient = await getPatientByPhone(phone);
        if (!patient || !id) {
          throw new Error('This order could not be found.');
        }
        setOrder(await getPatientOrder(patient.patientId, id));
        setError('');
      } catch (cause) {
        if (!quiet) {
          setError(cause instanceof Error ? cause.message : 'We could not load this order.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [id, phone],
  );

  useFocusEffect(
    useCallback(() => {
      void loadOrder();
      const timer = setInterval(() => void loadOrder(true), 15_000);
      return () => clearInterval(timer);
    }, [loadOrder]),
  );

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Back" hitSlop={12} onPress={() => router.back()} style={styles.headerSide}>
          <Ionicons color={dashboardColors.text} name="chevron-back" size={24} />
        </Pressable>
        <Text style={styles.headerTitle}>{order ? `ORD-${order.orderNumber}` : 'Order details'}</Text>
        <View style={styles.headerSide} />
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={dashboardColors.primary} /></View>
      ) : error || !order ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Order unavailable</Text>
          <Text style={styles.errorText}>{error}</Text>
          <PressableScale onPress={() => void loadOrder()} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </PressableScale>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons color={dashboardColors.primary} name="bicycle-outline" size={28} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>CURRENT STATUS</Text>
              <Text style={styles.heroTitle}>{patientOrderStatusLabel(order.status)}</Text>
              <Text style={styles.heroMeta}>Cash on delivery · {formatRupees(order.total)}</Text>
            </View>
          </View>

          {order.status === 'cancelled' ? (
            <View style={styles.cancelledCard}>
              <Ionicons color={dashboardColors.error} name="close-circle" size={22} />
              <Text style={styles.cancelledText}>This order was cancelled.</Text>
            </View>
          ) : (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Delivery progress</Text>
              <OrderTimeline status={order.status} />
            </View>
          )}

          {order.riderName ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Your rider</Text>
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><Ionicons color={dashboardColors.primary} name="person" size={20} /></View>
                <View style={styles.detailCopy}>
                  <Text style={styles.detailTitle}>{order.riderName}</Text>
                  {order.riderPhone ? <Text style={styles.detailText}>+91 {order.riderPhone}</Text> : null}
                </View>
              </View>
            </View>
          ) : null}

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Medicines</Text>
            {order.items.map((item, index) => (
              <View key={item.id} style={[styles.itemRow, index > 0 && styles.itemBorder]}>
                <View style={styles.itemImageWrap}>
                  {item.imageUrl ? (
                    <Image contentFit="contain" source={{ uri: item.imageUrl }} style={styles.itemImage} />
                  ) : (
                    <Ionicons color={dashboardColors.textFaint} name="medical-outline" size={24} />
                  )}
                </View>
                <View style={styles.itemCopy}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.packDisplay} · Qty {item.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>{formatRupees(item.lineTotal)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Delivery details</Text>
            <Detail
              icon="business-outline"
              text={order.hospital.address || 'Hospital pickup details pending'}
              title={order.hospital.name}
            />
            <View style={styles.detailDivider} />
            <Detail icon="location-outline" title={`${order.address.label} address`} text={order.address.formatted} />
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Payment summary</Text>
            <AmountRow label="Item total" value={order.subtotal} />
            <AmountRow label="Delivery" value={order.deliveryFee} />
            <View style={styles.detailDivider} />
            <AmountRow bold label="Cash to pay" value={order.total} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OrderTimeline({ status }: { status: PatientOrderStatus }) {
  const current = TRACKING_STEPS.findIndex((step) => step.status === status);
  return (
    <View style={styles.timeline}>
      {TRACKING_STEPS.map((step, index) => {
        const complete = index <= current;
        return (
          <View key={step.status} style={styles.timelineRow}>
            <View style={styles.timelineRail}>
              <View style={[styles.timelineDot, complete && styles.timelineDotComplete]}>
                {index < current ? <Ionicons color="#FFFFFF" name="checkmark" size={12} /> : null}
              </View>
              {index < TRACKING_STEPS.length - 1 ? <View style={[styles.timelineLine, index < current && styles.timelineLineComplete]} /> : null}
            </View>
            <Text style={[styles.timelineText, complete && styles.timelineTextComplete]}>{step.title}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Detail({ icon, text, title }: { icon: keyof typeof Ionicons.glyphMap; text: string; title: string }) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}><Ionicons color={dashboardColors.primary} name={icon} size={20} /></View>
      <View style={styles.detailCopy}><Text style={styles.detailTitle}>{title}</Text><Text style={styles.detailText}>{text}</Text></View>
    </View>
  );
}

function AmountRow({ bold = false, label, value }: { bold?: boolean; label: string; value: number }) {
  return <View style={styles.amountRow}><Text style={[styles.amountLabel, bold && styles.amountBold]}>{label}</Text><Text style={[styles.amountValue, bold && styles.amountBold]}>{value === 0 && label === 'Delivery' ? 'FREE' : formatRupees(value)}</Text></View>;
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: dashboardColors.bg, flex: 1 },
  header: { alignItems: 'center', backgroundColor: dashboardColors.card, flexDirection: 'row', paddingHorizontal: dashboardSpacing.pagePadding, paddingVertical: 18 },
  headerSide: { width: 40 },
  headerTitle: { ...dashboardTypography.title, color: dashboardColors.text, flex: 1, textAlign: 'center' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 32 },
  errorTitle: { ...dashboardTypography.title, color: dashboardColors.text },
  errorText: { ...dashboardTypography.body, color: dashboardColors.textMuted, marginTop: 8, textAlign: 'center' },
  retryButton: { backgroundColor: dashboardColors.primary, borderRadius: dashboardRadii.button, marginTop: 22, paddingHorizontal: 24, paddingVertical: 14 },
  retryText: { ...dashboardTypography.button, color: '#FFFFFF' },
  content: { padding: dashboardSpacing.pagePadding, paddingBottom: 48 },
  heroCard: { alignItems: 'center', backgroundColor: dashboardColors.primaryTint, borderRadius: dashboardRadii.card, flexDirection: 'row', marginBottom: 14, padding: 20 },
  heroIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  heroCopy: { flex: 1, marginLeft: 14 },
  heroEyebrow: { ...dashboardTypography.caption, color: dashboardColors.primary },
  heroTitle: { ...dashboardTypography.title, color: dashboardColors.text, marginTop: 2 },
  heroMeta: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginTop: 4 },
  sectionCard: { backgroundColor: dashboardColors.card, borderRadius: dashboardRadii.card, marginBottom: 14, padding: 20 },
  sectionTitle: { ...dashboardTypography.cardTitle, color: dashboardColors.text, marginBottom: 16 },
  cancelledCard: { alignItems: 'center', backgroundColor: dashboardColors.errorTint, borderRadius: dashboardRadii.card, flexDirection: 'row', gap: 10, marginBottom: 14, padding: 18 },
  cancelledText: { ...dashboardTypography.body, color: dashboardColors.error },
  timeline: { paddingTop: 2 },
  timelineRow: { flexDirection: 'row', minHeight: 47 },
  timelineRail: { alignItems: 'center', width: 28 },
  timelineDot: { alignItems: 'center', backgroundColor: dashboardColors.track, borderRadius: 10, height: 20, justifyContent: 'center', width: 20 },
  timelineDotComplete: { backgroundColor: dashboardColors.primary },
  timelineLine: { backgroundColor: dashboardColors.track, flex: 1, width: 2 },
  timelineLineComplete: { backgroundColor: dashboardColors.primary },
  timelineText: { ...dashboardTypography.body, color: dashboardColors.textFaint, marginLeft: 8, paddingTop: 1 },
  timelineTextComplete: { color: dashboardColors.text },
  detailRow: { alignItems: 'flex-start', flexDirection: 'row' },
  detailIcon: { alignItems: 'center', backgroundColor: dashboardColors.primaryTint, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  detailCopy: { flex: 1, marginLeft: 12 },
  detailTitle: { ...dashboardTypography.body, color: dashboardColors.text },
  detailText: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginTop: 3 },
  detailDivider: { backgroundColor: dashboardColors.track, height: StyleSheet.hairlineWidth, marginVertical: 16 },
  itemRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 10 },
  itemBorder: { borderTopColor: dashboardColors.track, borderTopWidth: StyleSheet.hairlineWidth },
  itemImageWrap: { alignItems: 'center', backgroundColor: dashboardColors.bg, borderRadius: 12, height: 50, justifyContent: 'center', width: 50 },
  itemImage: { height: 42, width: 42 },
  itemCopy: { flex: 1, marginHorizontal: 12 },
  itemName: { ...dashboardTypography.body, color: dashboardColors.text },
  itemMeta: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginTop: 3 },
  itemPrice: { ...dashboardTypography.body, color: dashboardColors.text },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 5 },
  amountLabel: { ...dashboardTypography.body, color: dashboardColors.textMuted },
  amountValue: { ...dashboardTypography.body, color: dashboardColors.text },
  amountBold: { color: dashboardColors.text, fontFamily: 'Inter_700Bold' },
});
