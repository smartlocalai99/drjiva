import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInRight,
  LinearTransition,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, type DateData } from 'react-native-calendars';

const MEDICINE_PLACEHOLDER = require('../assets/notabs.png');

import {
  deleteMedicineReminder,
  fetchMedicinesForDate,
  fetchReminderDatesInRange,
  type Medicine,
} from '../src/data/medicines';
import { DoctorAvatar } from '../src/components/DoctorAvatar';
import { HospitalLogo } from '../src/components/HospitalLogo';
import { CourseStreakRow } from '../src/components/course-streak-row';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { DOSE_SLOT_THEME } from '../src/lib/doseSlotTheme';
import { useLanguage } from '../src/lib/i18n';
import { formatDateOnly } from '../src/lib/medicineCalendar';
import { getPatientByPhone } from '../src/lib/patients';

export default function RemindersScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const [patientId, setPatientId] = useState<string>();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => new Date());
  const [markedDateSet, setMarkedDateSet] = useState<Set<string>>(new Set());
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [deletingCourseId, setDeletingCourseId] = useState<string>();

  const reload = useCallback(
    async (date: Date) => {
      setErrorMessage(undefined);
      try {
        const patient = await getPatientByPhone(phone);
        if (!patient) {
          throw new Error('Patient unavailable');
        }
        setPatientId(patient.patientId);
        setMedicines(
          await fetchMedicinesForDate(patient.patientId, date),
        );
      } catch {
        setErrorMessage(t('unableLoadReminders'));
      } finally {
        setIsLoading(false);
      }
    },
    [phone, t],
  );

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void reload(selectedDate);
    }, [reload, selectedDate]),
  );

  useEffect(() => {
    if (!patientId) {
      return;
    }
    let cancelled = false;
    const monthStart = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth(),
      1,
    );
    const monthEnd = new Date(
      visibleMonth.getFullYear(),
      visibleMonth.getMonth() + 1,
      1,
    );
    void fetchReminderDatesInRange(patientId, monthStart, monthEnd)
      .then((dates) => {
        if (!cancelled) {
          setMarkedDateSet(dates);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [patientId, visibleMonth]);

  const handleSelectDate = (day: DateData) => {
    setSelectedDate(new Date(day.year, day.month - 1, day.day));
  };

  const handleVisibleMonthChange = (month: DateData) => {
    setVisibleMonth(new Date(month.year, month.month - 1, 1));
  };

  const markedDates = Object.fromEntries([
    ...[...markedDateSet].map((date) => [
      date,
      { dotColor: dashboardColors.primary, marked: true },
    ]),
    [
      formatDateOnly(selectedDate),
      {
        dotColor: '#FFFFFF',
        marked: markedDateSet.has(formatDateOnly(selectedDate)),
        selected: true,
        selectedColor: dashboardColors.primary,
      },
    ],
  ]);

  const confirmDelete = (medicine: Medicine) => {
    Alert.alert(t('deleteReminder'), t('deleteReminderMessage'), [
      { style: 'cancel', text: t('cancel') },
      {
        onPress: () => {
          setDeletingCourseId(medicine.courseId);
          void deleteMedicineReminder(medicine.courseId)
            .then(() => {
              setMedicines((current) =>
                current.filter((item) => item.courseId !== medicine.courseId),
              );
            })
            .catch(() =>
              Alert.alert(
                t('unableDeleteReminder'),
                t('unableDeleteReminderMessage'),
              ),
            )
            .finally(() => setDeletingCourseId(undefined));
        },
        style: 'destructive',
        text: t('delete'),
      },
    ]);
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
        <Text style={styles.headerTitle}>{t('reminders')}</Text>
        <View style={styles.headerSide} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarWrap}>
          <Calendar
            current={formatDateOnly(visibleMonth)}
            enableSwipeMonths
            markedDates={markedDates}
            onDayPress={handleSelectDate}
            onMonthChange={handleVisibleMonthChange}
            style={styles.calendar}
            theme={{
              arrowColor: dashboardColors.primary,
              calendarBackground: dashboardColors.card,
              dayTextColor: dashboardColors.text,
              monthTextColor: dashboardColors.text,
              selectedDayBackgroundColor: dashboardColors.primary,
              selectedDayTextColor: '#FFFFFF',
              textDayFontFamily: 'Inter_500Medium',
              textDayHeaderFontFamily: 'Inter_600SemiBold',
              textDisabledColor: dashboardColors.textFaint,
              textMonthFontFamily: 'Inter_700Bold',
              textSectionTitleColor: dashboardColors.textMuted,
              todayTextColor: dashboardColors.primary,
            }}
          />
        </View>

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={dashboardColors.primary} />
          </View>
        ) : errorMessage ? (
          <View style={styles.centered}>
            <Ionicons
              color={dashboardColors.error}
              name="cloud-offline-outline"
              size={38}
            />
            <Text style={styles.emptyTitle}>{errorMessage}</Text>
            <Pressable
              onPress={() => void reload(selectedDate)}
              style={styles.retry}
            >
              <Text style={styles.retryText}>{t('tryAgain')}</Text>
            </Pressable>
          </View>
        ) : medicines.length === 0 ? (
          <View style={styles.centered}>
            <View style={styles.emptyIcon}>
              <Ionicons
                color={dashboardColors.primary}
                name="alarm-outline"
                size={40}
              />
            </View>
            <Text style={styles.emptyTitle}>{t('noRemindersForDate')}</Text>
            <Text style={styles.emptySubtitle}>{t('noRemindersSubtitle')}</Text>
          </View>
        ) : (
          <View style={styles.content}>
            {medicines.map((medicine, index) => (
              <ReminderCard
                deleting={deletingCourseId === medicine.courseId}
                index={index}
                key={medicine.id}
                medicine={medicine}
                onDelete={() => confirmDelete(medicine)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ReminderCard({
  deleting,
  index,
  medicine,
  onDelete,
}: {
  deleting: boolean;
  index: number;
  medicine: Medicine;
  onDelete: () => void;
}) {
  const slotTheme = DOSE_SLOT_THEME[medicine.slot];
  const courseDuration =
    medicine.scheduleMode === 'ongoing'
      ? 'Ongoing course'
      : medicine.durationDays && medicine.durationDays > 0
        ? `${medicine.durationDays}-day course`
        : 'Course duration unavailable';

  return (
    <Animated.View
      entering={FadeInRight.delay(Math.min(index, 6) * 45).duration(260)}
      layout={LinearTransition.duration(220)}
      style={styles.card}
    >
      <View style={[styles.cardBody, { backgroundColor: slotTheme.tint }]}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} selectable style={styles.cardName}>
            {medicine.name}
          </Text>

          <View
            style={[styles.slotBadge, { backgroundColor: slotTheme.tint }]}
          >
            <Ionicons color={slotTheme.accent} name={slotTheme.icon} size={15} />
            <View style={styles.slotBadgeCopy}>
              <Text
                numberOfLines={1}
                style={[styles.slotBadgeTitle, { color: slotTheme.accent }]}
              >
                {medicine.timing}
              </Text>
              <Text
                numberOfLines={1}
                selectable
                style={[styles.slotBadgeTime, { color: slotTheme.accent }]}
              >
                {medicine.nextReminderTime}
              </Text>
            </View>
          </View>

          <Pressable
            accessibilityLabel={`Delete ${medicine.name} reminder`}
            disabled={deleting}
            hitSlop={8}
            onPress={onDelete}
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
            ]}
          >
            {deleting ? (
              <ActivityIndicator color={dashboardColors.error} size="small" />
            ) : (
              <Ionicons
                color={dashboardColors.error}
                name="trash-outline"
                size={15}
              />
            )}
          </Pressable>
        </View>

        <Text numberOfLines={1} selectable style={styles.metaSummary}>
          {medicine.tabletCount} · {medicine.description} · {courseDuration}
        </Text>
      </View>

      <View style={[styles.imageWrap, { backgroundColor: slotTheme.tint }]}>
        <Image
          accessibilityLabel={medicine.name}
          cachePolicy="memory-disk"
          contentFit="contain"
          recyclingKey={medicine.id}
          source={
            medicine.imageUrl
              ? { uri: medicine.imageUrl }
              : MEDICINE_PLACEHOLDER
          }
          style={styles.cardImage}
          transition={120}
        />

        {medicine.completed ? (
          <View style={styles.completedBadge}>
            <Ionicons color="#FFFFFF" name="checkmark" size={12} />
            <Text style={styles.completedBadgeText}>Taken</Text>
          </View>
        ) : null}
      </View>

      <CourseStreakRow
        accentColor={slotTheme.accent}
        backgroundColor={slotTheme.tint}
        days={medicine.streakDays}
        ongoing={medicine.scheduleMode === 'ongoing'}
      />

      <View style={[styles.peopleRow, { backgroundColor: slotTheme.tint }]}>
        <View style={styles.hospitalGroup}>
          <HospitalLogo hospitalName={medicine.hospitalName} size={44} />
          <Text numberOfLines={2} selectable style={styles.hospitalName}>
            {medicine.hospitalName}
          </Text>
        </View>
        <DoctorAvatar size={48} />
      </View>
    </Animated.View>
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
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  calendarWrap: {
    paddingBottom: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
  calendar: {
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    paddingBottom: 6,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: dashboardSpacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: dashboardSpacing.xxl,
  },
  content: {
    gap: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 36,
    height: 72,
    justifyContent: 'center',
    marginBottom: dashboardSpacing.gap,
    width: 72,
  },
  emptyTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    marginTop: dashboardSpacing.md,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginTop: dashboardSpacing.sm,
    textAlign: 'center',
  },
  retry: {
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    marginTop: dashboardSpacing.gap,
    paddingHorizontal: dashboardSpacing.xl,
    paddingVertical: dashboardSpacing.md,
  },
  retryText: {
    ...dashboardTypography.button,
    color: '#FFFFFF',
  },
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: 0,
    marginHorizontal: -dashboardSpacing.pagePadding,
    overflow: 'hidden',
  },
  imageWrap: {
    alignItems: 'center',
    height: 260,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  cardImage: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.errorTint,
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  deleteButtonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.94 }],
  },
  completedBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.success,
    borderRadius: dashboardRadii.pill,
    bottom: 10,
    flexDirection: 'row',
    gap: 4,
    left: dashboardSpacing.pagePadding,
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: 'absolute',
  },
  completedBadgeText: {
    ...dashboardTypography.caption,
    color: '#FFFFFF',
    fontSize: 11,
  },
  cardBody: {
    backgroundColor: dashboardColors.card,
    gap: 4,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: 8,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cardName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
  },
  metaSummary: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  slotBadge: {
    alignItems: 'center',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '40%',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  slotBadgeCopy: {
    flexShrink: 1,
  },
  slotBadgeTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 17,
  },
  slotBadgeTime: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    lineHeight: 15,
  },
  peopleRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: 12,
  },
  hospitalGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingRight: dashboardSpacing.sm,
  },
  hospitalName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flexShrink: 1,
    fontSize: 14,
  },
});
