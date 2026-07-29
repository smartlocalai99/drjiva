import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getHospitalInitials } from '../src/data/medicineCourse';
import {
  deleteMedicineReminder,
  fetchActiveMedicineReminders,
  type MedicineReminder,
} from '../src/data/medicines';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../src/dashboardTheme';
import { formatDateOnly, getCourseEndDate } from '../src/lib/medicineCalendar';
import { useLanguage } from '../src/lib/i18n';
import { getPatientByPhone } from '../src/lib/patients';

export default function RemindersScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const params = useLocalSearchParams<{ phone?: string | string[] }>();
  const phoneParam = Array.isArray(params.phone) ? params.phone[0] : params.phone;
  const phone = (phoneParam ?? '').replace(/\D/g, '').slice(-10);

  const [reminders, setReminders] = useState<MedicineReminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string>();
  const [deletingCourseId, setDeletingCourseId] = useState<string>();

  const reload = useCallback(async () => {
    setErrorMessage(undefined);
    try {
      const patient = await getPatientByPhone(phone);
      if (!patient) {
        throw new Error('Patient unavailable');
      }
      setReminders(await fetchActiveMedicineReminders(patient.patientId));
    } catch {
      setErrorMessage(t('unableLoadReminders'));
    } finally {
      setIsLoading(false);
    }
  }, [phone, t]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      void reload();
    }, [reload]),
  );

  const confirmDelete = (reminder: MedicineReminder) => {
    Alert.alert(t('deleteReminder'), t('deleteReminderMessage'), [
      { style: 'cancel', text: t('cancel') },
      {
        onPress: () => {
          setDeletingCourseId(reminder.courseId);
          void deleteMedicineReminder(reminder.courseId)
            .then(() => {
              setReminders((current) =>
                current.filter((item) => item.courseId !== reminder.courseId),
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
          <Pressable onPress={() => void reload()} style={styles.retry}>
            <Text style={styles.retryText}>{t('tryAgain')}</Text>
          </Pressable>
        </View>
      ) : reminders.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyIcon}>
            <Ionicons
              color={dashboardColors.primary}
              name="alarm-outline"
              size={40}
            />
          </View>
          <Text style={styles.emptyTitle}>{t('noReminders')}</Text>
          <Text style={styles.emptySubtitle}>{t('noRemindersSubtitle')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {reminders.map((reminder) => (
            <ReminderCard
              deleting={deletingCourseId === reminder.courseId}
              key={reminder.courseId}
              onDelete={() => confirmDelete(reminder)}
              reminder={reminder}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ReminderCard({
  deleting,
  onDelete,
  reminder,
}: {
  deleting: boolean;
  onDelete: () => void;
  reminder: MedicineReminder;
}) {
  const { t } = useLanguage();
  const endDate = getCourseEndDate(
    reminder.startDate,
    reminder.durationDays,
  );
  const isOngoing = formatDateOnly(new Date()) <= endDate;

  return (
    <View style={styles.card}>
      <Image
        accessibilityLabel={reminder.medicineName}
        contentFit="cover"
        source={{ uri: reminder.imageUrl }}
        style={styles.cardImage}
        transition={120}
      />
      <Pressable
        accessibilityLabel={`Delete ${reminder.medicineName} reminder`}
        disabled={deleting}
        hitSlop={8}
        onPress={onDelete}
        style={styles.deleteButton}
      >
        {deleting ? (
          <ActivityIndicator color={dashboardColors.error} size="small" />
        ) : (
          <Ionicons color={dashboardColors.error} name="trash-outline" size={16} />
        )}
      </Pressable>

      <View style={styles.cardBody}>
        <Text numberOfLines={2} style={styles.cardName}>
          {reminder.medicineName}
        </Text>
        <Text style={styles.cardDuration}>
          {isOngoing ? 'Ongoing' : 'Completed'} · {reminder.durationDays} day
          {reminder.durationDays === 1 ? '' : 's'} from{' '}
          {new Date(reminder.startDate).toLocaleDateString()}
        </Text>

        <View style={styles.detailRow}>
          <View style={styles.detailCell}>
            <Ionicons
              color={dashboardColors.textMuted}
              name="time-outline"
              size={14}
            />
            <Text numberOfLines={1} style={styles.detailText}>
              {reminder.slots.map((slot) => t(slot)).join(', ')}
            </Text>
          </View>

          <View style={styles.hospitalCell}>
            <View style={styles.hospitalLogo}>
              <Text style={styles.hospitalLogoText}>
                {getHospitalInitials(reminder.hospitalName)}
              </Text>
            </View>
            <Text numberOfLines={1} style={styles.hospitalName}>
              {reminder.hospitalName}
            </Text>
          </View>

          <View style={[styles.detailCell, styles.detailRight]}>
            <Ionicons
              color={dashboardColors.primary}
              name="medical-outline"
              size={14}
            />
            <Text style={styles.doseText}>
              {reminder.tabletsPerDose} tablet
              {reminder.tabletsPerDose === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
      </View>
    </View>
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
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: dashboardSpacing.xl,
  },
  content: {
    gap: dashboardSpacing.md,
    paddingBottom: dashboardSpacing.xxl,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingTop: dashboardSpacing.gap,
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
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardImage: {
    height: 160,
    width: '100%',
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    position: 'absolute',
    right: dashboardSpacing.md,
    top: dashboardSpacing.md,
    width: 32,
  },
  cardBody: {
    gap: 3,
    padding: dashboardSpacing.md,
  },
  cardName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 16,
  },
  cardDuration: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  detailRow: {
    alignItems: 'center',
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 6,
    minHeight: 44,
    paddingTop: 8,
  },
  detailCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  detailRight: {
    justifyContent: 'flex-end',
  },
  detailText: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    flexShrink: 1,
  },
  hospitalCell: {
    alignItems: 'center',
    flex: 0.9,
    paddingHorizontal: 4,
  },
  hospitalLogo: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderColor: dashboardColors.primary,
    borderRadius: 14,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  hospitalLogoText: {
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
  },
  hospitalName: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 9,
    marginTop: 2,
    maxWidth: 92,
  },
  doseText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primaryDark,
    fontFamily: 'Inter_700Bold',
  },
});
