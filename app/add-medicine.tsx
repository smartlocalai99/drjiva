import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
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
import { CourseStartDatePicker } from '../src/components/medicine/course-start-date-picker';
import { CustomMedicineSheet } from '../src/components/medicine/CustomMedicineSheet';
import {
  DurationPicker,
  durationLabel,
} from '../src/components/medicine/DurationPicker';
import { SlotTimeEditor } from '../src/components/medicine/SlotTimeEditor';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { useLanguage } from '../src/lib/i18n';
import {
  createCustomMedicine,
  loadCustomMedicines,
} from '../src/lib/customMedicines';
import {
  formatDateOnly,
  getCourseEndDate,
  parseDateOnly,
} from '../src/lib/medicineCalendar';
import {
  createCustomHospital,
  createMedicineCourse,
  fetchMedicineCatalogue,
  fetchPatientCustomHospitals,
  fetchVerifiedHospitals,
  getNotificationSettings,
  rollbackMedicineCourse,
  saveNotificationIds,
  type MedicineCatalogueItem,
} from '../src/lib/medicineCourses';
import { HospitalLogo } from '../src/components/HospitalLogo';
import { DOSE_SLOT_THEME } from '../src/lib/doseSlotTheme';
import {
  cancelDoseNotifications,
  hasShownNotificationSettingsNudge,
  markNotificationSettingsNudgeShown,
  requestMedicineNotificationPermission,
  scheduleDoseNotifications,
} from '../src/lib/medicineNotifications';
import {
  adjustTabletCount,
  expandDoseEvents,
  validateMedicineCourseInput,
  type CourseDuration,
  type DayPattern,
  type DoseSlot,
} from '../src/lib/medicineSchedule';
import { areSelectedSlotTimesOrdered } from '../src/lib/medicineTime';
import {
  filterMedicineCatalogue,
  getNewCatalogueEntryName,
  hasMedicineImage,
} from '../src/lib/medicineSearch';
import {
  getMedicineWorkflowTitleKey,
  initialMedicineWorkflow,
  medicineWorkflowReducer,
} from '../src/lib/medicineWorkflow';
import { getPatientByPhone } from '../src/lib/patients';
import { normalizeRoutePhone } from '../src/lib/routePhone';

const SLOT_KEYS: DoseSlot[] = ['morning', 'afternoon', 'night'];
const SUCCESS_SOUND = require('../assets/sounds/success.wav');
const MAX_VISIBLE_MEDICINE_RESULTS = 40;
const MAX_PREFETCHED_MEDICINE_IMAGES = 24;

type MedicineReminderDetails = {
  slotTimes: Record<DoseSlot, string>;
  slots: DoseSlot[];
  tablets: string;
};

type HospitalOption = {
  id: string;
  isCustom: boolean;
  name: string;
};

function todayString() {
  return formatDateOnly(new Date());
}

