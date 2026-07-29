import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import { DOSE_SLOT_THEME } from '../../lib/doseSlotTheme';
import { DoctorAvatar } from '../DoctorAvatar';
import { HospitalLogo } from '../HospitalLogo';
import { PressableScale } from '../PressableScale';

type MedicineCardProps = {
  deleting: boolean;
  medicine: Medicine;
  index: number;
  onDelete: () => void;
};

export function MedicineCard({
  deleting,
  medicine,
  index,
  onDelete,
}: MedicineCardProps) {
  const scale = useSharedValue(1);
  const wasCompleted = useRef(medicine.completed);
  const slotTheme = DOSE_SLOT_THEME[medicine.slot];

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
        <View style={styles.imageFrame}>
          <Image
            accessibilityLabel={`${medicine.name} medicine`}
            contentFit="cover"
            source={{ uri: medicine.imageUrl }}
            style={styles.image}
            transition={180}
          />
          <PressableScale
            accessibilityLabel={`Delete ${medicine.name} reminder`}
            disabled={deleting}
            hitSlop={8}
            onPress={onDelete}
            style={styles.deleteButton}
          >
            {deleting ? (
              <ActivityIndicator color={dashboardColors.error} size="small" />
            ) : (
              <Ionicons
                color={dashboardColors.error}
                name="trash-outline"
                size={18}
              />
            )}
          </PressableScale>
          {medicine.completed ? (
            <View style={styles.badge}>
              <Ionicons color="#FFFFFF" name="checkmark" size={11} />
              <Text style={styles.badgeText}>Completed</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.body, { backgroundColor: slotTheme.tint }]}>
          <View style={styles.nameRow}>
            <Text numberOfLines={1} style={styles.name}>
              {medicine.name}
            </Text>
            <View style={styles.doseChip}>
              <Ionicons color={slotTheme.accent} name="medical" size={13} />
              <Text style={[styles.doseChipText, { color: slotTheme.accent }]}>
                {medicine.tabletCount}
              </Text>
            </View>
          </View>

          <View style={styles.slotBadge}>
            <Ionicons color={slotTheme.accent} name={slotTheme.icon} size={13} />
            <Text style={[styles.meta, { color: slotTheme.accent }]}>
              {medicine.timing} · {medicine.nextReminderTime}
            </Text>
          </View>

          <View style={styles.peopleRow}>
            <View style={styles.hospitalGroup}>
              <HospitalLogo size={44} />
              <Text numberOfLines={2} style={styles.hospitalName}>
                {medicine.hospitalName}
              </Text>
            </View>
            <DoctorAvatar size={48} />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    marginBottom: dashboardSpacing.gap,
    overflow: 'hidden',
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
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
  deleteButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: dashboardRadii.pill,
    height: 36,
    justifyContent: 'center',
    left: dashboardSpacing.sm,
    position: 'absolute',
    top: dashboardSpacing.sm,
    width: 36,
  },
  body: {
    gap: 8,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 12,
  },
  nameRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    justifyContent: 'space-between',
  },
  name: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flex: 1,
    fontSize: 18,
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
  doseChip: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  doseChipText: {
    ...dashboardTypography.caption,
    fontFamily: 'Inter_700Bold',
  },
  meta: {
    ...dashboardTypography.caption,
    fontFamily: 'Inter_700Bold',
  },
  slotBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  peopleRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: 10,
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
