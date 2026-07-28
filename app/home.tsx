import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { DailyProgress } from '../src/components/dashboard/DailyProgress';
import { DashboardHeader } from '../src/components/dashboard/DashboardHeader';
import { DateTimeline } from '../src/components/dashboard/DateTimeline';
import { EmptyMedicines } from '../src/components/dashboard/EmptyMedicines';
import { FloatingAddButton } from '../src/components/dashboard/FloatingAddButton';
import { MedicineCard } from '../src/components/dashboard/MedicineCard';
import {
  completeDoseEvent,
  deleteMedicineReminder,
  fetchMedicinesForDate,
  type Medicine,
} from '../src/data/medicines';
import {
  dashboardColors,
  dashboardLayout,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { getGreeting, isSameDay } from '../src/lib/dates';
import { getTabRoute } from '../src/lib/dashboardNav';
import { useLanguage } from '../src/lib/i18n';
import { getInitialTimelineDate } from '../src/lib/medicineCalendar';
import { getPatientByPhone } from '../src/lib/patients';
import {
  getCachedPatientName,
  saveCachedPatientName,
} from '../src/lib/session';

export default function HomeScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{
    phone?: string | string[];
    selectedDate?: string | string[];
  }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);
  const selectedDateParam = Array.isArray(params.selectedDate)
    ? params.selectedDate[0]
    : params.selectedDate;

  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const [selectedDate, setSelectedDate] = useState(() =>
    getInitialTimelineDate(selectedDateParam, today),
  );
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTabKey>('today');
  const [refreshing, setRefreshing] = useState(false);
  const [patientName, setPatientName] = useState<string | undefined>();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [deletingCourseId, setDeletingCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (!phone) {
      return;
    }

    let cancelled = false;

    const loadPatientName = async () => {
      const cachedName = await getCachedPatientName(phone).catch(() => null);
      if (!cancelled && cachedName) {
        setPatientName(cachedName);
      }

      try {
        const patient = await getPatientByPhone(phone);
        if (!cancelled && patient) {
          setPatientId(patient.patientId);
          setPatientName(patient.name);
          void saveCachedPatientName(phone, patient.name).catch(
            () => undefined,
          );
        }
      } catch {
        // Keep the cached value when the background refresh is unavailable.
      }
    };

    void loadPatientName();

    return () => {
      cancelled = true;
    };
  }, [phone]);

  const loadMedicines = useCallback(async (date: Date) => {
    if (!patientId) {
      setIsLoadingMedicines(false);
      return;
    }
    setIsLoadingMedicines(true);
    try {
      const nextMedicines = await fetchMedicinesForDate(patientId, date);
      setMedicines(nextMedicines);
    } catch {
      setMedicines([]);
    } finally {
      setIsLoadingMedicines(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadMedicines(selectedDate);
  }, [loadMedicines, selectedDate]);

  useEffect(() => {
    setSelectedDate(getInitialTimelineDate(selectedDateParam, today));
  }, [selectedDateParam, today]);

  const completedCount = medicines.filter((medicine) => medicine.completed).length;

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
  };

  const handleToggleMedicine = async (id: string) => {
    const medicine = medicines.find((item) => item.id === id);
    if (!medicine) return;
    try {
      await completeDoseEvent(id, !medicine.completed);
      setMedicines((current) =>
        current.map((item) =>
          item.id === id ? { ...item, completed: !item.completed } : item,
        ),
      );
    } catch {
      Alert.alert(t('addMedicine'), t('tryAgain'));
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadMedicines(selectedDate);
    setRefreshing(false);
  };

  const handleDeleteMedicine = (medicine: Medicine) => {
    Alert.alert(t('deleteReminder'), t('deleteReminderMessage'), [
      { style: 'cancel', text: t('cancel') },
      {
        onPress: () => {
          setDeletingCourseId(medicine.courseId);
          void deleteMedicineReminder(medicine.courseId)
            .then(() => {
              setMedicines((current) =>
                current.filter(
                  (item) => item.courseId !== medicine.courseId,
                ),
              );
            })
            .catch(() =>
              Alert.alert(
                t('unableDeleteReminder'),
                t('unableDeleteReminderMessage'),
              ),
            )
            .finally(() => setDeletingCourseId(null));
        },
        style: 'destructive',
        text: t('delete'),
      },
    ]);
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
    router.replace({ params: { phone }, pathname: route });
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
          medicines.length === 0 && styles.contentEmpty,
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
          greeting={getGreeting(today)}
          hasNotifications={false}
          name={patientName}
          onPressNotifications={() =>
            Alert.alert('Notifications', 'No new notifications yet.')
          }
        />

        <View style={styles.timeline}>
          <DateTimeline onSelectDate={handleSelectDate} selectedDate={selectedDate} />
        </View>

        <DailyProgress
          completed={completedCount}
          isToday={isSameDay(selectedDate, today)}
          total={medicines.length}
        />

        <Text style={styles.sectionTitle}>{t('today')}</Text>

        {isLoadingMedicines ? (
          <View style={styles.medicineLoading}>
            <ActivityIndicator color={dashboardColors.primary} />
          </View>
        ) : medicines.length === 0 ? (
          <EmptyMedicines />
        ) : (
          medicines.map((medicine, index) => (
            <MedicineCard
              index={index}
              key={medicine.id}
              medicine={medicine}
              deleting={deletingCourseId === medicine.courseId}
              onDelete={() => handleDeleteMedicine(medicine)}
              onToggle={() => void handleToggleMedicine(medicine.id)}
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
  timeline: {
    marginTop: dashboardSpacing.md,
  },
  sectionTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    marginBottom: dashboardSpacing.gap,
    marginTop: dashboardSpacing.xl,
  },
  medicineLoading: {
    alignItems: 'center',
    minHeight: 150,
    paddingTop: dashboardSpacing.xl,
  },
});
