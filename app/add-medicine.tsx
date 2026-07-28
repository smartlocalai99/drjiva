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
import {
  createCustomHospital,
  createMedicineCourse,
  fetchMedicineCatalogue,
  fetchVerifiedHospitals,
  getNotificationSettings,
  saveNotificationIds,
  rollbackMedicineCourse,
  type MedicineCatalogueItem,
} from '../src/lib/medicineCourses';
import { filterMedicineCatalogue } from '../src/lib/medicineSearch';
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
  initialMedicineWorkflow,
  medicineWorkflowReducer,
} from '../src/lib/medicineWorkflow';
import { useLanguage } from '../src/lib/i18n';
import { getPatientByPhone } from '../src/lib/patients';

const SLOT_KEYS: DoseSlot[] = ['morning', 'afternoon', 'night'];

function todayString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export default function AddMedicineScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = (params.phone ?? '').replace(/\D/g, '').slice(-10);
  const [workflow, dispatch] = useReducer(
    medicineWorkflowReducer,
    initialMedicineWorkflow,
  );
  const [patientId, setPatientId] = useState('');
  const [hospitals, setHospitals] = useState<Array<{ id: string; name: string }>>([]);
  const [customHospitalName, setCustomHospitalName] = useState('');
  const [isCustomHospital, setIsCustomHospital] = useState(false);
  const [query, setQuery] = useState('');
  const [catalogue, setCatalogue] = useState<MedicineCatalogueItem[]>([]);
  const [isLoadingCatalogue, setIsLoadingCatalogue] = useState(false);
  const [medicine, setMedicine] = useState<MedicineCatalogueItem | null>(null);
  const [tablets, setTablets] = useState('1');
  const [days, setDays] = useState('7');
  const [startDate, setStartDate] = useState(todayString());
  const [slots, setSlots] = useState<DoseSlot[]>(['morning']);
  const [pattern, setPattern] = useState<DayPattern>('daily');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
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

  const results = useMemo(
    () => filterMedicineCatalogue(catalogue, query),
    [catalogue, query],
  );

  const hospitalName = useMemo(
    () =>
      isCustomHospital
        ? customHospitalName
        : hospitals.find((item) => item.id === workflow.hospitalId)?.name ?? '',
    [customHospitalName, hospitals, isCustomHospital, workflow.hospitalId],
  );

  const submit = async () => {
    if (!medicine || !patientId) return;
    const durationDays = Number(days);
    const tabletsPerDose = Number(tablets);
    const validation = validateMedicineCourseInput({
      durationDays,
      hospitalId: workflow.hospitalId || customHospitalName,
      medicineId: medicine.id,
      slots,
      tabletsPerDose,
    });
    if (validation || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      Alert.alert(t('courseDetails'), t('tryAgain'));
      return;
    }
    setBusy(true);
    let createdCourseId: string | null = null;
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
      createdCourseId = created.courseId;
      const permitted = await requestMedicineNotificationPermission();
      if (permitted) {
        const identifiers = [];
        for (const [index, draft] of drafts.entries()) {
          const next = await scheduleDoseNotifications(
            [{
              eventId: created.eventIds[index]!,
              scheduledFor: draft.scheduledFor,
            }],
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
      } else {
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
        router.replace({ params: { phone, refresh: Date.now() }, pathname: '/home' });
      }, 1400);
    } catch {
      await cancelDoseNotifications(scheduledIds).catch(() => undefined);
      if (createdCourseId) {
        await rollbackMedicineCourse(createdCourseId).catch(() => undefined);
      }
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <PressableScale
          onPress={() =>
            workflow.step === 'hospital' ? router.back() : dispatch({ type: 'back' })
          }
          style={styles.back}
        >
          <Ionicons name="chevron-back" size={22} color={dashboardColors.text} />
        </PressableScale>
        <Text style={styles.title}>{t('addMedicine')}</Text>
        <View style={styles.back} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {workflow.step === 'hospital' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.heading}>{t('chooseHospital')}</Text>
              {hospitals.map((hospital) => (
                <Choice
                  key={hospital.id}
                  label={hospital.name}
                  onPress={() => {
                    setIsCustomHospital(false);
                    dispatch({ hospitalId: hospital.id, type: 'selectHospital' });
                  }}
                />
              ))}
              <TextInput
                onChangeText={setCustomHospitalName}
                placeholder={t('hospitalName')}
                style={styles.textInput}
                value={customHospitalName}
              />
              <Choice
                disabled={customHospitalName.trim().length < 2}
                label={t('addNewHospital')}
                onPress={() => {
                  setIsCustomHospital(true);
                  dispatch({ hospitalId: 'custom', type: 'selectHospital' });
                }}
              />
            </Animated.View>
          ) : null}

          {workflow.step === 'medicine' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.eyebrow}>{hospitalName}</Text>
              <Text style={styles.heading}>{t('findMedicine')}</Text>
              <View style={styles.searchBox}>
                <Ionicons
                  color={dashboardColors.textFaint}
                  name="search"
                  size={20}
                />
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                  onChangeText={setQuery}
                  placeholder={t('searchMedicine')}
                  placeholderTextColor={dashboardColors.textFaint}
                  style={styles.searchInput}
                  value={query}
                />
                {query ? (
                  <PressableScale
                    accessibilityLabel="Clear medicine search"
                    onPress={() => setQuery('')}
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
              <View style={styles.dropdown}>
                {isLoadingCatalogue ? (
                  <ActivityIndicator
                    color={dashboardColors.primary}
                    style={styles.dropdownLoading}
                  />
                ) : null}
                {!isLoadingCatalogue
                  ? results.map((item) => (
                      <PressableScale
                        key={item.id}
                        onPress={() => {
                          setMedicine(item);
                          setQuery(item.name);
                          dispatch({
                            medicineId: item.id,
                            type: 'selectMedicine',
                          });
                        }}
                        style={styles.medicineRow}
                      >
                        {item.imageUrl ? (
                          <Image
                            contentFit="cover"
                            source={{ uri: item.imageUrl }}
                            style={styles.thumb}
                          />
                        ) : (
                          <View style={styles.thumbFallback}>
                            <Ionicons
                              color={dashboardColors.primary}
                              name="medical"
                              size={22}
                            />
                          </View>
                        )}
                        <Text numberOfLines={2} style={styles.choiceText}>
                          {item.name}
                        </Text>
                        <Ionicons
                          color={dashboardColors.textFaint}
                          name="chevron-forward"
                          size={18}
                        />
                      </PressableScale>
                    ))
                  : null}
              </View>
            </Animated.View>
          ) : null}

          {workflow.step === 'details' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.heading}>{t('courseDetails')}</Text>
              <LabelInput label={t('tabletsPerDose')} value={tablets} onChange={setTablets} />
              <LabelInput label={t('durationDays')} value={days} onChange={setDays} />
              <View>
                <Text style={styles.label}>{t('startDate')}</Text>
                <TextInput
                  maxLength={10}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  style={styles.textInput}
                  value={startDate}
                />
              </View>
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
              <View style={styles.chips}>
                <Chip active={pattern === 'daily'} label={t('everyDay')} onPress={() => setPattern('daily')} />
                <Chip active={pattern === 'alternate'} label={t('alternateDays')} onPress={() => setPattern('alternate')} />
              </View>
              <Primary label={t('reviewReminder')} onPress={() => dispatch({ type: 'continue' })} />
            </Animated.View>
          ) : null}

          {workflow.step === 'review' && medicine ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              {medicine.imageUrl ? (
                <Image
                  contentFit="cover"
                  source={{ uri: medicine.imageUrl }}
                  style={styles.hero}
                />
              ) : (
                <View style={[styles.hero, styles.heroFallback]}>
                  <Ionicons
                    color={dashboardColors.primary}
                    name="medical"
                    size={54}
                  />
                </View>
              )}
              <Text style={styles.heading}>{medicine.name}</Text>
              <Text style={styles.summary}>{hospitalName}</Text>
              <Text style={styles.summary}>
                {tablets} · {days} {t('durationDays').toLowerCase()} · {slots.map((slot) => t(slot)).join(', ')}
              </Text>
              <Primary busy={busy} label={t('createReminder')} onPress={() => void submit()} />
            </Animated.View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {success ? (
        <View style={styles.overlay}>
          <Animated.View entering={ZoomIn.springify()} style={styles.success}>
            <Ionicons name="checkmark-circle" size={66} color={dashboardColors.success} />
            <Text style={styles.heading}>{t('reminderCreated')}</Text>
            <Text style={styles.summary}>{t('reminderCreatedMessage')}</Text>
          </Animated.View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function Choice({ disabled, label, onPress }: { disabled?: boolean; label: string; onPress: () => void }) {
  return (
    <PressableScale disabled={disabled} onPress={onPress} style={[styles.choice, disabled && styles.disabled]}>
      <Ionicons name="business-outline" size={20} color={dashboardColors.primary} />
      <Text style={styles.choiceText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={dashboardColors.textFaint} />
    </PressableScale>
  );
}
function Chip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return <PressableScale onPress={onPress} style={[styles.chip, active && styles.chipActive]}><Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text></PressableScale>;
}
function LabelInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <View><Text style={styles.label}>{label}</Text><TextInput keyboardType="decimal-pad" onChangeText={onChange} style={styles.textInput} value={value} /></View>;
}
function Primary({ busy, label, onPress }: { busy?: boolean; label: string; onPress: () => void }) {
  return <PressableScale disabled={busy} onPress={onPress} style={styles.primary}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{label}</Text>}</PressableScale>;
}

const styles = StyleSheet.create({
  safe: { backgroundColor: dashboardColors.bg, flex: 1 },
  flex: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: dashboardSpacing.pagePadding, paddingVertical: 10 },
  back: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  title: { ...dashboardTypography.title, color: dashboardColors.text },
  content: { padding: dashboardSpacing.pagePadding, paddingBottom: 48 },
  stack: { gap: dashboardSpacing.md },
  heading: { ...dashboardTypography.title, color: dashboardColors.text, textAlign: 'center' },
  eyebrow: { ...dashboardTypography.caption, color: dashboardColors.primary, textAlign: 'center' },
  textInput: { ...dashboardTypography.body, backgroundColor: dashboardColors.card, borderColor: dashboardColors.track, borderRadius: 16, borderWidth: 1, color: dashboardColors.text, padding: 15 },
  searchBox: { alignItems: 'center', backgroundColor: dashboardColors.card, borderColor: dashboardColors.primary, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  searchInput: { ...dashboardTypography.body, color: dashboardColors.text, flex: 1, paddingVertical: 15 },
  clearSearch: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  dropdown: { backgroundColor: dashboardColors.card, borderColor: dashboardColors.track, borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
  dropdownLoading: { paddingVertical: 24 },
  choice: { alignItems: 'center', backgroundColor: dashboardColors.card, borderRadius: 18, flexDirection: 'row', gap: 12, padding: 15 },
  choiceText: { ...dashboardTypography.body, color: dashboardColors.text, flex: 1 },
  disabled: { opacity: 0.45 },
  medicineRow: { alignItems: 'center', borderBottomColor: dashboardColors.track, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 12, padding: 10 },
  thumb: { borderRadius: 12, height: 58, width: 68 },
  thumbFallback: { alignItems: 'center', backgroundColor: dashboardColors.primaryTint, borderRadius: 12, height: 58, justifyContent: 'center', width: 68 },
  hero: { borderRadius: dashboardRadii.card, height: 210, width: '100%' },
  heroFallback: { alignItems: 'center', backgroundColor: dashboardColors.primaryTint, justifyContent: 'center' },
  label: { ...dashboardTypography.caption, color: dashboardColors.textMuted, marginBottom: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: dashboardColors.card, borderColor: dashboardColors.track, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  chipActive: { backgroundColor: dashboardColors.primary, borderColor: dashboardColors.primary },
  chipText: { ...dashboardTypography.caption, color: dashboardColors.text },
  chipTextActive: { color: '#fff' },
  primary: { alignItems: 'center', backgroundColor: dashboardColors.primary, borderRadius: dashboardRadii.button, marginTop: 8, padding: 16 },
  primaryText: { ...dashboardTypography.button, color: '#fff' },
  summary: { ...dashboardTypography.body, color: dashboardColors.textMuted, textAlign: 'center' },
  overlay: { alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.45)', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  success: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 28, gap: 12, margin: 28, padding: 28 },
});
