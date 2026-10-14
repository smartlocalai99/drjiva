import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { careFonts, careShared } from '../src/components/care/careStyles';
import { ChildSection } from '../src/components/care/ChildSection';
import { FollowUpCard } from '../src/components/care/FollowUpCard';
import { PlanSwitcher } from '../src/components/care/PlanSwitcher';
import { PregnancySection } from '../src/components/care/PregnancySection';
import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { dashboardColors, dashboardLayout, dashboardSpacing } from '../src/dashboardTheme';
import { fetchMyCare, readCachedMyCare, type MyCare } from '../src/lib/care';
import { useCareCopy } from '../src/lib/careCopy';
import { syncCareReminders } from '../src/lib/careReminders';
import { visitForDate } from '../src/lib/careSchedule';
import { getTabRoute } from '../src/lib/dashboardNav';
import { normalizeRoutePhone } from '../src/lib/routePhone';

type LoadState = 'loading' | 'ready' | 'offline' | 'error';

export default function MyCareScreen() {
  const router = useRouter();
  const { c, language } = useCareCopy();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);

  const [activeTab, setActiveTab] = useState<NavTabKey>('myCare');
  const [care, setCare] = useState<MyCare | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const hasCare = useRef(false);

  const load = useCallback(async () => {
    if (!phone) {
      setLoadState('error');
      return;
    }
    try {
      const next = await fetchMyCare(phone);
      setCare(next);
      hasCare.current = true;
      setLoadState('ready');
      void syncCareReminders(phone, next, language, { askPermission: true }).catch(() => undefined);
    } catch {
      const cached = await readCachedMyCare(phone);
      if (cached) {
        setCare(cached.data);
        hasCare.current = true;
        setLoadState('offline');
      } else {
        setLoadState(hasCare.current ? 'offline' : 'error');
      }
    }
  }, [language, phone]);

  // Show the last saved copy at once, then refresh from the server.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!hasCare.current && phone) {
          const cached = await readCachedMyCare(phone);
          if (active && cached && !hasCare.current) {
            setCare(cached.data);
            hasCare.current = true;
          }
        }
        if (active) await load();
      })();
      return () => {
        active = false;
      };
    }, [load, phone]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === activeTab) return;
    const route = getTabRoute(tab);
    if (!route) return;
    setActiveTab(tab);
    router.replace({ params: { phone }, pathname: route });
  };

  const plans = care?.plans ?? [];
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0] ?? null;
  const followup = care?.followup ?? null;
  const followupPlan = plans.find((plan) => plan.id === followup?.planId) ?? selectedPlan;
  const followupVisit = followup && followupPlan ? visitForDate(followupPlan, followup.nextDate) : null;
  const today = care?.today ?? '';
  // A pregnancy page opens straight on the baby; no page heading.
  const isPregnancy = selectedPlan?.type === 'pregnancy';
  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const scrollBottomPadding = navBottomOffset + dashboardLayout.bottomNavHeight + dashboardSpacing.xl;

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      {isPregnancy ? null : (
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons color={dashboardColors.primary} name="document-text" size={20} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.headerTitle}>{c('title')}</Text>
            <Text style={styles.headerSubtitle}>{c('subtitle')}</Text>
          </View>
        </View>
      )}

      {loadState === 'loading' && !care ? (
        <View style={styles.center}>
          <ActivityIndicator color={dashboardColors.primary} size="large" />
          <Text style={careShared.muted}>{c('loading')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, isPregnancy && styles.contentNoHeader, { paddingBottom: scrollBottomPadding }]}
          refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} tintColor={dashboardColors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {loadState === 'offline' ? (
            <View style={styles.banner}>
              <Ionicons color="#B45309" name="cloud-offline-outline" size={20} />
              <Text style={styles.bannerText}>{c('offline')}</Text>
            </View>
          ) : null}

          {loadState === 'error' && !care ? (
            <View style={[careShared.card, styles.centerCard]}>
              <Ionicons color={dashboardColors.textFaint} name="refresh" size={28} />
              <Text style={[careShared.body, styles.centerText]}>{c('loadError')}</Text>
            </View>
          ) : null}

          {care && !care.linked ? (
            <View style={[careShared.card, styles.centerCard]}>
              <Text style={[careShared.body, styles.centerText]}>{c('notLinked')}</Text>
            </View>
          ) : null}

          {care?.linked ? (
            <>
              {plans.length >= 2 ? (
                <PlanSwitcher
                  items={plans.map((plan) => ({ id: plan.id, label: plan.type === 'pregnancy' ? c('pregnancy') : plan.personName }))}
                  onSelect={setSelectedPlanId}
                  selectedId={selectedPlan?.id ?? null}
                />
              ) : null}

              {selectedPlan?.type === 'pregnancy' ? (
                <PregnancySection key={selectedPlan.id} plan={selectedPlan} today={today} />
              ) : null}

              {selectedPlan?.type === 'child' ? <ChildSection plan={selectedPlan} today={today} /> : null}

              <FollowUpCard followup={followup} today={today} visit={followupVisit} />
            </>
          ) : null}
        </ScrollView>
      )}

      <BottomNav activeTab={activeTab} bottomOffset={navBottomOffset} onSelectTab={handleSelectTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  banner: {
    alignItems: 'center',
    backgroundColor: dashboardColors.warningTint,
    borderCurve: 'continuous',
    borderRadius: 16,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  bannerText: {
    color: '#92400E',
    flex: 1,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 21,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
  },
  centerCard: {
    alignItems: 'center',
  },
  centerText: {
    textAlign: 'center',
  },
  content: {
    gap: dashboardSpacing.gap,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  contentNoHeader: {
    paddingTop: dashboardSpacing.gap,
  },
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingBottom: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  headerIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 10,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerSubtitle: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.medium,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 2,
  },
  headerTitle: {
    color: dashboardColors.text,
    fontFamily: careFonts.semiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
});
