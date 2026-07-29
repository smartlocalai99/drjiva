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

import {
  getHospitalInitials,
  type Medicine,
} from '../../data/medicineCourse';
import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { DOSE_SLOT_THEME } from '../../lib/doseSlotTheme';
import { PressableScale } from '../PressableScale';
import { MedicineToggle } from './MedicineToggle';

type MedicineCardProps = {
  deleting: boolean;
  medicine: Medicine;
  index: number;
  onDelete: () => void;
  onToggle: () => void;
};

export function MedicineCard({
  deleting,
  medicine,
  index,
  onDelete,
  onToggle,
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
      <View
        style={[
          styles.card,
          medicine.completed && styles.cardCompleted,
        ]}
      >
        <View style={styles.imageFrame}>
          <Image
            accessibilityLabel={`${medicine.name} medicine`}
            contentFit="cover"
            source={{ uri: medicine.imageUrl }}
            style={styles.image}
            transition={180}
          />
          <View style={styles.toggle}>
            <MedicineToggle
              disabled={medicine.completed}
              onValueChange={onToggle}
              value={medicine.completed}
            />
          </View>
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

        <View style={styles.body}>
          <Text numberOfLines={1} style={styles.name}>
            {medicine.name}
          </Text>
          <View
            style={[styles.slotBadge, { backgroundColor: slotTheme.tint }]}
          >
            <Ionicons
              color={slotTheme.accent}
              name={slotTheme.icon}
              size={13}
            />
            <Text style={[styles.meta, { color: slotTheme.accent }]}>
              {medicine.timing} · {medicine.nextReminderTime}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <View style={[styles.detailCell, styles.detailLeft]}>
              <Ionicons
                color={dashboardColors.primary}
                name="medical-outline"
                size={15}
              />
              <Text numberOfLines={1} style={styles.detailText}>
                {medicine.tabletCount}
              </Text>
            </View>

            <View style={styles.hospitalCell}>
              <View style={styles.hospitalLogo}>
                <Text style={styles.hospitalLogoText}>
                  {getHospitalInitials(medicine.hospitalName)}
                </Text>
              </View>
              <Text numberOfLines={1} style={styles.hospitalName}>
                {medicine.hospitalName}
              </Text>
            </View>

            <View style={[styles.detailCell, styles.detailRight]}>
              <Ionicons
                color={dashboardColors.textMuted}
                name="person-circle-outline"
                size={16}
              />
              <Text numberOfLines={1} style={styles.doctor}>
                {medicine.doctorName}
              </Text>
            </View>
          </View>

          <Text style={[styles.reminder, { color: slotTheme.accent }]}>
            Next dose {medicine.nextReminderTime}
          </Text>
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
  cardCompleted: {
    backgroundColor: dashboardColors.successTint,
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
  toggle: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: dashboardRadii.pill,
    paddingHorizontal: 5,
    paddingVertical: 3,
    position: 'absolute',
    right: dashboardSpacing.sm,
    top: dashboardSpacing.sm,
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
    gap: 3,
    paddingHorizontal: dashboardSpacing.md,
    paddingVertical: 11,
  },
  name: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    fontSize: 17,
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
  meta: {
    ...dashboardTypography.caption,
    fontFamily: 'Inter_700Bold',
  },
  slotBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  detailRow: {
    alignItems: 'center',
    borderTopColor: dashboardColors.track,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    marginTop: 5,
    minHeight: 48,
    paddingTop: 7,
  },
  detailCell: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  detailLeft: {
    justifyContent: 'flex-start',
  },
  detailRight: {
    justifyContent: 'flex-end',
  },
  detailText: {
    ...dashboardTypography.caption,
    color: dashboardColors.text,
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
  doctor: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
    flexShrink: 1,
    fontSize: 10,
  },
  reminder: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontSize: 11,
    marginTop: 1,
  },
});
