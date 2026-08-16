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
import { DateTimeline } from '../src/components/dashboard/DateTimeline';
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
  type HospitalEvent,
  type HospitalEventType,
} from '../src/data/hospitalEvents';
import { getTabRoute } from '../src/lib/dashboardNav';
import { isSameDay } from '../src/lib/dates';
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
  const [selectedDate, setSelectedDate] = useState(() => new Date());
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

  const eventsForSelectedDate = useMemo(
    () =>
      events.filter((event) => {
        const [y, m, d] = event.eventDate.split('-').map(Number);
        return isSameDay(new Date(y!, m! - 1, d!), selectedDate);
      }),
    [events, selectedDate],
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

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('campsTitle')}</Text>
        <Text style={styles.headerSubtitle}>{t('campsSubtitle')}</Text>
      </View>

      <View style={styles.timelineWrap}>
        <DateTimeline onSelectDate={setSelectedDate} selectedDate={selectedDate} />
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

          {eventsForSelectedDate.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons color={dashboardColors.textFaint} name="calendar-outline" size={30} />
              <Text style={styles.emptyText}>{t('campsEmpty')}</Text>
            </View>
          ) : (
            eventsForSelectedDate.map((event) => {
              const theme = EVENT_TYPE_THEME[event.eventType];
              const timeRange = formatTimeRange(event.startTime, event.endTime);
              const isRegistered = registeredIds.has(event.id);
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

                  <PressableScale
                    disabled={isRegistered || registeringId === event.id}
                    onPress={() => void handleRegister(event)}
                    style={[styles.registerButton, isRegistered && styles.registerButtonDone]}
                  >
                    {registeringId === event.id ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <>
                        <Ionicons
                          color="#FFFFFF"
                          name={isRegistered ? 'checkmark-circle' : 'calendar-outline'}
                          size={16}
                        />
                        <Text style={styles.registerButtonText}>
                          {isRegistered ? t('campRegistered') : t('campRegister')}
                        </Text>
                      </>
                    )}
                  </PressableScale>
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
  registerButtonDone: {
    backgroundColor: dashboardColors.success,
  },
  registerButtonText: {
    color: '#FFFFFF',
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