function formatCourseDate(value: string): string {
  const parsed = parseDateOnly(value);
  return parsed
    ? parsed.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : value;
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
  const [hospitals, setHospitals] = useState<HospitalOption[]>([]);
  const [hospitalQuery, setHospitalQuery] = useState('');
  const [customHospitalName, setCustomHospitalName] = useState('');
  const [isCustomHospital, setIsCustomHospital] = useState(false);
  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState(true);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(true);
  const [query, setQuery] = useState('');
  const [medicineDropdownOpen, setMedicineDropdownOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<MedicineCatalogueItem[]>([]);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);
  const [duration, setDuration] = useState<CourseDuration>({
    days: 7,
    mode: 'finite',
  });
  const [customMedicineOpen, setCustomMedicineOpen] = useState(false);
  const [isSavingCustomMedicine, setIsSavingCustomMedicine] = useState(false);
  const [selectedCustomHospitalId, setSelectedCustomHospitalId] = useState('');
  const [startDate, setStartDate] = useState(todayString);
  const [defaultSlotTimes, setDefaultSlotTimes] = useState<
    Record<DoseSlot, string>
  >({
    afternoon: '13:00',
    morning: '08:00',
    night: '20:00',
  });
  const [medicineDetails, setMedicineDetails] = useState<
    Record<string, MedicineReminderDetails>
  >({});
  const [pattern, setPattern] = useState<DayPattern>('daily');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const successPlayer = useAudioPlayer(SUCCESS_SOUND);

  useEffect(() => {
    if (!phone) {
      Alert.alert(t('patientUnavailable'));
      return;
    }
    void Promise.all([getPatientByPhone(phone), fetchVerifiedHospitals()])
      .then(async ([patient, verifiedHospitals]) => {
        if (!patient) throw new Error('Patient unavailable');
        setPatientId(patient.patientId);
        const [customHospitals, notificationSettings] = await Promise.all([
          fetchPatientCustomHospitals(patient.patientId).catch(() => []),
          getNotificationSettings(patient.patientId).catch(() => null),
        ]);
        if (notificationSettings) {
          setDefaultSlotTimes({
            afternoon: notificationSettings.afternoonTime,
            morning: notificationSettings.morningTime,
            night: notificationSettings.nightTime,
          });
        }
        setHospitals([
          ...verifiedHospitals.map((hospital) => ({
            ...hospital,
            isCustom: false,
          })),
          ...customHospitals.map((hospital) => ({
            ...hospital,
            isCustom: true,
          })),
        ]);
      })
      .catch(() => Alert.alert(t('patientUnavailable')))
      .finally(() => setIsLoadingHospitals(false));
  }, [phone, t]);

  useEffect(() => {
    if (workflow.step !== 'medicine') {
      return;
    }

    let cancelled = false;
    setCatalogue([]);
    setIsLoadingCatalogue(true);

    const hospitalSource = isCustomHospital
      ? selectedCustomHospitalId
        ? { customHospitalId: selectedCustomHospitalId }
        : null
      : workflow.hospitalId
        ? { hospitalId: workflow.hospitalId }
        : null;
    void Promise.all([
      isCustomHospital
        ? Promise.resolve([])
        : fetchMedicineCatalogue(workflow.hospitalId),
      patientId && hospitalSource
        ? loadCustomMedicines(patientId, hospitalSource).catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([verified, custom]) => {
        if (!cancelled) {
          setCatalogue([...custom, ...verified]);
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
  }, [
    isCustomHospital,
    patientId,
    selectedCustomHospitalId,
    workflow.hospitalId,
    workflow.step,
  ]);

  const hospitalResults = useMemo(
    () => filterMedicineCatalogue(hospitals, hospitalQuery, 100),
    [hospitalQuery, hospitals],
  );
  const newHospitalName = useMemo(
    () => getNewCatalogueEntryName(hospitals, hospitalQuery),
    [hospitalQuery, hospitals],
  );
  const results = useMemo(
    () =>
      filterMedicineCatalogue(
        catalogue.filter(hasMedicineImage),
        deferredQuery,
        MAX_VISIBLE_MEDICINE_RESULTS,
      ),
    [catalogue, deferredQuery],
  );
  const resultImageUrls = useMemo(
    () =>
      results
        .slice(0, MAX_PREFETCHED_MEDICINE_IMAGES)
        .map((item) => item.imageUrl)
        .filter((url): url is string => Boolean(url)),
    [results],
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
  const durationDays = duration.mode === 'finite' ? duration.days : 14;
  const previewDurationDays = duration.mode === 'finite' ? duration.days : 14;
  const endDate = getCourseEndDate(
    startDate,
    previewDurationDays,
  );
  const courseStartLabel = formatCourseDate(startDate);
  const courseEndLabel = formatCourseDate(endDate);

  useEffect(() => {
    if (duration.mode === 'ongoing') setPattern('daily');
  }, [duration.mode]);

  useEffect(() => {
    if (resultImageUrls.length > 0) {
      void Image.prefetch(resultImageUrls, 'memory-disk').catch(
        () => undefined,
      );
    }
  }, [resultImageUrls]);

  const submit = async () => {
    if (selectedMedicines.length === 0 || !patientId) return;
    for (const medicine of selectedMedicines) {
      const details = medicineDetails[medicine.id];
      const validation =
        !details ||
        validateMedicineCourseInput({
          durationDays: duration.mode === 'finite' ? duration.days : 1,
          hospitalId: workflow.hospitalId || customHospitalName,
          medicineId: medicine.id,
          slots: details.slots,
          tabletsPerDose: Number(details.tablets),
        });
      if (validation) {
        Alert.alert(
          medicine.name,
          'Enter a valid quantity and choose at least one reminder period.',
        );
        return;
      }
      if (!areSelectedSlotTimesOrdered(details.slots, details.slotTimes)) {
        Alert.alert(medicine.name, t('invalidTimings'));
        return;
      }
    }

    setBusy(true);
    const createdCourseIds: string[] = [];
    try {
      const customHospital = isCustomHospital
        ? await createCustomHospital(patientId, customHospitalName)
        : null;
      const permitted = await requestMedicineNotificationPermission().catch(
        () => false,
      );
      let notificationWarning = false;

      for (const medicine of selectedMedicines) {
        const details = medicineDetails[medicine.id]!;
        const tabletsPerDose = Number(details.tablets);
        const drafts = expandDoseEvents({
          dayPattern: duration.mode === 'ongoing' ? 'daily' : pattern,
          durationDays,
          slotTimes: details.slotTimes,
          slots: details.slots,
          startDate,
        });
        const created = await createMedicineCourse({
          customMedicineId: medicine.isCustom ? medicine.id : undefined,
          customHospitalId: customHospital?.id,
          dayPattern: duration.mode === 'ongoing' ? 'daily' : pattern,
          durationDays: duration.mode === 'finite' ? duration.days : null,
          events: drafts,
          hospitalId: isCustomHospital ? undefined : workflow.hospitalId,
          medicineId: medicine.isCustom ? undefined : medicine.id,
          patientId,
          scheduleMode: duration.mode,
          slots: details.slots,
          startDate,
          tabletsPerDose,
        });
        createdCourseIds.push(created.courseId);

        if (permitted) {
          const identifiers: Array<{
            eventId: string;
            notificationId: string;
          }> = [];
          try {
            for (const [index, draft] of drafts.entries()) {
              const eventId = created.eventIds[index];
              if (!eventId) {
                throw new Error('A saved reminder event is missing.');
              }
              const next = await scheduleDoseNotifications(
                [{ eventId, scheduledFor: draft.scheduledFor }],
                {
                  medicineName: medicine.name,
                  slot: t(draft.slot),
                  slotKey: draft.slot,
                  tablets: tabletsPerDose,
                },
              );
              identifiers.push(...next);
            }
            await saveNotificationIds(identifiers);
          } catch (error) {
            notificationWarning = true;
            await cancelDoseNotifications(
              identifiers.map((item) => item.notificationId),
            ).catch(() => undefined);
            console.warn('Medicine reminder phone alert failed', error);
          }
        }
      }

      if (!permitted || notificationWarning) {
        const alreadyNudged = await hasShownNotificationSettingsNudge().catch(
          () => true,
        );
        if (!alreadyNudged) {
          Alert.alert(t('notifications'), t('phoneAlertsDisabled'), [
            { style: 'cancel', text: t('notNow') },
            {
              onPress: () => void Linking.openSettings(),
              text: t('openSettings'),
            },
          ]);
          void markNotificationSettingsNudgeShown().catch(() => undefined);
        }
      }
      setSuccess(true);
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => undefined);
      void successPlayer
        .seekTo(0)
        .then(() => successPlayer.play())
        .catch(() => undefined);
      setTimeout(() => {
        router.replace({
          params: { phone, refresh: Date.now(), selectedDate: startDate },
          pathname: '/home',
        });
      }, 1400);
    } catch (error) {
      await Promise.all(
        createdCourseIds.map((courseId) =>
          rollbackMedicineCourse(courseId).catch(() => undefined),
        ),
      );
      console.error('Unable to create medicine reminder', error);
      Alert.alert(t('addMedicine'), t('tryAgain'));
    } finally {
      setBusy(false);
    }
  };

  const selectMedicine = (medicine: MedicineCatalogueItem) => {
    const selected = workflow.medicineIds.includes(medicine.id);
    if (!selected) {
      setMedicineDetails((current) => ({
        ...current,
        [medicine.id]: current[medicine.id] ?? {
          slotTimes: { ...defaultSlotTimes },
          slots: ['morning'],
          tablets: '1',
        },
      }));
    }
    dispatch({ medicineId: medicine.id, type: 'toggleMedicine' });
    setQuery('');
    setMedicineDropdownOpen(false);
  };

  const updateMedicineDetails = (
    medicineId: string,
    update: (
      current: MedicineReminderDetails,
    ) => MedicineReminderDetails,
  ) =>
    setMedicineDetails((current) => ({
      ...current,
      [medicineId]: update(
        current[medicineId] ?? {
          slotTimes: { ...defaultSlotTimes },
          slots: ['morning'],
          tablets: '1',
        },
      ),
    }));

  const reviewReminder = () => {
    for (const medicine of selectedMedicines) {
      const details = medicineDetails[medicine.id];
      if (
        !details ||
        validateMedicineCourseInput({
          durationDays: duration.mode === 'finite' ? duration.days : 1,
          hospitalId: workflow.hospitalId || customHospitalName,
          medicineId: medicine.id,
          slots: details.slots,
          tabletsPerDose: Number(details.tablets),
        })
      ) {
        Alert.alert(
          medicine.name,
          'Enter a valid quantity and choose at least one reminder period.',
        );
        return;
      }
    }
    dispatch({ type: 'continue' });
  };

  const selectHospital = (hospital: HospitalOption) => {
    setIsCustomHospital(hospital.isCustom);
    setSelectedCustomHospitalId(hospital.isCustom ? hospital.id : '');
    setCustomHospitalName(hospital.isCustom ? hospital.name : '');
    setHospitalQuery(hospital.name);
    setHospitalDropdownOpen(false);
    setQuery('');
    dispatch({
      hospitalId: hospital.isCustom ? 'custom' : hospital.id,
      type: 'selectHospital',
    });
  };

  const selectNewHospital = (name: string) => {
    setHospitals((current) => [
      ...current,
      { id: `draft:${name}`, isCustom: true, name },
    ]);
    setIsCustomHospital(true);
    setSelectedCustomHospitalId('');
    setCustomHospitalName(name);
    setHospitalQuery(name);
    setHospitalDropdownOpen(false);
    setQuery('');
    dispatch({ hospitalId: 'custom', type: 'selectHospital' });
  };

  const saveCustomTablet = async (input: {
    imageUri: string;
    name: string;
  }) => {
    if (!patientId) return;
    setIsSavingCustomMedicine(true);
    try {
      let customHospitalId = selectedCustomHospitalId;
      if (isCustomHospital && !customHospitalId) {
        const hospital = await createCustomHospital(patientId, customHospitalName);
        customHospitalId = hospital.id;
        setSelectedCustomHospitalId(hospital.id);
      }
      const medicine = await createCustomMedicine({
        hospital: isCustomHospital
          ? { customHospitalId }
          : { hospitalId: workflow.hospitalId },
        imageUri: input.imageUri,
        name: input.name,
        patientId,
      });
      setCatalogue((current) => [
        medicine,
        ...current.filter((item) => item.id !== medicine.id),
      ]);
      selectMedicine(medicine);
      setCustomMedicineOpen(false);
    } catch (cause) {
      Alert.alert(
        'Tablet not saved',
        cause instanceof Error ? cause.message : 'Please try again.',
      );
    } finally {
      setIsSavingCustomMedicine(false);
    }
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
        <Text style={styles.title}>
          {t(getMedicineWorkflowTitleKey(workflow.step))}
        </Text>
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
                dropdownOpen={hospitalDropdownOpen}
                onChange={(value) => {
                  setHospitalQuery(value);
                  setHospitalDropdownOpen(true);
                }}
                onClear={() => {
                  setHospitalQuery('');
                  setHospitalDropdownOpen(true);
                }}
                onFocus={() => setHospitalDropdownOpen(true)}
                onToggleDropdown={() =>
                  setHospitalDropdownOpen((current) => !current)
                }
                placeholder="Search hospitals"
                value={hospitalQuery}
              />
              {hospitalDropdownOpen ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={styles.dropdown}
                >
                  <View style={styles.dropdownHeader}>
                    <Text style={styles.dropdownTitle}>
                      {t('selectHospital')}
                    </Text>
                    {!isLoadingHospitals ? (
                      <Text style={styles.dropdownCount}>
                        {hospitalResults.length}
                      </Text>
                    ) : null}
                  </View>
                  {isLoadingHospitals ? (
                    <ActivityIndicator
                      color={dashboardColors.primary}
                      style={styles.dropdownLoading}
                    />
                  ) : (
                    hospitalResults.map((hospital) => (
                      <Choice
                        key={`${hospital.isCustom ? 'custom' : 'verified'}-${hospital.id}`}
                        label={hospital.name}
                        meta={hospital.isCustom ? 'Your hospital' : undefined}
                        onPress={() => selectHospital(hospital)}
                      />
                    ))
                  )}
                  {!isLoadingHospitals && newHospitalName ? (
                    <Choice
                      icon="add-circle-outline"
                      label={`Add “${newHospitalName}”`}
                      meta="New hospital"
                      onPress={() => selectNewHospital(newHospitalName)}
                    />
                  ) : null}
                  {!isLoadingHospitals &&
                  hospitalResults.length === 0 &&
                  !newHospitalName ? (
                    <Text style={styles.emptyResult}>No hospitals found</Text>
                  ) : null}
                </ScrollView>
              ) : (
                <Text style={styles.dropdownHint}>
                  Tap the search field to see all hospitals.
                </Text>
              )}
            </Animated.View>
          ) : null}

          {workflow.step === 'medicine' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.eyebrow}>{hospitalName}</Text>
              {selectedMedicines.length > 0 ? (
                <SelectedMedicineStrip medicines={selectedMedicines} />
              ) : null}
              <SearchBox
                accessibilityLabel="Search medicines"
                onChange={setQuery}
                onClear={() => setQuery('')}
                onFocus={() => setMedicineDropdownOpen(true)}
                placeholder={t('searchMedicine')}
                value={query}
              />
              {medicineDropdownOpen ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={styles.dropdown}
                >
                  <PressableScale
                    accessibilityLabel="Add a new tablet with photo"
                    onPress={() => setCustomMedicineOpen(true)}
                    style={styles.addTabletRow}
                  >
                    <View style={styles.addTabletIcon}>
                      <Ionicons
                        color={dashboardColors.primary}
                        name="camera-outline"
                        size={22}
                      />
                    </View>
                    <View style={styles.addTabletCopy}>
                      <Text style={styles.addTabletTitle}>Add new tablet</Text>
                      <Text style={styles.addTabletMeta}>
                        Name it and add your own photo
                      </Text>
                    </View>
                    <Ionicons
                      color={dashboardColors.primary}
                      name="add-circle"
                      size={24}
                    />
                  </PressableScale>
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
                            onPress={() => selectMedicine(item)}
                            style={[
                              styles.medicineRow,
                              selected && styles.medicineRowSelected,
                            ]}
                          >
                            <MedicineImage
                              hideWhenUnavailable
                              item={item}
                              priority="high"
                              style={styles.thumb}
                            />
                            <Text
                              numberOfLines={2}
                              style={styles.medicineResultName}
                            >
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
                  {!isLoadingCatalogue && results.length === 0 ? (
                    <Text style={styles.emptyResult}>No medicines found</Text>
                  ) : null}
                </ScrollView>
              ) : (
                <Text style={styles.dropdownHint}>
                  Tap the search field to see all medicines.
                </Text>
              )}
            </Animated.View>
          ) : null}

          {workflow.step === 'details' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <DurationPicker onChange={setDuration} value={duration} />
              <CourseStartDatePicker
                changeLabel={t('changeDate')}
                label={t('startDate')}
                onChange={setStartDate}
                value={startDate}
              />
              <Text style={styles.courseRange}>
                {duration.mode === 'ongoing'
                  ? 'Continues everyday until you stop it'
                  : `${t('courseEnds')}: ${courseEndLabel}`}
              </Text>
              {selectedMedicines.map((medicine) => {
                const details = medicineDetails[medicine.id] ?? {
                  slotTimes: { ...defaultSlotTimes },
                  slots: ['morning'] as DoseSlot[],
                  tablets: '1',
                };
                return (
                  <View key={medicine.id} style={styles.medicineDetailsCard}>
                    <MedicineImage item={medicine} style={styles.detailsImage} />
                    <View style={styles.medicineDetailsBody}>
                      <View style={styles.medicineNameRow}>
                        <Text numberOfLines={2} style={styles.detailsName}>
                          {medicine.name}
                        </Text>
                        <TabletStepper
                          onChange={(value) =>
                            updateMedicineDetails(medicine.id, (current) => ({
                              ...current,
                              tablets: value,
                            }))
                          }
                          value={details.tablets}
                        />
                      </View>
                      <Text style={styles.stepperCaption}>
                        {t('tabletsPerDose')}
                      </Text>
                      <Text style={styles.sectionLabel}>
                        When should this medicine be taken?
                      </Text>
                      <View style={styles.chips}>
                        {SLOT_KEYS.map((slot) => (
                          <Chip
                            active={details.slots.includes(slot)}
                            fill
                            key={slot}
                            label={t(slot)}
                            onPress={() =>
                              updateMedicineDetails(
                                medicine.id,
                                (current) => ({
                                  ...current,
                                  slots: SLOT_KEYS.filter((item) =>
                                    item === slot
                                      ? !current.slots.includes(slot)
                                      : current.slots.includes(item),
                                  ),
                                }),
                              )
                            }
                            slot={slot}
                          />
                        ))}
                      </View>
                      {details.slots.map((slot) => (
                        <SlotTimeEditor
                          changeLabel={t('changeTime')}
                          hint={t('tapToChooseTime')}
                          key={slot}
                          label={t(slot)}
                          onChange={(value) =>
                            updateMedicineDetails(medicine.id, (current) => ({
                              ...current,
                              slotTimes: {
                                ...current.slotTimes,
                                [slot]: value,
                              },
                            }))
                          }
                          slot={slot}
                          value={details.slotTimes[slot]}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
              {duration.mode === 'finite' ? (
                <>
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
                </>
              ) : null}
              <Primary
                label={t('reviewReminder')}
                onPress={reviewReminder}
              />
            </Animated.View>
          ) : null}

          {workflow.step === 'review' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.heading}>
                {selectedMedicines.length} medicine
                {selectedMedicines.length === 1 ? '' : 's'}
              </Text>
              <View style={styles.reviewList}>
                {selectedMedicines.map((medicine) => {
                  const details = medicineDetails[medicine.id]!;
                  return (
                    <View key={medicine.id} style={styles.reviewMedicine}>
                      <MedicineImage
                        item={medicine}
                        style={styles.reviewImage}
                      />
                      <View style={styles.reviewBody}>
                        <Text numberOfLines={2} style={styles.reviewName}>
                          {medicine.name}
                        </Text>
                        <View style={styles.reviewDetailRow}>
                          <View style={styles.reviewDetailCell}>
                            <Ionicons
                              color={dashboardColors.textMuted}
                              name="time-outline"
                              size={14}
                            />
                            <Text
                              numberOfLines={1}
                              style={styles.reviewDetailText}
                            >
                              {details.slots.map((slot) => t(slot)).join(', ')}
                            </Text>
                          </View>

                          <View style={styles.reviewHospitalCell}>
                            <HospitalLogo size={28} />
                            <Text
                              numberOfLines={1}
                              style={styles.reviewHospitalName}
                            >
                              {hospitalName}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.reviewDetailCell,
                              styles.reviewDetailRight,
                            ]}
                          >
                            <Ionicons
                              color={dashboardColors.primary}
                              name="medical-outline"
                              size={14}
                            />
                            <Text style={styles.reviewDoseText}>
                              {details.tablets} tablet
                              {Number(details.tablets) === 1 ? '' : 's'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.summary}>{hospitalName}</Text>
              <Text style={styles.summary}>
                {durationLabel(duration)}
              </Text>
              <Text style={styles.summary}>
                {duration.mode === 'ongoing'
                  ? `${t('courseStarts')}: ${courseStartLabel} · Continues until stopped`
                  : `${t('courseStarts')}: ${courseStartLabel} · ${t('courseEnds')}: ${courseEndLabel}`}
              </Text>
              <Text style={styles.summary}>
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
        {workflow.step === 'medicine' ? (
          <View style={styles.continueFooter}>
            <Primary
              disabled={selectedMedicines.length === 0}
              label={`Continue${
                selectedMedicines.length
                  ? ` (${selectedMedicines.length} selected)`
                  : ''
              }`}
              onPress={() => dispatch({ type: 'continue' })}
            />
          </View>
        ) : null}
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
            <Text style={styles.summary}>
              {t('courseStarts')}: {courseStartLabel}
            </Text>
          </Animated.View>
        </View>
      ) : null}
      <CustomMedicineSheet
        busy={isSavingCustomMedicine}
        onClose={() => setCustomMedicineOpen(false)}
        onCreate={(input) => void saveCustomTablet(input)}
        visible={customMedicineOpen}
      />
    </SafeAreaView>
  );
}

function SearchBox({
  accessibilityLabel,
  autoFocus,
  dropdownOpen,
  onChange,
  onClear,
  onFocus,
  onToggleDropdown,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  autoFocus?: boolean;
  dropdownOpen?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onFocus?: () => void;
  onToggleDropdown?: () => void;
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
        onFocus={onFocus}
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
      {onToggleDropdown ? (
        <PressableScale
          accessibilityLabel={
            dropdownOpen ? 'Hide hospital options' : 'Show hospital options'
          }
          accessibilityState={{ expanded: dropdownOpen }}
          onPress={onToggleDropdown}
          style={styles.dropdownToggle}
        >
          <Ionicons
            color={dashboardColors.primary}
            name={dropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
          />
        </PressableScale>
      ) : null}
    </View>
  );
}

function Choice({
  disabled,
  icon = 'business-outline',
  label,
  meta,
  onPress,
}: {
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  meta?: string;
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
        name={icon}
        size={20}
      />
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceText}>{label}</Text>
        {meta ? <Text style={styles.choiceMeta}>{meta}</Text> : null}
      </View>
      <Ionicons
        color={dashboardColors.textFaint}
        name="chevron-forward"
        size={18}
      />
    </PressableScale>
  );
}

function MedicineImage({
  hideWhenUnavailable = false,
  item,
  priority = 'normal',
  style,
}: {
  hideWhenUnavailable?: boolean;
  item: MedicineCatalogueItem;
  priority?: 'high' | 'low' | 'normal';
  style: object;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [item.imageUrl]);

  if ((!item.imageUrl || failed) && hideWhenUnavailable) {
    return null;
  }

  return item.imageUrl && !failed ? (
    <Image
      accessibilityLabel={item.name}
      cachePolicy="memory-disk"
      contentFit="contain"
      onError={() => setFailed(true)}
      priority={priority}
      recyclingKey={item.id}
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

function Chip({
  active,
  fill,
  label,
  onPress,
  slot,
}: {
  active: boolean;
  fill?: boolean;
  label: string;
  onPress: () => void;
  slot?: DoseSlot;
}) {
  const theme = slot ? DOSE_SLOT_THEME[slot] : null;
  return (
    <PressableScale
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.chip,
        fill && styles.chipFill,
        active && styles.chipActive,
        theme && {
          backgroundColor: active ? theme.tint : dashboardColors.card,
          borderColor: theme.accent,
        },
      ]}
    >
      {theme ? (
        <Ionicons color={theme.accent} name={theme.icon} size={15} />
      ) : null}
      <Text
        style={[
          styles.chipText,
          active && styles.chipTextActive,
          theme && { color: theme.accent },
        ]}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function TabletStepper({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.stepper}>
      <PressableScale
        accessibilityLabel="Fewer tablets per dose"
        onPress={() => onChange(adjustTabletCount(value, -1))}
        style={styles.stepperButton}
      >
        <Ionicons color={dashboardColors.primary} name="remove" size={16} />
      </PressableScale>
      <Text style={styles.stepperValue}>{value || '1'}</Text>
      <PressableScale
        accessibilityLabel="More tablets per dose"
        onPress={() => onChange(adjustTabletCount(value, 1))}
        style={styles.stepperButton}
      >
        <Ionicons color={dashboardColors.primary} name="add" size={16} />
      </PressableScale>
    </View>
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
  dropdownToggle: {
    alignItems: 'center',
    borderLeftColor: dashboardColors.track,
    borderLeftWidth: StyleSheet.hairlineWidth,
    height: 36,
    justifyContent: 'center',
    paddingLeft: 10,
    width: 34,
  },
  dropdown: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 18,
    borderWidth: 1,
    maxHeight: 390,
    overflow: 'hidden',
  },
  dropdownHeader: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  dropdownTitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
  },
  dropdownCount: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  dropdownLoading: { paddingVertical: 24 },
  emptyResult: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    padding: 20,
    textAlign: 'center',
  },
  dropdownHint: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    paddingHorizontal: 4,
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
  },
  choiceCopy: { flex: 1 },
  choiceMeta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    marginTop: 2,
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
  addTabletRow: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderBottomColor: dashboardColors.track,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    padding: 13,
  },
  addTabletIcon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 15,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  addTabletCopy: { flex: 1 },
  addTabletTitle: {
    ...dashboardTypography.body,
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
  },
  addTabletMeta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 2,
  },
  medicineResultName: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    flex: 1,
  },
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
  courseRange: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  medicineDetailsCard: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  medicineDetailsBody: {
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.md,
  },
  detailsImage: {
    height: 200,
    width: '100%',
  },
  medicineNameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    justifyContent: 'space-between',
  },
  detailsName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flex: 1,
  },
  stepper: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepperValue: {
    ...dashboardTypography.button,
    color: dashboardColors.primaryDark,
    minWidth: 22,
    textAlign: 'center',
  },
  stepperCaption: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    textAlign: 'right',
  },
  chips: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  chip: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipFill: {
    flex: 1,
    justifyContent: 'center',
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
  reviewList: {
    gap: 10,
  },
  reviewMedicine: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  reviewImage: { height: 220, width: '100%' },
  reviewBody: {
    gap: 3,
    padding: dashboardSpacing.md,
  },
  reviewName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 16,
  },
  reviewDetailRow: {
    alignItems: 'center',
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 6,
    minHeight: 44,
    paddingTop: 8,
  },
  reviewDetailCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  reviewDetailRight: {
    justifyContent: 'flex-end',
  },
  reviewDetailText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    flexShrink: 1,
  },
  reviewHospitalCell: {
    alignItems: 'center',
    flex: 0.9,
    paddingHorizontal: 4,
  },
  reviewHospitalName: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 9,
    marginTop: 2,
    maxWidth: 92,
  },
  reviewDoseText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_700Bold',
  },
  continueFooter: {
    backgroundColor: dashboardColors.bg,
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: dashboardSpacing.sm,
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
