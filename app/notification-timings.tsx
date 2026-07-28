import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
  fetchFutureDoseReminders,
  saveNotificationSettings,
  replaceNotificationSchedule,
} from '../src/lib/medicineCourses';
import {
  cancelDoseNotifications,
  queueNotificationCancellations,
  requestMedicineNotificationPermission,
  scheduleDoseNotifications,
} from '../src/lib/medicineNotifications';
import { replaceEventSlotTime, type DoseSlot } from '../src/lib/medicineSchedule';
import { useLanguage } from '../src/lib/i18n';
import { getPatientByPhone } from '../src/lib/patients';
import { normalizeRoutePhone } from '../src/lib/routePhone';
import { getSessionPhone } from '../src/lib/session';

const VALID_TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function NotificationTimingsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const routePhone = normalizeRoutePhone(params.phone);
  const [patientId, setPatientId] = useState('');
  const [morning, setMorning] = useState('08:00');
  const [afternoon, setAfternoon] = useState('13:00');
  const [night, setNight] = useState('20:00');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      const phone =
        routePhone ||
        normalizeRoutePhone((await getSessionPhone().catch(() => null)) ?? undefined);
      if (!phone) {
        Alert.alert(t('patientUnavailable'));
        setLoading(false);
        return;
      }

      try {
        const patient = await getPatientByPhone(phone);
        if (!patient) {
          Alert.alert(t('patientUnavailable'));
          return;
        }
        if (cancelled) {
          return;
        }
        setPatientId(patient.patientId);
        try {
          const settings = await getNotificationSettings(patient.patientId);
          if (!cancelled) {
            setMorning(settings.morningTime);
            setAfternoon(settings.afternoonTime);
            setNight(settings.nightTime);
          }
        } catch {
          if (!cancelled) {
            Alert.alert(t('unableLoadNotificationTimings'), t('tryAgain'));
          }
        }
      } catch {
        if (!cancelled) {
          Alert.alert(t('unableLoadNotificationTimings'), t('tryAgain'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [routePhone, t]);

  const save = async () => {
    if (!patientId) {
      Alert.alert(t('unableLoadNotificationTimings'), t('tryAgain'));
      return;
    }
    if (
      ![morning, afternoon, night].every((value) => VALID_TIME.test(value)) ||
      !(morning < afternoon && afternoon < night)
    ) {
      Alert.alert(t('invalidTimings'));
      return;
    }
    setSaving(true);
    try {
      const nextSettings = {
        afternoonTime: afternoon,
        morningTime: morning,
        nightTime: night,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
      };
      const reminders = await fetchFutureDoseReminders(patientId);
      const newNotifications: Array<{
        eventId: string;
        notificationId: string;
        scheduledFor: string;
      }> = [];
      let alertsEnabled = true;
      if (reminders.length > 0) {
        const permitted = await requestMedicineNotificationPermission();
        if (!permitted) {
          alertsEnabled = false;
          Alert.alert(t('notifications'), t('phoneAlertsDisabled'), [
            { style: 'cancel', text: t('notNow') },
            {
              onPress: () => void Linking.openSettings(),
              text: t('openSettings'),
            },
          ]);
        } else {
          try {
            for (const reminder of reminders) {
              const slotTime = {
                afternoon,
                morning,
                night,
              }[reminder.slot as DoseSlot];
              const scheduledFor = replaceEventSlotTime(
                reminder.scheduledFor,
                slotTime,
              );
              const scheduled = await scheduleDoseNotifications(
                [{ eventId: reminder.eventId, scheduledFor }],
                {
                  medicineName: reminder.medicineName,
                  slot: t(reminder.slot),
                  tablets: reminder.tablets,
                },
              );
              if (scheduled[0]) {
                newNotifications.push({
                  ...scheduled[0],
                  scheduledFor,
                });
              }
            }
          } catch (error) {
            await cancelDoseNotifications(
              newNotifications.map((item) => item.notificationId),
            );
            throw error;
          }
        }
      }
      const updates = reminders.map((reminder) => {
        const scheduled = newNotifications.find(
          (item) => item.eventId === reminder.eventId,
        );
        return {
          eventId: reminder.eventId,
          notificationId:
            scheduled?.notificationId ??
            (alertsEnabled ? reminder.notificationId : null),
          scheduledFor:
            scheduled?.scheduledFor ??
            replaceEventSlotTime(
              reminder.scheduledFor,
              { afternoon, morning, night }[reminder.slot],
            ),
        };
      });
      try {
        if (reminders.length > 0) {
          await replaceNotificationSchedule(
            patientId,
            nextSettings,
            updates,
          );
        } else {
          await saveNotificationSettings(patientId, nextSettings);
        }
      } catch (error) {
        await cancelDoseNotifications(
          newNotifications.map((item) => item.notificationId),
        );
        throw error;
      }
      const oldIds = reminders.flatMap((item) =>
        item.notificationId ? [item.notificationId] : [],
      );
      try {
        await cancelDoseNotifications(oldIds);
      } catch {
        await queueNotificationCancellations(oldIds);
        Alert.alert(t('notifications'), t('oldAlertsCleanupPending'));
      }
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
