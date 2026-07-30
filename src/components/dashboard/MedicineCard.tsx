import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
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
import { formatDateOnly } from '../../lib/medicineCalendar';
import { DOSE_SLOT_THEME } from '../../lib/doseSlotTheme';
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
  const [doseNumber, ...doseLabelParts] = medicine.tabletCount.split(' ');
  const doseLabel = doseLabelParts.join(' ') || 'tablet';
  const today = formatDateOnly(new Date());

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
      entering={FadeInDown.delay(index * 60).duration(320)}
      style={bounceStyle}
    >
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text numberOfLines={2} style={styles.name}>
            {medicine.name}
          </Text>
          <View
            style={[
              styles.timingPill,
              {
                backgroundColor: slotTheme.tint,
                borderColor: slotTheme.accent,
              },
            ]}
          >
            <Ionicons
              color={slotTheme.accent}
              name={slotTheme.icon}
              size={13}
            />
            <Text
              numberOfLines={1}
              style={[styles.meta, { color: slotTheme.accent }]}
            >
              {medicine.timing} · {medicine.nextReminderTime}
            </Text>
          </View>
        </View>

        <View style={styles.imageFrame}>
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
          <View
            accessibilityLabel={medicine.tabletCount}
            style={styles.doseCounter}
          >
            <Text style={[styles.doseNumber, { color: slotTheme.accent }]}>
              {doseNumber}
            </Text>
            <Text style={[styles.doseLabel, { color: slotTheme.accent }]}>
              {doseLabel}
            </Text>
          </View>
          {medicine.completed ? (
            <View style={styles.badge}>
              <Ionicons color="#FFFFFF" name="checkmark" size={11} />
              <Text style={styles.badgeText}>Completed</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.body, { backgroundColor: slotTheme.tint }]}>
          {medicine.streakDays.length > 0 ? (
            <View style={styles.streakSection}>
              <View style={styles.streakHeading}>
                <Text style={styles.streakTitle}>Course streak</Text>
              </View>
              <View style={styles.streakDays}>
                {medicine.streakDays.map((day) => {
                  const isToday = day.date === today;
                  return (
                    <View
                      accessibilityLabel={`${day.weekday} ${day.day}${
                        day.completed
                          ? ', completed'
                          : day.scheduled
                            ? ', scheduled'
                            : ''
                      }`}
                      key={day.date}
                      style={styles.streakDay}
                    >
                      <Text
                        style={[
                          styles.streakWeekday,
                          isToday && { color: slotTheme.accent },
                        ]}
                      >
                        {day.weekday}
                      </Text>
                      <View
                        style={[
                          styles.streakBubble,
                          day.scheduled && styles.streakBubbleScheduled,
                          isToday && {
                            borderColor: slotTheme.accent,
                            borderWidth: 1.5,
                          },
                        ]}
                      >
                        {day.completed ? (
                          <Ionicons
                            color={dashboardColors.warning}
                            name="flame"
                            size={20}
                          />
                        ) : (
                          <Text
                            style={[
                              styles.streakDate,
                              !day.scheduled && styles.streakDateMuted,
                              isToday && { color: slotTheme.accent },
                            ]}
                          >
                            {day.day}
                          </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          <View style={styles.peopleRow}>
            <View style={styles.hospitalGroup}>
              <HospitalLogo roundedSquare size={60} />
              <Text numberOfLines={2} style={styles.hospitalName}>
                {medicine.hospitalName}
              </Text>
            </View>
            <DoctorAvatar roundedSquare size={72} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: 0,
    marginHorizontal: -dashboardSpacing.pagePadding,
    marginBottom: dashboardSpacing.gap,
    overflow: 'hidden',
  },
  cardHeader: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    justifyContent: 'space-between',
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 12,
  },
  imageFrame: {
    height: 200,
    position: 'relative',
    width: '100%',
  },
  image: {
    height: '100%',
    width: '100%',
  },
  body: {
    gap: 14,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 14,
  },
  name: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flex: 1,
    fontSize: 16,
  },
  timingPill: {
    alignItems: 'center',
    borderRadius: dashboardRadii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '52%',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.success,
    bottom: dashboardSpacing.sm,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 3,
    left: dashboardSpacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: 'absolute',
  },
  badgeText: {
    ...dashboardTypography.caption,
    color: '#FFFFFF',
    fontSize: 11,
  },
  doseCounter: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: 50,
    paddingHorizontal: 7,
    paddingVertical: 5,
    position: 'absolute',
    right: dashboardSpacing.sm,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    top: dashboardSpacing.sm,
  },
  doseNumber: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    lineHeight: 20,
  },
  doseLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 9,
    lineHeight: 11,
  },
  meta: {
    ...dashboardTypography.caption,
    fontFamily: 'Inter_700Bold',
  },
  streakSection: {
    backgroundColor: 'rgba(255,255,255,0.56)',
    borderRadius: 18,
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  streakHeading: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  streakTitle: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
  },
  streakDays: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakDay: {
    alignItems: 'center',
    flex: 1,
    gap: 5,
  },
  streakWeekday: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    fontSize: 10,
  },
  streakBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderRadius: 15,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  streakBubbleScheduled: {
    backgroundColor: '#FFFFFF',
  },
  streakDate: {
    color: dashboardColors.text,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  streakDateMuted: {
    color: dashboardColors.textFaint,
  },
  peopleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
