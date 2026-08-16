import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { BottomNav, type NavTabKey } from '../src/components/dashboard/BottomNav';
import { WeekCalendar } from '../src/components/camps/WeekCalendar';
import { HospitalLogo } from '../src/components/HospitalLogo';
import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import {
  fetchRegisteredEventIds,
  fetchUpcomingHospitalEvents,
  registerForHospitalEvent,
  unregisterFromHospitalEvent,
  type HospitalEvent,
  type HospitalEventType,
} from '../src/data/hospitalEvents';
import { getTabRoute } from '../src/lib/dashboardNav';
import { dateKey, formatShortWeekdayDate, isSameDay, startOfWeek } from '../src/lib/dates';
import { useLanguage, type TranslationKey } from '../src/lib/i18n';
import { getPatientByPhone } from '../src/lib/patients';

const EVENT_TYPE_THEME: Record<
  HospitalEventType,
  { color: string; icon: keyof typeof Ionicons.glyphMap; labelKey: TranslationKey; tint: string }
> = {
  dental: {
    color: '#DB6B4B',
    icon: 'happy-outline',
    labelKey: 'campDental',
    tint: '#FBEBE5',
  },
  medical: {
    color: dashboardColors.primary,
    icon: 'medkit-outline',
    labelKey: 'campMedical',
    tint: dashboardColors.primaryTint,
  },
  other: {
    color: dashboardColors.success,
    icon: 'heart-outline',
    labelKey: 'campOther',
    tint: dashboardColors.successTint,
  },
};

function formatTimeRange(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const format = (value: string) => {
    const [h, m] = value.split(':').map(Number) as [number, number];
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
  };
  return end ? `${format(start)} – ${format(end)}` : format(start);
}

