import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { DOSE_SLOT_THEME } from '../../lib/doseSlotTheme';
import type { DoseSlot } from '../../lib/medicineSchedule';
import { adjustTime, formatTime12Hour } from '../../lib/medicineTime';
import { PressableScale } from '../PressableScale';

export function SlotTimeEditor({
  label,
  onChange,
  slot,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  slot: DoseSlot;
  value: string;
}) {
  const theme = DOSE_SLOT_THEME[slot];

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.tint, borderColor: theme.accent },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: dashboardColors.card }]}>
        <Ionicons color={theme.accent} name={theme.icon} size={21} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>15 minute steps</Text>
      </View>
      <View style={[styles.picker, { backgroundColor: dashboardColors.card }]}>
        <PressableScale
          accessibilityLabel={`Move ${label} time 15 minutes earlier`}
          onPress={() => onChange(adjustTime(value, -15))}
          style={styles.step}
        >
          <Ionicons color={theme.accent} name="remove" size={18} />
        </PressableScale>
        <Text style={[styles.time, { color: theme.accent }]}>
          {formatTime12Hour(value)}
        </Text>
        <PressableScale
          accessibilityLabel={`Move ${label} time 15 minutes later`}
          onPress={() => onChange(adjustTime(value, 15))}
          style={styles.step}
        >
          <Ionicons color={theme.accent} name="add" size={18} />
        </PressableScale>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    padding: dashboardSpacing.md,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: { flex: 1 },
  label: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
  },
  hint: {
    ...dashboardTypography.caption,
    color: dashboardColors.textFaint,
    fontSize: 10,
    marginTop: 1,
  },
  picker: {
    alignItems: 'center',
    borderRadius: dashboardRadii.pill,
    flexDirection: 'row',
  },
  step: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 34,
  },
  time: {
    ...dashboardTypography.button,
    minWidth: 76,
    textAlign: 'center',
  },
});
