import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { useLanguage } from '../src/lib/i18n';
import {
  formatDateOnly,
  getCalendarCells,
  getCourseEndDate,
  isDateInRange,
  parseDateOnly,
} from '../src/lib/medicineCalendar';
import {
  createCustomHospital,
  createMedicineCourse,
  fetchMedicineCatalogue,
  fetchVerifiedHospitals,
  getNotificationSettings,
  rollbackMedicineCourse,
  saveNotificationIds,
  type MedicineCatalogueItem,
} from '../src/lib/medicineCourses';
import {
  cancelDoseNotifications,
  requestMedicineNotificationPermission,
  scheduleDoseNotifications,
} from '../src/lib/medicineNotifications';
import {
  expandDoseEvents,
  validateMedicineCourseInput,
  type DayPattern,
  type DoseSlot,
} from '../src/lib/medicineSchedule';
import { filterMedicineCatalogue } from '../src/lib/medicineSearch';
import {
  initialMedicineWorkflow,
  medicineWorkflowReducer,
} from '../src/lib/medicineWorkflow';
import { getPatientByPhone } from '../src/lib/patients';
import { normalizeRoutePhone } from '../src/lib/routePhone';

const SLOT_KEYS: DoseSlot[] = ['morning', 'afternoon', 'night'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function todayString() {
  return formatDateOnly(new Date());
}

export default function AddMedicineScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phone = normalizeRoutePhone(params.phone);
  const [workflow, dispatch] = useReducer(
    medicineWorkflowReducer,
    initialMedicineWorkflow,
  );
  const [patientId, setPatientId] = useState('');
  const [hospitals, setHospitals] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [customHospitalName, setCustomHospitalName] = useState('');
  const [isCustomHospital, setIsCustomHospital] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogue, setCatalogue] = useState<MedicineCatalogueItem[]>([]);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);
  const [tablets, setTablets] = useState('1');
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState(todayString());
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [slots, setSlots] = useState<DoseSlot[]>(['morning']);
  const [pattern, setPattern] = useState<DayPattern>('daily');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!phone) {
      Alert.alert(t('patientUnavailable'));
      return;
    }
    void Promise.all([getPatientByPhone(phone), fetchVerifiedHospitals()])
      .then(([patient, nextHospitals]) => {
        if (!patient) throw new Error('Patient unavailable');
        setPatientId(patient.patientId);
        setHospitals(nextHospitals);
      })
      .catch(() => Alert.alert(t('patientUnavailable')));
  }, [phone, t]);

  useEffect(() => {
    if (workflow.step !== 'medicine') {
      return;
    }

    let cancelled = false;
    setCatalogue([]);
    setIsLoadingCatalogue(true);

    void fetchMedicineCatalogue(
      isCustomHospital ? undefined : workflow.hospitalId,
    )
      .then((items) => {
        if (!cancelled) {
          setCatalogue(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogue([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingCatalogue(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isCustomHospital, workflow.hospitalId, workflow.step]);

  const hospitalResults = useMemo(
    () => filterMedicineCatalogue(hospitals, hospitalQuery, 100),
    [hospitalQuery, hospitals],
  );
  const results = useMemo(
    () => filterMedicineCatalogue(catalogue, query, 50),
    [catalogue, query],
  );
  const selectedMedicines = useMemo(
    () =>
      workflow.medicineIds
        .map((id) => catalogue.find((item) => item.id === id))
        .filter((item): item is MedicineCatalogueItem => Boolean(item)),
    [catalogue, workflow.medicineIds],
  );
  const hospitalName = useMemo(
    () =>
      isCustomHospital
        ? customHospitalName
        : hospitals.find((item) => item.id === workflow.hospitalId)?.name ?? '',
    [customHospitalName, hospitals, isCustomHospital, workflow.hospitalId],
  );
  const durationDays = Number(days);
  const endDate = getCourseEndDate(
    startDate,
    Number.isInteger(durationDays) ? durationDays : 1,
  );

  const submit = async () => {
    if (selectedMedicines.length === 0 || !patientId) return;
    const tabletsPerDose = Number(tablets);
    const validation = validateMedicineCourseInput({
      durationDays,
      hospitalId: workflow.hospitalId || customHospitalName,
      medicineId: selectedMedicines[0]!.id,
      slots,
      tabletsPerDose,
    });
    if (validation || !parseDateOnly(startDate)) {
      Alert.alert(t('courseDetails'), t('tryAgain'));
      return;
    }

    setBusy(true);
    const createdCourseIds: string[] = [];
    const scheduledIds: string[] = [];
    try {
      const settings = await getNotificationSettings(patientId);
      const customHospital = isCustomHospital
        ? await createCustomHospital(patientId, customHospitalName)
        : null;
      const drafts = expandDoseEvents({
        dayPattern: pattern,
        durationDays,
        slotTimes: {
          afternoon: settings.afternoonTime,
          morning: settings.morningTime,
          night: settings.nightTime,
        },
        slots,
        startDate,
      });
      const permitted = await requestMedicineNotificationPermission();

      for (const medicine of selectedMedicines) {
        const created = await createMedicineCourse({
          customHospitalId: customHospital?.id,
          dayPattern: pattern,
          durationDays,
          events: drafts,
          hospitalId: isCustomHospital ? undefined : workflow.hospitalId,
          medicineId: medicine.id,
          patientId,
          slots,
          startDate,
          tabletsPerDose,
        });
        createdCourseIds.push(created.courseId);

        if (permitted) {
          const identifiers = [];
          for (const [index, draft] of drafts.entries()) {
            const next = await scheduleDoseNotifications(
              [
                {
                  eventId: created.eventIds[index]!,
                  scheduledFor: draft.scheduledFor,
                },
              ],
              {
                medicineName: medicine.name,
                slot: t(draft.slot),
                tablets: tabletsPerDose,
              },
            );
            identifiers.push(...next);
            scheduledIds.push(...next.map((item) => item.notificationId));
          }
          await saveNotificationIds(identifiers);
        }
      }

      if (!permitted) {
        Alert.alert(t('notifications'), t('phoneAlertsDisabled'), [
          { style: 'cancel', text: t('notNow') },
          {
            onPress: () => void Linking.openSettings(),
            text: t('openSettings'),
          },
        ]);
      }
      setSuccess(true);
      setTimeout(() => {
        router.replace({
          params: { phone, refresh: Date.now() },
          pathname: '/home',
        });
      }, 1400);
    } catch {
      await cancelDoseNotifications(scheduledIds).catch(() => undefined);
      await Promise.all(
        createdCourseIds.map((courseId) =>
          rollbackMedicineCourse(courseId).catch(() => undefined),
        ),
      );
      Alert.alert(t('addMedicine'), t('tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  const toggleSlot = (slot: DoseSlot) =>
    setSlots((current) =>
      current.includes(slot)
        ? current.filter((item) => item !== slot)
        : [...current, slot],
    );

  const selectStartDate = (value: string) => {
    const date = parseDateOnly(value);
    if (!date) return;
    setStartDate(value);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <PressableScale
          onPress={() =>
            workflow.step === 'hospital'
              ? router.back()
              : dispatch({ type: 'back' })
          }
          style={styles.back}
        >
          <Ionicons
            color={dashboardColors.text}
            name="chevron-back"
            size={22}
          />
        </PressableScale>
        <Text style={styles.title}>{t('addMedicine')}</Text>
        <View style={styles.back} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {workflow.step === 'hospital' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.heading}>{t('chooseHospital')}</Text>
              <SearchBox
                accessibilityLabel="Search hospitals"
                onChange={setHospitalQuery}
                onClear={() => setHospitalQuery('')}
                placeholder="Search hospitals"
                value={hospitalQuery}
              />
              <View style={styles.dropdown}>
                {hospitalResults.map((hospital) => (
                  <Choice
                    key={hospital.id}
                    label={hospital.name}
                    onPress={() => {
                      setIsCustomHospital(false);
                      setQuery('');
                      dispatch({
                        hospitalId: hospital.id,
                        type: 'selectHospital',
                      });
                    }}
                  />
                ))}
                {hospitalResults.length === 0 ? (
                  <Text style={styles.emptyResult}>No hospitals found</Text>
                ) : null}
              </View>
              <Text style={styles.orText}>or add another hospital</Text>
              <TextInput
                onChangeText={setCustomHospitalName}
                placeholder={t('hospitalName')}
                placeholderTextColor={dashboardColors.textFaint}
                style={styles.textInput}
                value={customHospitalName}
              />
              <Choice
                disabled={customHospitalName.trim().length < 2}
                label={t('addNewHospital')}
                onPress={() => {
                  setIsCustomHospital(true);
                  setQuery('');
                  dispatch({ hospitalId: 'custom', type: 'selectHospital' });
                }}
              />
            </Animated.View>
          ) : null}

          {workflow.step === 'medicine' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.eyebrow}>{hospitalName}</Text>
              <Text style={styles.heading}>{t('findMedicine')}</Text>
              {selectedMedicines.length > 0 ? (
                <SelectedMedicineStrip medicines={selectedMedicines} />
              ) : null}
              <SearchBox
                accessibilityLabel="Search medicines"
                autoFocus
                onChange={setQuery}
                onClear={() => setQuery('')}
                placeholder={t('searchMedicine')}
                value={query}
              />
              <View style={styles.dropdown}>
                {isLoadingCatalogue ? (
                  <ActivityIndicator
                    color={dashboardColors.primary}
                    style={styles.dropdownLoading}
                  />
                ) : null}
                {!isLoadingCatalogue
                  ? results.map((item) => {
                      const selected = workflow.medicineIds.includes(item.id);
                      return (
                        <PressableScale
                          accessibilityState={{ selected }}
                          key={item.id}
                          onPress={() =>
                            dispatch({
                              medicineId: item.id,
                              type: 'toggleMedicine',
                            })
                          }
                          style={[
                            styles.medicineRow,
                            selected && styles.medicineRowSelected,
                          ]}
                        >
                          <MedicineImage item={item} style={styles.thumb} />
                          <Text numberOfLines={2} style={styles.choiceText}>
                            {item.name}
                          </Text>
                          <Ionicons
                            color={
                              selected
                                ? dashboardColors.primary
                                : dashboardColors.textFaint
                            }
                            name={
                              selected
                                ? 'checkmark-circle'
                                : 'ellipse-outline'
                            }
                            size={24}
                          />
                        </PressableScale>
                      );
                    })
                  : null}
              </View>
              <Primary
                disabled={selectedMedicines.length === 0}
                label={`Continue${
                  selectedMedicines.length
                    ? ` (${selectedMedicines.length} selected)`
                    : ''
                }`}
                onPress={() => dispatch({ type: 'continue' })}
              />
            </Animated.View>
          ) : null}

          {workflow.step === 'details' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.heading}>{t('courseDetails')}</Text>
              <SelectedMedicineStrip medicines={selectedMedicines} />
              <LabelInput
                label={t('tabletsPerDose')}
                onChange={setTablets}
                value={tablets}
              />
              <LabelInput
                label={t('durationDays')}
                onChange={setDays}
                value={days}
              />
              <View>
                <Text style={styles.label}>Start date</Text>
                <PressableScale
                  onPress={() => setCalendarVisible((current) => !current)}
                  style={styles.dateButton}
                >
                  <Ionicons
                    color={dashboardColors.primary}
                    name="calendar-outline"
                    size={22}
                  />
                  <View style={styles.dateButtonCopy}>
                    <Text style={styles.dateButtonValue}>{startDate}</Text>
                    <Text style={styles.dateButtonRange}>
                      Through {endDate}
                    </Text>
                  </View>
                  <Ionicons
                    color={dashboardColors.textFaint}
                    name={calendarVisible ? 'chevron-up' : 'chevron-down'}
                    size={18}
                  />
                </PressableScale>
                {calendarVisible ? (
                  <InlineCalendar
                    durationDays={
                      Number.isInteger(durationDays) ? durationDays : 1
                    }
                    onChangeMonth={setVisibleMonth}
                    onSelect={selectStartDate}
                    selectedDate={startDate}
                    visibleMonth={visibleMonth}
                  />
                ) : null}
              </View>
              <Text style={styles.sectionLabel}>Reminder time</Text>
              <View style={styles.chips}>
                {SLOT_KEYS.map((slot) => (
                  <Chip
                    active={slots.includes(slot)}
                    key={slot}
                    label={t(slot)}
                    onPress={() => toggleSlot(slot)}
                  />
                ))}
              </View>
              <Text style={styles.sectionLabel}>Repeat</Text>
              <View style={styles.chips}>
                <Chip
                  active={pattern === 'daily'}
                  label={t('everyDay')}
                  onPress={() => setPattern('daily')}
                />
                <Chip
                  active={pattern === 'alternate'}
                  label={t('alternateDays')}
                  onPress={() => setPattern('alternate')}
                />
              </View>
              <Primary
                label={t('reviewReminder')}
                onPress={() => dispatch({ type: 'continue' })}
              />
            </Animated.View>
          ) : null}

          {workflow.step === 'review' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.heading}>
                {selectedMedicines.length} medicine
                {selectedMedicines.length === 1 ? '' : 's'}
              </Text>
              <View style={styles.reviewGrid}>
                {selectedMedicines.map((medicine) => (
                  <View key={medicine.id} style={styles.reviewMedicine}>
                    <MedicineImage item={medicine} style={styles.reviewImage} />
                    <Text numberOfLines={2} style={styles.reviewName}>
                      {medicine.name}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.summary}>{hospitalName}</Text>
              <Text style={styles.summary}>
                {days} {t('durationDays').toLowerCase()} · {startDate} to{' '}
                {endDate}
              </Text>
              <Text style={styles.summary}>
                {slots.map((slot) => t(slot)).join(', ')} ·{' '}
                {pattern === 'daily' ? t('everyDay') : t('alternateDays')}
              </Text>
              <Primary
                busy={busy}
                label={t('createReminder')}
                onPress={() => void submit()}
              />
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {success ? (
        <View style={styles.overlay}>
          <Animated.View entering={ZoomIn.springify()} style={styles.success}>
            <Ionicons
              color={dashboardColors.success}
              name="checkmark-circle"
              size={66}
            />
            <Text style={styles.heading}>{t('reminderCreated')}</Text>
            <Text style={styles.summary}>{t('reminderCreatedMessage')}</Text>
          </Animated.View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function SearchBox({
  accessibilityLabel,
  autoFocus,
  onChange,
  onClear,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.searchBox}>
      <Ionicons
        color={dashboardColors.textFaint}
        name="search"
        size={20}
      />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus={autoFocus}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={dashboardColors.textFaint}
        style={styles.searchInput}
        value={value}
      />
      {value ? (
        <PressableScale
          accessibilityLabel={`Clear ${accessibilityLabel.toLowerCase()}`}
          onPress={onClear}
          style={styles.clearSearch}
        >
          <Ionicons
            color={dashboardColors.textFaint}
            name="close-circle"
            size={20}
          />
        </PressableScale>
      ) : null}
    </View>
  );
}

function Choice({
  disabled,
  label,
  onPress,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      disabled={disabled}
      onPress={onPress}
      style={[styles.choice, disabled && styles.disabled]}
    >
      <Ionicons
        color={dashboardColors.primary}
        name="business-outline"
        size={20}
      />
      <Text style={styles.choiceText}>{label}</Text>
      <Ionicons
        color={dashboardColors.textFaint}
        name="chevron-forward"
        size={18}
      />
    </PressableScale>
  );
}

function MedicineImage({
  item,
  style,
}: {
  item: MedicineCatalogueItem;
  style: object;
}) {
  return item.imageUrl ? (
    <Image
      accessibilityLabel={item.name}
      contentFit="cover"
      source={{ uri: item.imageUrl }}
      style={style}
      transition={120}
    />
  ) : (
    <View style={[style, styles.imageFallback]}>
      <Ionicons
        color={dashboardColors.primary}
        name="medical"
        size={22}
      />
    </View>
  );
}

function SelectedMedicineStrip({
  medicines,
}: {
  medicines: MedicineCatalogueItem[];
}) {
  return (
    <ScrollView
      contentContainerStyle={styles.selectedStrip}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {medicines.map((medicine) => (
        <View key={medicine.id} style={styles.selectedItem}>
          <MedicineImage item={medicine} style={styles.selectedThumb} />
          <Text numberOfLines={1} style={styles.selectedName}>
            {medicine.name}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

function InlineCalendar({
  durationDays,
  onChangeMonth,
  onSelect,
  selectedDate,
  visibleMonth,
}: {
  durationDays: number;
  onChangeMonth: (date: Date) => void;
  onSelect: (date: string) => void;
  selectedDate: string;
  visibleMonth: Date;
}) {
  const cells = getCalendarCells(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth(),
  );
  const moveMonth = (offset: number) =>
    onChangeMonth(
      new Date(
        visibleMonth.getFullYear(),
        visibleMonth.getMonth() + offset,
        1,
      ),
    );

  return (
    <View style={styles.calendar}>
      <View style={styles.calendarHeader}>
        <PressableScale
          accessibilityLabel="Previous month"
          onPress={() => moveMonth(-1)}
          style={styles.calendarArrow}
        >
          <Ionicons
            color={dashboardColors.text}
            name="chevron-back"
            size={18}
          />
        </PressableScale>
        <Text style={styles.calendarTitle}>
          {MONTHS[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
        </Text>
        <PressableScale
          accessibilityLabel="Next month"
          onPress={() => moveMonth(1)}
          style={styles.calendarArrow}
        >
          <Ionicons
            color={dashboardColors.text}
            name="chevron-forward"
            size={18}
          />
        </PressableScale>
      </View>
      <View style={styles.calendarGrid}>
        {WEEKDAYS.map((weekday, index) => (
          <Text key={`${weekday}-${index}`} style={styles.weekdayLabel}>
            {weekday}
          </Text>
        ))}
        {cells.map((cell) => {
          const inRange = isDateInRange(
            cell.date,
            selectedDate,
            durationDays,
          );
          const isStart = cell.date === selectedDate;
          return (
            <PressableScale
              accessibilityLabel={cell.date}
              accessibilityState={{ selected: isStart }}
              key={cell.date}
              onPress={() => onSelect(cell.date)}
              style={[
                styles.calendarDay,
                inRange && styles.calendarDayInRange,
                isStart && styles.calendarDayStart,
              ]}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  !cell.inMonth && styles.calendarDayOutside,
                  inRange && styles.calendarDayTextInRange,
                  isStart && styles.calendarDayTextStart,
                ]}
              >
                {cell.day}
              </Text>
            </PressableScale>
          );
        })}
      </View>
      <Text style={styles.calendarRange}>
        {selectedDate} – {getCourseEndDate(selectedDate, durationDays)}
      </Text>
    </View>
  );
}

function Chip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </PressableScale>
  );
}

function LabelInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={onChange}
        style={styles.textInput}
        value={value}
      />
    </View>
  );
}

function Primary({
  busy,
  disabled,
  label,
  onPress,
}: {
  busy?: boolean;
  disabled?: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      disabled={busy || disabled}
      onPress={onPress}
      style={[styles.primary, disabled && styles.primaryDisabled]}
    >
      {busy ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.primaryText}>{label}</Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: dashboardColors.bg, flex: 1 },
  flex: { flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: 10,
  },
  back: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: { ...dashboardTypography.title, color: dashboardColors.text },
  content: { padding: dashboardSpacing.pagePadding, paddingBottom: 48 },
  stack: { gap: dashboardSpacing.md },
  heading: {
    ...dashboardTypography.title,
    color: dashboardColors.text,
    textAlign: 'center',
  },
  eyebrow: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    textAlign: 'center',
  },
  orText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    textAlign: 'center',
  },
  textInput: {
    ...dashboardTypography.body,
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 16,
    borderWidth: 1,
    color: dashboardColors.text,
    padding: 15,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.primary,
    borderRadius: 16,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
  },
  searchInput: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    flex: 1,
    paddingVertical: 15,
  },
  clearSearch: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  dropdown: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 18,
    borderWidth: 1,
    maxHeight: 390,
    overflow: 'hidden',
  },
  dropdownLoading: { paddingVertical: 24 },
  emptyResult: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    padding: 20,
    textAlign: 'center',
  },
  choice: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 15,
  },
  choiceText: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    flex: 1,
  },
  disabled: { opacity: 0.45 },
  medicineRow: {
    alignItems: 'center',
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 10,
  },
  medicineRowSelected: { backgroundColor: dashboardColors.primaryTint },
  thumb: { borderRadius: 12, height: 58, width: 68 },
  imageFallback: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    justifyContent: 'center',
  },
  selectedStrip: { gap: 10, paddingVertical: 2 },
  selectedItem: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 14,
    borderWidth: 1,
    padding: 6,
    width: 92,
  },
  selectedThumb: { borderRadius: 10, height: 58, width: '100%' },
  selectedName: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    marginTop: 5,
  },
  label: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginBottom: 5,
  },
  sectionLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    marginTop: 2,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  dateButtonCopy: { flex: 1 },
  dateButtonValue: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
  },
  dateButtonRange: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  calendar: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 8,
    padding: 12,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  calendarArrow: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  calendarTitle: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekdayLabel: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    paddingVertical: 5,
    textAlign: 'center',
    width: '14.2857%',
  },
  calendarDay: {
    alignItems: 'center',
    borderRadius: 9,
    height: 36,
    justifyContent: 'center',
    width: '14.2857%',
  },
  calendarDayInRange: { backgroundColor: dashboardColors.primaryTint },
  calendarDayStart: { backgroundColor: dashboardColors.primary },
  calendarDayText: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
  },
  calendarDayOutside: { color: dashboardColors.textFaint, opacity: 0.45 },
  calendarDayTextInRange: { color: dashboardColors.primaryDark },
  calendarDayTextStart: { color: '#FFFFFF' },
  calendarRange: {
    ...dashboardTypography.caption,
    color: dashboardColors.primaryDark,
    marginTop: 8,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: dashboardColors.primaryTint,
    borderColor: dashboardColors.primary,
  },
  chipText: { ...dashboardTypography.caption, color: dashboardColors.text },
  chipTextActive: {
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_700Bold',
  },
  reviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  reviewMedicine: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: '47%',
  },
  reviewImage: { height: 105, width: '100%' },
  reviewName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    minHeight: 50,
    padding: 9,
  },
  primary: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    marginTop: 8,
    padding: 16,
  },
  primaryDisabled: { opacity: 0.4 },
  primaryText: { ...dashboardTypography.button, color: '#fff' },
  summary: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    textAlign: 'center',
  },
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(15,23,42,0.45)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  success: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 28,
    gap: 12,
    margin: 28,
    padding: 28,
  },
});
