import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Medicine } from '../../data/medicineCourse';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { DOSE_SLOT_THEME } from '../../lib/doseSlotTheme';
import { CourseStreakRow } from '../course-streak-row';
import { DoctorAvatar } from '../DoctorAvatar';
import { HospitalLogo } from '../HospitalLogo';

const MEDICINE_PLACEHOLDER = require('../../../assets/notabs.png');

type MedicineCardProps = {
  medicine: Medicine;
  index: number;
};

export function MedicineCard({
  medicine,
  index,
}: MedicineCardProps) {
  const scale = useSharedValue(1);
  const wasCompleted = useRef(medicine.completed);
  const slotTheme = DOSE_SLOT_THEME[medicine.slot];
  const courseDuration =
    medicine.scheduleMode === 'ongoing'
      ? 'Ongoing course'
      : medicine.durationDays && medicine.durationDays > 0
        ? `${medicine.durationDays}-day course`
        : 'Course duration unavailable';

  useEffect(() => {
    if (medicine.completed && !wasCompleted.current) {
      scale.value = withSequence(
        withTiming(0.95, { duration: 90 }),
        withSpring(1, { damping: 10, stiffness: 220 }),
      );
    }
    wasCompleted.current = medicine.completed;
  }, [medicine.completed, scale]);

  const bounceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInRight.delay(index * 55).duration(280)}
      style={bounceStyle}
    >
      <View style={styles.card}>
        <View
          style={[styles.cardBody, { backgroundColor: slotTheme.tint }]}
        >
          <View style={styles.titleRow}>
            <Text numberOfLines={1} selectable style={styles.name}>
              {medicine.name}
            </Text>

            <View
              style={[styles.timingPill, { backgroundColor: slotTheme.tint }]}
            >
              <Ionicons
                color={slotTheme.accent}
                name={slotTheme.icon}
                size={15}
              />
              <View style={styles.timingCopy}>
                <Text
                  numberOfLines={1}
                  style={[styles.timingTitle, { color: slotTheme.accent }]}
                >
                  {medicine.timing}
                </Text>
                <Text
                  numberOfLines={1}
                  selectable
                  style={[styles.timingTime, { color: slotTheme.accent }]}
                >
                  {medicine.nextReminderTime}
                </Text>
              </View>
            </View>
          </View>

          <Text numberOfLines={1} selectable style={styles.metaSummary}>
            {medicine.tabletCount} · {medicine.description} · {courseDuration}
          </Text>
        </View>

        <View style={styles.imagePanel}>
          <Image
            accessibilityLabel={`${medicine.name} medicine`}
            cachePolicy="memory-disk"
            contentFit="contain"
            priority="high"
            recyclingKey={medicine.id}
            source={
              medicine.imageUrl
                ? { uri: medicine.imageUrl }
                : MEDICINE_PLACEHOLDER
            }
            style={styles.image}
            transition={180}
          />

          {medicine.completed ? (
            <View style={styles.completedBadge}>
              <Ionicons color="#FFFFFF" name="checkmark" size={12} />
              <Text style={styles.completedBadgeText}>Taken</Text>
            </View>
          ) : null}
        </View>

        <CourseStreakRow
          accentColor={slotTheme.accent}
          backgroundColor={slotTheme.tint}
          days={medicine.streakDays}
          ongoing={medicine.scheduleMode === 'ongoing'}
        />

        <View style={[styles.peopleRow, { backgroundColor: slotTheme.tint }]}>
          <View style={styles.hospitalGroup}>
            <HospitalLogo
              hospitalName={medicine.hospitalName}
              roundedSquare
              size={60}
            />
            <Text numberOfLines={2} selectable style={styles.hospitalName}>
              {medicine.hospitalName}
            </Text>
          </View>
          <DoctorAvatar roundedSquare size={72} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: 0,
    marginBottom: dashboardSpacing.gap,
    marginHorizontal: -dashboardSpacing.pagePadding,
    overflow: 'hidden',
  },
  imagePanel: {
    alignItems: 'center',
    backgroundColor: '#D9D9D9',
    height: 260,
    justifyContent: 'center',
    position: 'relative',
    width: '100%',
  },
  image: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  timingPill: {
    alignItems: 'center',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '46%',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  timingCopy: {
    flexShrink: 1,
  },
  timingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    lineHeight: 17,
  },
  timingTime: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    lineHeight: 15,
  },
  completedBadge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.success,
    borderRadius: dashboardRadii.pill,
    bottom: 10,
    flexDirection: 'row',
    gap: 4,
    left: dashboardSpacing.pagePadding,
    paddingHorizontal: 9,
    paddingVertical: 5,
    position: 'absolute',
  },
  completedBadgeText: {
    ...dashboardTypography.caption,
    color: '#FFFFFF',
    fontSize: 11,
  },
  cardBody: {
    backgroundColor: dashboardColors.card,
    gap: 4,
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: 8,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  name: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flex: 1,
    fontSize: 16,
    lineHeight: 20,
  },
  metaSummary: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
    fontSize: 12,
    lineHeight: 16,
  },
  peopleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.pagePadding,
    paddingVertical: 14,
  },
  hospitalGroup: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    paddingRight: dashboardSpacing.sm,
  },
  hospitalName: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flexShrink: 1,
    fontSize: 14,
  },
});
