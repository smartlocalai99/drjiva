import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { DashboardHeader } from '../src/components/dashboard/DashboardHeader';
import { EmptyMedicines } from '../src/components/dashboard/EmptyMedicines';
import { FloatingAddButton } from '../src/components/dashboard/FloatingAddButton';
import { MedicineCard } from '../src/components/dashboard/MedicineCard';
import { PressableScale } from '../src/components/PressableScale';
import {
  fetchMedicinesForDate,
  type Medicine,
} from '../src/data/medicines';
import { selectNearestSession } from '../src/data/medicineCourse';
import {
  dashboardColors,
  dashboardLayout,
  dashboardSpacing,
} from '../src/dashboardTheme';
import { getGreeting } from '../src/lib/dates';
import { getTabRoute } from '../src/lib/dashboardNav';
import {
  beginDashboardMedicineLoad,
  canPreserveDashboardMedicines,
  failDashboardMedicineLoad,
  getDashboardMedicineContent,
  getInitialDashboardMedicineLoadState,
  type DashboardMedicineLoadState,
} from '../src/lib/dashboard-loading';
import {
  getDashboardSnapshot,
  setDashboardSnapshot,
} from '../src/lib/dashboardPreload';
import { useLanguage } from '../src/lib/i18n';
import { formatDateOnly } from '../src/lib/medicineCalendar';
import { getPatientByPhone } from '../src/lib/patients';
import {
  getCachedAvatarUrl,
  getCachedPatientName,
  saveCachedAvatarUrl,
  saveCachedPatientName,
} from '../src/lib/session';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    phone?: string | string[];
  }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const initialSnapshot = useMemo(
    () => getDashboardSnapshot(phone, today),
    [phone, today],
  );
  const [medicines, setMedicines] = useState<Medicine[]>(
    initialSnapshot?.medicines ?? [],
  );
  const [medicinePhone, setMedicinePhone] = useState(phone);
  const [medicineDateKey, setMedicineDateKey] = useState(
    initialSnapshot?.dateKey ?? formatDateOnly(today),
  );
  const [medicineLoadState, setMedicineLoadState] =
    useState<DashboardMedicineLoadState>(() =>
      getInitialDashboardMedicineLoadState(
        initialSnapshot !== null,
        initialSnapshot?.medicines.length ?? 0,
      ),
    );
  const [activeTab, setActiveTab] = useState<NavTabKey>('today');
  const [dashboardDate, setDashboardDate] = useState(today);
  const [patientLookupAttempt, setPatientLookupAttempt] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [patientName, setPatientName] = useState<string | undefined>(
    initialSnapshot?.patientName,
  );
  const [patientAvatarUrl, setPatientAvatarUrl] = useState<string | null>(null);
  const [patientNamePhone, setPatientNamePhone] = useState(phone);
  const [patientContext, setPatientContext] = useState<{
    patientId: string;
    phone: string;
  } | null>(
    initialSnapshot
      ? { patientId: initialSnapshot.patientId, phone }
      : null,
  );
  const patientId =
    patientContext?.phone === phone ? patientContext.patientId : null;
  const dashboardDateKey = formatDateOnly(dashboardDate);
  const snapshotMatchesDashboardDate =
    initialSnapshot?.dateKey === dashboardDateKey;
  const medicineStateMatchesDashboard =
    medicinePhone === phone && medicineDateKey === dashboardDateKey;
  const visibleMedicines =
    medicineStateMatchesDashboard
      ? medicines
      : snapshotMatchesDashboardDate
        ? initialSnapshot.medicines
        : [];
  const visibleMedicineLoadState =
    medicineStateMatchesDashboard
      ? medicineLoadState
      : !phone
        ? 'ready'
        : getInitialDashboardMedicineLoadState(
            snapshotMatchesDashboardDate,
            visibleMedicines.length,
          );
  const visiblePatientName =
    patientNamePhone === phone
      ? patientName
      : initialSnapshot?.patientName;
  const activePhoneRef = useRef(phone);
  const activePatientIdRef = useRef(patientId);
  const medicinesRef = useRef(visibleMedicines);
  const medicineDateKeyRef = useRef(medicineDateKey);
  const medicinePhoneRef = useRef(medicinePhone);
  const medicineRequestIdRef = useRef(0);
  const patientNameRef = useRef(visiblePatientName);

  activePhoneRef.current = phone;
  activePatientIdRef.current = patientId;
  medicinesRef.current = visibleMedicines;
  medicineDateKeyRef.current = medicineDateKey;
  medicinePhoneRef.current = medicinePhone;
  patientNameRef.current = visiblePatientName;

  useEffect(() => {
    medicineRequestIdRef.current += 1;
    const currentDateKey = formatDateOnly(new Date());
    const currentSnapshot =
      initialSnapshot?.dateKey === currentDateKey ? initialSnapshot : null;
    const snapshotMedicines = currentSnapshot?.medicines ?? [];
    medicinesRef.current = snapshotMedicines;
    medicineDateKeyRef.current =
      currentSnapshot?.dateKey ?? currentDateKey;
    medicinePhoneRef.current = phone;
    setMedicinePhone(phone);
    setMedicineDateKey(currentSnapshot?.dateKey ?? currentDateKey);
    setMedicines(snapshotMedicines);
    setMedicineLoadState(
      getInitialDashboardMedicineLoadState(
        currentSnapshot !== null,
        snapshotMedicines.length,
      ),
    );
    setPatientContext(
      currentSnapshot
        ? { patientId: currentSnapshot.patientId, phone }
        : null,
    );
    setPatientName(currentSnapshot?.patientName || undefined);
    setPatientNamePhone(phone);
    setPatientAvatarUrl(null);

    if (!phone) {
      setMedicineLoadState('ready');
      return;
    }

    let cancelled = false;

    const loadPatientName = async () => {
      const [cachedName, cachedAvatarUrl] = await Promise.all([
        getCachedPatientName(phone).catch(() => null),
        getCachedAvatarUrl(phone).catch(() => null),
      ]);
      if (!cancelled && cachedName) {
        setPatientName(cachedName);
        setPatientNamePhone(phone);
      }
      if (!cancelled && cachedAvatarUrl) {
        setPatientAvatarUrl(cachedAvatarUrl);
      }

      try {
        const patient = await getPatientByPhone(phone);
        if (!cancelled) {
          if (patient) {
            if (
              currentSnapshot &&
              currentSnapshot.patientId !== patient.patientId
            ) {
              medicinesRef.current = [];
              medicineDateKeyRef.current = currentDateKey;
              medicinePhoneRef.current = phone;
              setMedicinePhone(phone);
              setMedicineDateKey(currentDateKey);
              setMedicines([]);
              setMedicineLoadState('loading');
            }
            setPatientContext({ patientId: patient.patientId, phone });
            setPatientName(patient.name);
            setPatientNamePhone(phone);
            setPatientAvatarUrl(patient.avatarUrl);
            void saveCachedPatientName(phone, patient.name).catch(
              () => undefined,
            );
            void saveCachedAvatarUrl(phone, patient.avatarUrl).catch(
              () => undefined,
            );
          } else {
            setPatientContext(null);
            medicinesRef.current = [];
            medicineDateKeyRef.current = currentDateKey;
            medicinePhoneRef.current = phone;
            setMedicinePhone(phone);
            setMedicineDateKey(currentDateKey);
            setMedicines([]);
            setMedicineLoadState('ready');
          }
        }
      } catch {
        if (!cancelled) {
          setMedicineLoadState(failDashboardMedicineLoad);
        }
      }
    };

    void loadPatientName();

    return () => {
      cancelled = true;
    };
  }, [initialSnapshot, patientLookupAttempt, phone]);

  const loadMedicines = useCallback(
    async (date: Date) => {
      if (!patientId) {
        return false;
      }

      const requestId = medicineRequestIdRef.current + 1;
      medicineRequestIdRef.current = requestId;
      const requestPatientId = patientId;
      const requestPhone = phone;
      const requestDateKey = formatDateOnly(date);
      const canPreserveCurrentMedicines =
        canPreserveDashboardMedicines(
          medicinePhoneRef.current,
          medicineDateKeyRef.current,
          requestPhone,
          requestDateKey,
        );

      if (canPreserveCurrentMedicines) {
        setMedicineLoadState((current) =>
          beginDashboardMedicineLoad(current, medicinesRef.current.length),
        );
      } else {
        medicinesRef.current = [];
        medicineDateKeyRef.current = requestDateKey;
        medicinePhoneRef.current = requestPhone;
        setMedicinePhone(requestPhone);
        setMedicineDateKey(requestDateKey);
        setMedicines([]);
        setMedicineLoadState('loading');
      }

      try {
        const nextMedicines = await fetchMedicinesForDate(
          requestPatientId,
          date,
        );
        if (
          medicineRequestIdRef.current !== requestId ||
          activePhoneRef.current !== requestPhone ||
          activePatientIdRef.current !== requestPatientId
        ) {
          return false;
        }

        medicinesRef.current = nextMedicines;
        medicineDateKeyRef.current = requestDateKey;
        medicinePhoneRef.current = requestPhone;
        setMedicinePhone(requestPhone);
        setMedicineDateKey(requestDateKey);
        setMedicines(nextMedicines);
        setMedicineLoadState('ready');
        setDashboardSnapshot({
          dateKey: requestDateKey,
          medicines: nextMedicines,
          patientId: requestPatientId,
          patientName: patientNameRef.current ?? '',
          phone: requestPhone,
        });
        return true;
      } catch {
        if (
          medicineRequestIdRef.current === requestId &&
          activePhoneRef.current === requestPhone &&
          activePatientIdRef.current === requestPatientId
        ) {
          setMedicineLoadState(failDashboardMedicineLoad);
        }
        return false;
      }
    },
    [patientId, phone],
  );

  useFocusEffect(
    useCallback(() => {
      if (phone) {
        void getCachedAvatarUrl(phone)
          .then((cachedAvatarUrl) => setPatientAvatarUrl(cachedAvatarUrl))
          .catch(() => undefined);
      }

      const focusDate = new Date();
      setDashboardDate(focusDate);
      let observedDateKey = formatDateOnly(focusDate);
      const clock = setInterval(() => {
        const currentDate = new Date();
        const currentDateKey = formatDateOnly(currentDate);
        setDashboardDate(currentDate);
        if (patientId && currentDateKey !== observedDateKey) {
          observedDateKey = currentDateKey;
          void loadMedicines(currentDate);
        }
      }, 60_000);

      if (patientId) {
        void loadMedicines(focusDate);
      }

      return () => {
        clearInterval(clock);
        medicineRequestIdRef.current += 1;
      };
    }, [loadMedicines, patientId, phone]),
  );

  useEffect(() => {
    if (!phone || !patientId) {
      return;
    }
    router.prefetch({
      params: { patientId, phone },
      pathname: '/documents',
    });
  }, [patientId, phone, router]);

  const nearestSession = useMemo(
    () => selectNearestSession(visibleMedicines, dashboardDate),
    [dashboardDate, visibleMedicines],
  );
  const nextDashboardTransitionTime = useMemo(() => {
    const nowTime = dashboardDate.getTime();
    return visibleMedicines.reduce<number | null>((next, medicine) => {
      if (medicine.completed) return next;
      const scheduledTime = new Date(medicine.scheduledFor).getTime();
      if (Number.isNaN(scheduledTime) || scheduledTime <= nowTime) {
        return next;
      }
      return next === null || scheduledTime < next ? scheduledTime : next;
    }, null);
  }, [dashboardDate, visibleMedicines]);

  useEffect(() => {
    if (nextDashboardTransitionTime === null) return;
    const remaining = Math.max(
      0,
      nextDashboardTransitionTime - Date.now(),
    );
    const timeout = setTimeout(
      () => setDashboardDate(new Date()),
      Math.min(remaining + 50, 2_147_483_647),
    );
    return () => clearTimeout(timeout);
  }, [nextDashboardTransitionTime]);

  const medicineContent = getDashboardMedicineContent(
    visibleMedicineLoadState,
    nearestSession.length,
  );

  const retryPatientLookup = useCallback(() => {
    medicineRequestIdRef.current += 1;
    setMedicineLoadState((current) =>
      beginDashboardMedicineLoad(current, medicinesRef.current.length),
    );
    setPatientLookupAttempt((current) => current + 1);
  }, []);

  const retryDashboardLoad = () => {
    if (patientId) {
      void loadMedicines(new Date());
    } else {
      retryPatientLookup();
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const refreshDate = new Date();
    setDashboardDate(refreshDate);
    if (patientId) {
      await loadMedicines(refreshDate);
    } else {
      retryPatientLookup();
    }
    setRefreshing(false);
  };

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === activeTab) {
      return;
    }

    const route = getTabRoute(tab);
    if (!route) {
      return;
    }

    setActiveTab(tab);
    router.replace({
      params: {
        phone,
        ...(tab === 'documents' && patientId ? { patientId } : {}),
      },
      pathname: route,
    });
  };

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const addButtonBottomOffset =
    navBottomOffset + dashboardLayout.bottomNavHeight + 12;
  const scrollBottomPadding =
    addButtonBottomOffset + dashboardLayout.floatingButtonHeight + 24;

  return (
    <Animated.View entering={FadeIn.duration(280)} style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          medicineContent !== 'medicines' && styles.contentEmpty,
          { paddingBottom: scrollBottomPadding, paddingTop: insets.top + 8 },
        ]}
        refreshControl={
          <RefreshControl
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={dashboardColors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader
          avatarUrl={patientAvatarUrl}
          greeting={getGreeting(dashboardDate)}
          name={visiblePatientName}
          onPressProfile={() =>
            router.push({ params: { phone }, pathname: '/more' })
          }
          profileAccessibilityLabel={t('manageProfile')}
        />

        {medicineContent === 'loading' ? (
          <View
            accessibilityLabel="Loading medicines"
            accessibilityLiveRegion="polite"
            style={styles.medicineLoading}
          >
            <ActivityIndicator color={dashboardColors.primary} />
          </View>
        ) : medicineContent === 'error' ? (
          <View accessibilityLiveRegion="polite" style={styles.medicineStatus}>
            <Text selectable style={styles.medicineStatusText}>
              {t('unableLoadReminders')}
            </Text>
            <PressableScale
              accessibilityLabel={t('tryAgain')}
              onPress={retryDashboardLoad}
              style={styles.retryButton}
            >
              <Text style={styles.retryButtonText}>{t('tryAgain')}</Text>
            </PressableScale>
          </View>
        ) : medicineContent === 'empty' ? (
          <EmptyMedicines />
        ) : (
          nearestSession.map((medicine, index) => (
            <MedicineCard
              index={index}
              key={medicine.id}
              medicine={medicine}
            />
          ))
        )}
      </ScrollView>

      <FloatingAddButton
        bottomOffset={addButtonBottomOffset}
        label={t('addMedicine')}
        onPress={() =>
          router.push({ params: { phone }, pathname: '/add-medicine' })
        }
      />

      <BottomNav
        activeTab={activeTab}
        bottomOffset={navBottomOffset}
        onSelectTab={handleSelectTab}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  contentEmpty: {
    flexGrow: 1,
  },
  medicineLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
  },
  medicineStatus: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 180,
    paddingHorizontal: dashboardSpacing.xl,
  },
  medicineStatusText: {
    color: dashboardColors.textMuted,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: dashboardColors.primary,
    borderRadius: 18,
    marginTop: dashboardSpacing.md,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: dashboardSpacing.xl,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
  },
});
