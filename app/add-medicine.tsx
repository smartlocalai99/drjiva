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
import { SlotTimeEditor } from '../src/components/medicine/SlotTimeEditor';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { useLanguage } from '../src/lib/i18n';
import {
  formatDateOnly,
  getCourseEndDate,
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
import { DOSE_SLOT_THEME } from '../src/lib/doseSlotTheme';
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
import {
  areSelectedSlotTimesOrdered,
  formatTime12Hour,
} from '../src/lib/medicineTime';
import {
  filterMedicineCatalogue,
  getNewCatalogueEntryName,
} from '../src/lib/medicineSearch';
import {
  getMedicineWorkflowTitleKey,
  initialMedicineWorkflow,
  medicineWorkflowReducer,
} from '../src/lib/medicineWorkflow';
import { getPatientByPhone } from '../src/lib/patients';
import { normalizeRoutePhone } from '../src/lib/routePhone';

const SLOT_KEYS: DoseSlot[] = ['morning', 'afternoon', 'night'];

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
  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [medicineDropdownOpen, setMedicineDropdownOpen] = useState(false);
  const [catalogue, setCatalogue] = useState<MedicineCatalogueItem[]>([]);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);
  const [days, setDays] = useState('7');
  const [startDate] = useState(todayString);
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
  const newHospitalName = useMemo(
    () => getNewCatalogueEntryName(hospitals, hospitalQuery),
    [hospitalQuery, hospitals],
  );
  const results = useMemo(
    () => filterMedicineCatalogue(catalogue, query, 1000),
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
  const previewDurationDays =
    Number.isInteger(durationDays) && durationDays > 0 ? durationDays : 1;
  const endDate = getCourseEndDate(
    startDate,
    previewDurationDays,
  );

  const submit = async () => {
    if (selectedMedicines.length === 0 || !patientId) return;
    for (const medicine of selectedMedicines) {
      const details = medicineDetails[medicine.id];
      const validation =
        !details ||
        validateMedicineCourseInput({
          durationDays,
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
          dayPattern: pattern,
          durationDays,
          slotTimes: details.slotTimes,
          slots: details.slots,
          startDate,
        });
        const created = await createMedicineCourse({
          customHospitalId: customHospital?.id,
          dayPattern: pattern,
          durationDays,
          events: drafts,
          hospitalId: isCustomHospital ? undefined : workflow.hospitalId,
          medicineId: medicine.id,
          patientId,
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
          durationDays,
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
    setCustomHospitalName(name);
    setHospitalQuery(name);
    setHospitalDropdownOpen(false);
    setQuery('');
    dispatch({ hospitalId: 'custom', type: 'selectHospital' });
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
                onChange={setHospitalQuery}
                onClear={() => setHospitalQuery('')}
                onFocus={() => setHospitalDropdownOpen(true)}
                placeholder="Search hospitals"
                value={hospitalQuery}
              />
              {hospitalDropdownOpen ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={styles.dropdown}
                >
                  {hospitalResults.map((hospital) => (
                    <Choice
                      key={`${hospital.isCustom ? 'custom' : 'verified'}-${hospital.id}`}
                      label={hospital.name}
                      meta={hospital.isCustom ? 'Your hospital' : undefined}
                      onPress={() => selectHospital(hospital)}
                    />
                  ))}
                  {newHospitalName ? (
                    <Choice
                      icon="add-circle-outline"
                      label={`Add “${newHospitalName}”`}
                      meta="New hospital"
                      onPress={() => selectNewHospital(newHospitalName)}
                    />
                  ) : null}
                  {hospitalResults.length === 0 && !newHospitalName ? (
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
              <LabelInput
                label={t('durationDays')}
                onChange={setDays}
                value={days}
              />
              <Text style={styles.courseRange}>
                Starts today · ends {endDate}
              </Text>
              {selectedMedicines.map((medicine) => {
                const details = medicineDetails[medicine.id] ?? {
                  slotTimes: { ...defaultSlotTimes },
                  slots: ['morning'] as DoseSlot[],
                  tablets: '1',
                };
                return (
                  <View key={medicine.id} style={styles.medicineDetailsCard}>
                    <View style={styles.medicineDetailsHeader}>
                      <MedicineImage
                        item={medicine}
                        style={styles.detailsThumb}
                      />
                      <Text numberOfLines={2} style={styles.detailsName}>
                        {medicine.name}
                      </Text>
                    </View>
                    <LabelInput
                      label={t('tabletsPerDose')}
                      onChange={(value) =>
                        updateMedicineDetails(medicine.id, (current) => ({
                          ...current,
                          tablets: value,
                        }))
                      }
                      value={details.tablets}
                    />
                    <Text style={styles.sectionLabel}>
                      When should this medicine be taken?
                    </Text>
                    <View style={styles.chips}>
                      {SLOT_KEYS.map((slot) => (
                        <Chip
                          active={details.slots.includes(slot)}
                          key={slot}
                          label={`${t(slot)} · ${formatTime12Hour(
                            details.slotTimes[slot],
                          )}`}
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
                );
              })}
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
                      <View style={styles.reviewCopy}>
                        <Text numberOfLines={2} style={styles.reviewName}>
                          {medicine.name}
                        </Text>
                        <Text style={styles.reviewMeta}>
                          {details.tablets} tablet
                          {Number(details.tablets) === 1 ? '' : 's'} ·{' '}
                          {details.slots
                            .map(
                              (slot) =>
                                `${t(slot)} ${formatTime12Hour(
                                  details.slotTimes[slot],
                                )}`,
                            )
                            .join(', ')}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
              <Text style={styles.summary}>{hospitalName}</Text>
              <Text style={styles.summary}>
                {days} {t('durationDays').toLowerCase()} · {startDate} to{' '}
                {endDate}
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
  onFocus,
  placeholder,
  value,
}: {
  accessibilityLabel: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onClear: () => void;
  onFocus?: () => void;
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

function Chip({
  active,
  label,
  onPress,
  slot,
}: {
  active: boolean;
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
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.md,
  },
  medicineDetailsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.md,
  },
  detailsThumb: {
    borderRadius: 12,
    height: 58,
    width: 68,
  },
  detailsName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flex: 1,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
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
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    overflow: 'hidden',
    padding: dashboardSpacing.sm,
  },
  reviewImage: { borderRadius: 12, height: 72, width: 82 },
  reviewCopy: { flex: 1 },
  reviewName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
  },
  reviewMeta: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    marginTop: 4,
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