export default function CampsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const [activeTab, setActiveTab] = useState<NavTabKey>('camps');
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [events, setEvents] = useState<HospitalEvent[]>([]);
  const [registeredIds, setRegisteredIds] = useState<Set<string>>(new Set());
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [patient, setPatient] = useState<{ patientId: string; name: string } | null>(null);

  const load = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    Promise.all([fetchUpcomingHospitalEvents(), fetchRegisteredEventIds()])
      .then(([eventList, registered]) => {
        setEvents(eventList);
        setRegisteredIds(registered);
      })
      .catch(() => setErrorMessage('unableLoadDocuments'))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(load, [load]);

  useEffect(() => {
    if (!phone) return;
    getPatientByPhone(phone)
      .then((result) => {
        if (result) setPatient({ name: result.name, patientId: result.patientId });
      })
      .catch(() => undefined);
  }, [phone]);

  const eventsWithDate = useMemo(
    () =>
      events.map((event) => {
        const [y, m, d] = event.eventDate.split('-').map(Number) as [number, number, number];
        return { date: new Date(y, m - 1, d), event };
      }),
    [events],
  );

  const weekEnd = useMemo(() => {
    const end = new Date(weekStart);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
  }, [weekStart]);

  const eventDateKeys = useMemo(
    () =>
      new Set(
        eventsWithDate
          .filter(({ date }) => date >= weekStart && date <= weekEnd)
          .map(({ date }) => dateKey(date)),
      ),
    [eventsWithDate, weekStart, weekEnd],
  );

  const visibleEvents = useMemo(
    () =>
      eventsWithDate
        .filter(({ date }) => {
          if (selectedDate) return isSameDay(date, selectedDate);
          return date >= weekStart && date <= weekEnd;
        })
        .map(({ event }) => event),
    [eventsWithDate, selectedDate, weekStart, weekEnd],
  );

  const navBottomOffset = insets.bottom + dashboardLayout.navBottomGap;
  const scrollBottomPadding = navBottomOffset + dashboardLayout.bottomNavHeight + dashboardSpacing.xl;

  const handleSelectTab = (tab: NavTabKey) => {
    if (tab === activeTab) return;
    const route = getTabRoute(tab);
    if (!route) return;
    setActiveTab(tab);
    router.replace({ params: { phone }, pathname: route });
  };

  const handleRegister = async (event: HospitalEvent) => {
    if (registeredIds.has(event.id) || registeringId) return;
    setRegisteringId(event.id);
    try {
      await registerForHospitalEvent({
        eventId: event.id,
        mobile: phone,
        name: patient?.name,
        patientId: patient?.patientId,
      });
      setRegisteredIds((current) => new Set(current).add(event.id));
    } catch {
      setErrorMessage('campRegisterFailed');
    } finally {
      setRegisteringId(null);
    }
  };

  const handleUnregister = async (event: HospitalEvent) => {
    if (registeringId) return;
    setRegisteringId(event.id);
    try {
      await unregisterFromHospitalEvent(event.id);
      setRegisteredIds((current) => {
        const next = new Set(current);
        next.delete(event.id);
        return next;
      });
    } catch {
      setErrorMessage('campRegisterFailed');
    } finally {
      setRegisteringId(null);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('campsTitle')}</Text>
        <Text style={styles.headerSubtitle}>{t('campsSubtitle')}</Text>
      </View>

      <View style={styles.timelineWrap}>
        <WeekCalendar
          eventDateKeys={eventDateKeys}
          onSelectDate={setSelectedDate}
          onSelectWeekStart={setWeekStart}
          selectedDate={selectedDate}
          weekStart={weekStart}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={dashboardColors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          {errorMessage ? <Text style={styles.errorText}>{t(errorMessage as TranslationKey)}</Text> : null}

          {visibleEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons color={dashboardColors.textFaint} name="calendar-outline" size={30} />
              <Text style={styles.emptyText}>{t('campsEmpty')}</Text>
            </View>
          ) : (
            visibleEvents.map((event) => {
              const theme = EVENT_TYPE_THEME[event.eventType];
              const timeRange = formatTimeRange(event.startTime, event.endTime);
              const isRegistered = registeredIds.has(event.id);
              const isBusy = registeringId === event.id;
              const [y, m, d] = event.eventDate.split('-').map(Number) as [number, number, number];
              const eventDateLabel = formatShortWeekdayDate(new Date(y, m - 1, d));
              return (
                <View key={event.id} style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <HospitalLogo hospitalName={event.hospitalName} roundedSquare size={40} />
                    <View style={styles.cardTopText}>
                      <Text style={styles.hospitalName} numberOfLines={1}>
                        {event.hospitalName}
                      </Text>
                      {event.doctorName ? (
                        <Text style={styles.doctorName} numberOfLines={1}>
                          {event.doctorName}
                        </Text>
                      ) : null}
                    </View>
                    <View style={[styles.badge, { backgroundColor: theme.tint }]}>
                      <Ionicons color={theme.color} name={theme.icon} size={13} />
                      <Text style={[styles.badgeText, { color: theme.color }]}>{t(theme.labelKey)}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardTitle}>{event.title}</Text>
                  {event.description ? <Text style={styles.cardDescription}>{event.description}</Text> : null}

                  <View style={styles.cardMetaRow}>
                    <View style={styles.metaItem}>
                      <Ionicons color={dashboardColors.textMuted} name="calendar-outline" size={14} />
                      <Text style={styles.metaText}>{eventDateLabel}</Text>
                    </View>
                    {timeRange ? (
                      <View style={styles.metaItem}>
                        <Ionicons color={dashboardColors.textMuted} name="time-outline" size={14} />
                        <Text style={styles.metaText}>{timeRange}</Text>
                      </View>
                    ) : null}
                    {event.location ? (
                      <View style={styles.metaItem}>
                        <Ionicons color={dashboardColors.textMuted} name="location-outline" size={14} />
                        <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
                      </View>
                    ) : null}
                  </View>

                  {isRegistered ? (
                    <View style={styles.bookedPill}>
                      <View style={styles.bookedSegment}>
                        <Ionicons color={dashboardColors.text} name="checkmark-circle" size={16} />
                        <Text style={styles.bookedSegmentText}>{t('campRegistered')}</Text>
                      </View>
                      <PressableScale
                        disabled={isBusy}
                        onPress={() => void handleUnregister(event)}
                        style={styles.shiftSegment}
                      >
                        {isBusy ? (
                          <ActivityIndicator color={dashboardColors.textMuted} size="small" />
                        ) : (
                          <Text style={styles.shiftSegmentText}>{t('campShift')}</Text>
                        )}
                      </PressableScale>
                    </View>
                  ) : (
                    <PressableScale
                      disabled={isBusy}
                      onPress={() => void handleRegister(event)}
                      style={styles.registerButton}
                    >
                      {isBusy ? (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      ) : (
                        <>
                          <Ionicons color="#FFFFFF" name="calendar-outline" size={16} />
                          <Text style={styles.registerButtonText}>{t('campRegister')}</Text>
                        </>
                      )}
                    </PressableScale>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}

      <BottomNav activeTab={activeTab} bottomOffset={navBottomOffset} onSelectTab={handleSelectTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    marginBottom: dashboardSpacing.gap,
    padding: dashboardSpacing.gap,
  },
  cardDescription: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginBottom: dashboardSpacing.md,
  },
  cardMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: dashboardSpacing.md,
    marginBottom: dashboardSpacing.gap,
  },
  cardTitle: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    marginBottom: 4,
  },
  cardTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    marginBottom: dashboardSpacing.md,
  },
  cardTopText: { flex: 1 },
  centerState: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.md,
  },
  doctorName: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    gap: dashboardSpacing.sm,
    paddingTop: dashboardSpacing.xxl * 2,
  },
  emptyText: {
    ...dashboardTypography.body,
    color: dashboardColors.textFaint,
    textAlign: 'center',
  },
  errorText: {
    ...dashboardTypography.body,
    color: dashboardColors.error,
    marginBottom: dashboardSpacing.md,
  },
  header: {
    paddingBottom: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.sm,
  },
  headerSubtitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  headerTitle: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
  },
  hospitalName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 15,
  },
  metaItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  metaText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  registerButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    gap: 6,
    height: 44,
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  bookedPill: {
    backgroundColor: dashboardColors.bg,
    borderRadius: dashboardRadii.button,
    flexDirection: 'row',
    height: 44,
    padding: 4,
  },
  bookedSegment: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.button - 4,
    boxShadow: '0 1px 3px rgba(15,23,42,0.10)',
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  bookedSegmentText: {
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  shiftSegment: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  shiftSegmentText: {
    color: dashboardColors.textMuted,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  safeArea: {
    backgroundColor: dashboardColors.bg,
    flex: 1,
  },
  timelineWrap: {
    paddingBottom: dashboardSpacing.md,
    paddingHorizontal: dashboardSpacing.pagePadding,
  },
});
