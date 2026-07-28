import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
  fetchVerifiedHospitals,
  getNotificationSettings,
  saveNotificationIds,
  searchMedicines,
  type MedicineCatalogueItem,
} from '../src/lib/medicineCourses';
import {
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
  const [results, setResults] = useState<MedicineCatalogueItem[]>([]);
  const [medicine, setMedicine] = useState<MedicineCatalogueItem | null>(null);
  const [tablets, setTablets] = useState('1');
  const [days, setDays] = useState('7');
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
    if (workflow.step !== 'medicine' || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      void searchMedicines(
        query,
        isCustomHospital ? undefined : workflow.hospitalId,
      )
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [isCustomHospital, query, workflow.hospitalId, workflow.step]);

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
    if (validation) {
      Alert.alert(t('courseDetails'), t('tryAgain'));
      return;
    }
    setBusy(true);
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
        startDate: todayString(),
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
        startDate: todayString(),
        tabletsPerDose,
      });
      const permitted = await requestMedicineNotificationPermission();
      if (permitted) {
        const identifiers = await scheduleDoseNotifications(
          drafts.map((event, index) => ({
            eventId: created.eventIds[index]!,
            scheduledFor: event.scheduledFor,
          })),
          {
            medicineName: medicine.name,
            slot: slots.map((slot) => t(slot)).join(', '),
            tablets: tabletsPerDose,
          },
        );
        await saveNotificationIds(identifiers);
      } else {
        Alert.alert(t('notifications'), t('phoneAlertsDisabled'));
      }
      setSuccess(true);
      setTimeout(() => {
        router.replace({ params: { phone, refresh: Date.now() }, pathname: '/home' });
      }, 1400);
    } catch {
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
              <TextInput
                autoFocus
                onChangeText={setQuery}
                placeholder={t('searchMedicine')}
                style={styles.textInput}
                value={query}
              />
              {results.map((item) => (
                <PressableScale
                  key={item.id}
                  onPress={() => {
                    setMedicine(item);
                    dispatch({ medicineId: item.id, type: 'selectMedicine' });
                  }}
                  style={styles.medicineRow}
                >
                  <Image source={{ uri: item.imageUrl }} style={styles.thumb} />
                  <Text numberOfLines={2} style={styles.choiceText}>{item.name}</Text>
                  <Ionicons name="chevron-forward" size={18} color={dashboardColors.textFaint} />
                </PressableScale>
              ))}
            </Animated.View>
          ) : null}

          {workflow.step === 'details' ? (
            <Animated.View entering={FadeIn} style={styles.stack}>
              <Text style={styles.heading}>{t('courseDetails')}</Text>
              <LabelInput label={t('tabletsPerDose')} value={tablets} onChange={setTablets} />
              <LabelInput label={t('durationDays')} value={days} onChange={setDays} />
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
              <Image source={{ uri: medicine.imageUrl }} style={styles.hero} />
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
  choice: { alignItems: 'center', backgroundColor: dashboardColors.card, borderRadius: 18, flexDirection: 'row', gap: 12, padding: 15 },
  choiceText: { ...dashboardTypography.body, color: dashboardColors.text, flex: 1 },
  disabled: { opacity: 0.45 },
  medicineRow: { alignItems: 'center', backgroundColor: dashboardColors.card, borderRadius: 18, flexDirection: 'row', gap: 12, padding: 10 },
  thumb: { borderRadius: 12, height: 58, width: 68 },
  hero: { borderRadius: dashboardRadii.card, height: 210, width: '100%' },
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
