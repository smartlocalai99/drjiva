import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import type { CourseDuration, FiniteCourseDays } from '../../lib/medicineSchedule';
import { PressableScale } from '../PressableScale';

const OPTIONS: CourseDuration[] = [
  ...([1, 2, 3, 4, 5, 6, 7] as FiniteCourseDays[]).map((days) => ({ days, mode: 'finite' as const })),
  { mode: 'ongoing' },
];

export function durationLabel(value: CourseDuration): string {
  if (value.mode === 'ongoing') return 'Everyday';
  return `${value.days} ${value.days === 1 ? 'day' : 'days'}`;
}

export function DurationPicker({ onChange, value }: { onChange: (value: CourseDuration) => void; value: CourseDuration }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Text style={styles.label}>Number of days</Text>
      <PressableScale accessibilityLabel="Choose number of days" onPress={() => setVisible(true)} style={styles.trigger}>
        <Text style={styles.triggerText}>{durationLabel(value)}</Text>
        <Ionicons color={dashboardColors.textMuted} name="chevron-down" size={20} />
      </PressableScale>
      <Modal animationType="fade" onRequestClose={() => setVisible(false)} transparent visible={visible}>
        <Pressable onPress={() => setVisible(false)} style={styles.backdrop}>
          <Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}>
            <Text style={styles.title}>How long is this course?</Text>
            <Text style={styles.subtitle}>Everyday continues until you stop or delete the reminder.</Text>
            <View style={styles.options}>
              {OPTIONS.map((option) => {
                const selected = durationLabel(option) === durationLabel(value);
                return (
                  <PressableScale
                    key={durationLabel(option)}
                    onPress={() => {
                      onChange(option);
                      setVisible(false);
                    }}
                    style={[styles.option, selected && styles.optionSelected]}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{durationLabel(option)}</Text>
                    {selected ? <Ionicons color={dashboardColors.primary} name="checkmark-circle" size={22} /> : null}
                  </PressableScale>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { ...dashboardTypography.body, color: dashboardColors.text, marginBottom: 7 },
  trigger: { alignItems: 'center', backgroundColor: dashboardColors.card, borderColor: dashboardColors.track, borderRadius: 18, borderWidth: 1, flexDirection: 'row', height: 56, justifyContent: 'space-between', paddingHorizontal: 16 },
  triggerText: { ...dashboardTypography.button, color: dashboardColors.text },
  backdrop: { backgroundColor: 'rgba(15,23,42,0.5)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: dashboardColors.card, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: dashboardSpacing.pagePadding, paddingBottom: 34 },
  title: { ...dashboardTypography.title, color: dashboardColors.text },
  subtitle: { ...dashboardTypography.body, color: dashboardColors.textMuted, marginTop: 5 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 20 },
  option: { alignItems: 'center', backgroundColor: dashboardColors.bg, borderColor: dashboardColors.track, borderRadius: dashboardRadii.pill, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 16, paddingVertical: 12 },
  optionSelected: { backgroundColor: dashboardColors.primaryTint, borderColor: dashboardColors.primary },
  optionText: { ...dashboardTypography.body, color: dashboardColors.text },
  optionTextSelected: { color: dashboardColors.primary, fontFamily: 'Inter_700Bold' },
});
