import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '../src/components/PressableScale';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import {
  getNotificationSettings,
  saveNotificationSettings,
} from '../src/lib/medicineCourses';
import { useLanguage } from '../src/lib/i18n';
import { getPatientByPhone } from '../src/lib/patients';

const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function NotificationTimingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = (params.phone ?? '').replace(/\D/g, '').slice(-10);
  const [patientId, setPatientId] = useState('');
  const [morning, setMorning] = useState('08:00');
  const [afternoon, setAfternoon] = useState('13:00');
  const [night, setNight] = useState('20:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getPatientByPhone(phone)
      .then(async (patient) => {
        if (!patient) throw new Error('Patient unavailable');
        setPatientId(patient.patientId);
        const settings = await getNotificationSettings(patient.patientId);
        setMorning(settings.morningTime);
        setAfternoon(settings.afternoonTime);
        setNight(settings.nightTime);
      })
      .catch(() => Alert.alert(t('patientUnavailable')))
      .finally(() => setLoading(false));
  }, [phone, t]);

  const save = async () => {
    if (
      ![morning, afternoon, night].every((value) => VALID_TIME.test(value)) ||
      !(morning < afternoon && afternoon < night)
    ) {
      Alert.alert(t('invalidTimings'));
      return;
    }
    setSaving(true);
    try {
      await saveNotificationSettings(patientId, {
        afternoonTime: afternoon,
        morningTime: morning,
        nightTime: night,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      });
      Alert.alert(t('timingsSaved'));
    } catch {
      Alert.alert(t('unableToSaveDocument'), t('tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={dashboardColors.text} />
        </PressableScale>
        <Text style={styles.title}>{t('notificationTimings')}</Text>
        <View style={styles.back} />
      </View>
      {loading ? (
        <ActivityIndicator color={dashboardColors.primary} style={styles.loader} />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.content}
        >
          <Text style={styles.help}>{t('notificationTimingsHelp')}</Text>
          {[
            [t('morning'), morning, setMorning, 'sunny-outline'],
            [t('afternoon'), afternoon, setAfternoon, 'partly-sunny-outline'],
            [t('night'), night, setNight, 'moon-outline'],
          ].map(([label, value, setter, icon]) => (
            <View key={label as string} style={styles.row}>
              <Ionicons
                color={dashboardColors.primary}
                name={icon as keyof typeof Ionicons.glyphMap}
                size={22}
              />
              <Text style={styles.label}>{label as string}</Text>
              <TextInput
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setter as (value: string) => void}
                placeholder="HH:MM"
                style={styles.input}
                value={value as string}
              />
            </View>
          ))}
          <PressableScale
            disabled={saving}
            onPress={() => void save()}
            style={styles.save}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>{t('saveTimings')}</Text>
            )}
          </PressableScale>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: dashboardColors.bg, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: dashboardSpacing.pagePadding,
  },
  back: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  title: { ...dashboardTypography.title, color: dashboardColors.text },
  loader: { marginTop: 80 },
  content: { gap: dashboardSpacing.md, padding: dashboardSpacing.pagePadding },
  help: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    marginBottom: dashboardSpacing.sm,
  },
  row: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    padding: dashboardSpacing.gap,
  },
  label: { ...dashboardTypography.body, color: dashboardColors.text, flex: 1 },
  input: {
    ...dashboardTypography.cardTitle,
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 12,
    color: dashboardColors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 8,
    textAlign: 'center',
    width: 88,
  },
  save: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.button,
    marginTop: dashboardSpacing.md,
    padding: 16,
  },
  saveText: { ...dashboardTypography.button, color: '#fff' },
});
