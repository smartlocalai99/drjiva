import { Ionicons } from '@expo/vector-icons';
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

import type { Medicine } from '../../data/medicines';
import {
  dashboardColors,
  dashboardLayout,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { PressableScale } from '../PressableScale';
import { MedicineToggle } from './MedicineToggle';

type MedicineCardProps = {
  medicine: Medicine;
  index: number;
  onToggle: () => void;
};

export function MedicineCard({ medicine, index, onToggle }: MedicineCardProps) {
  const scale = useSharedValue(1);
  const wasCompleted = useRef(medicine.completed);

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
      <PressableScale
        accessibilityLabel={`${medicine.name}, ${medicine.dosage}, ${medicine.timing}`}
        pressedScale={0.98}
        style={[
          styles.card,
          medicine.completed && styles.cardCompleted,
        ]}
      >
        <View style={styles.icon}>
          <Ionicons color={dashboardColors.primary} name="medical" size={20} />
        </View>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.name}>
              {medicine.name}
            </Text>
            {medicine.completed ? (
              <View style={styles.badge}>
                <Ionicons color="#FFFFFF" name="checkmark" size={11} />
                <Text style={styles.badgeText}>Completed</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.meta}>
            {medicine.dosage} · {medicine.timing}
          </Text>
          {medicine.doctorName ? (
            <Text style={styles.doctor}>{medicine.doctorName}</Text>
          ) : null}
          <Text style={styles.reminder}>Next: {medicine.nextReminderTime}</Text>
        </View>

        <MedicineToggle onValueChange={onToggle} value={medicine.completed} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderRadius: dashboardRadii.card,
    flexDirection: 'row',
    gap: dashboardSpacing.md,
    marginBottom: dashboardSpacing.gap,
    minHeight: dashboardLayout.medicineCardMinHeight,
    padding: 18,
    shadowColor: dashboardColors.shadow,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
  },
  cardCompleted: {
    backgroundColor: dashboardColors.successTint,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: dashboardLayout.medicineIconSize / 2,
    height: dashboardLayout.medicineIconSize,
    justifyContent: 'center',
    width: dashboardLayout.medicineIconSize,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
  },
  name: {
    ...dashboardTypography.cardTitle,
    color: dashboardColors.text,
    flexShrink: 1,
  },
  badge: {
    alignItems: 'center',
    backgroundColor: dashboardColors.success,
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    ...dashboardTypography.caption,
    color: '#FFFFFF',
    fontSize: 11,
  },
  meta: {
    ...dashboardTypography.body,
    color: dashboardColors.textMuted,
  },
  doctor: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
  },
  reminder: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    marginTop: 4,
  },
});
