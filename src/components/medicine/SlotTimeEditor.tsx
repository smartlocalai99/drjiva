import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import { DOSE_SLOT_THEME } from '../../lib/doseSlotTheme';
import type { DoseSlot } from '../../lib/medicineSchedule';
import {
  adjustTime,
  dateToStoredTime,
  formatTime12Hour,
  storedTimeToDate,
} from '../../lib/medicineTime';
import { PressableScale } from '../PressableScale';

export function SlotTimeEditor({
  changeLabel,
  hint,
  label,
  onChange,
  slot,
  value,
}: {
  changeLabel: string;
  hint: string;
  label: string;
  onChange: (value: string) => void;
  slot: DoseSlot;
  value: string;
}) {
  const theme = DOSE_SLOT_THEME[slot];
  const pickerValue = storedTimeToDate(value);
  const [showIosPicker, setShowIosPicker] = useState(false);

  const setSelectedTime = (date: Date) => {
    onChange(dateToStoredTime(date));
  };

  const openAndroidPicker = () => {
    try {
      DateTimePickerAndroid.open({
        design: 'material',
        initialInputMode: 'default',
        is24Hour: false,
        mode: 'time',
        onValueChange: (_event, date) => setSelectedTime(date),
        title: label,
        value: pickerValue,
      });
    } catch {
      Alert.alert(
        "Can't open the time picker",
        'Please close and reopen the app, then try again.',
      );
    }
  };

  const openPicker = () => {
    if (process.env.EXPO_OS === 'android') {
      openAndroidPicker();
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      setShowIosPicker((current) => !current);
    }
  };

  return (
    <View style={styles.wrap}>
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
          <Text style={styles.hint}>{hint}</Text>
        </View>
        <PressableScale
          accessibilityLabel={`Choose ${label} reminder time`}
          accessibilityHint={hint}
          onPress={openPicker}
          style={[styles.picker, { backgroundColor: dashboardColors.card }]}
        >
          <View style={styles.pickerCopy}>
            <Text style={[styles.time, { color: theme.accent }]}>
              {formatTime12Hour(value)}
            </Text>
            <Text style={[styles.changeLabel, { color: theme.accent }]}>
              {changeLabel}
            </Text>
          </View>
          {process.env.EXPO_OS === 'web' ? null : (
            <Ionicons
              color={theme.accent}
              name={showIosPicker ? 'chevron-up' : 'create-outline'}
              size={17}
            />
          )}
        </PressableScale>
      </View>

      {process.env.EXPO_OS === 'ios' && showIosPicker ? (
        <View
          style={[
            styles.iosPicker,
            { backgroundColor: theme.tint, borderColor: theme.accent },
          ]}
        >
          <DateTimePicker
            accentColor={theme.accent}
            accessibilityLabel={`${label} reminder time`}
            display="spinner"
            mode="time"
            onValueChange={(_event, date) => setSelectedTime(date)}
            themeVariant="light"
            value={pickerValue}
          />
          <PressableScale
            accessibilityLabel={`Finish choosing ${label} reminder time`}
            onPress={() => setShowIosPicker(false)}
            style={[styles.done, { backgroundColor: theme.accent }]}
          >
            <Ionicons color="#FFFFFF" name="checkmark" size={18} />
          </PressableScale>
        </View>
      ) : process.env.EXPO_OS === 'web' ? (
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
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: dashboardSpacing.sm,
  },
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
    gap: 2,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  pickerCopy: {
    alignItems: 'center',
  },
  changeLabel: {
    ...dashboardTypography.caption,
    fontSize: 9,
    lineHeight: 11,
    textTransform: 'uppercase',
  },
  iosPicker: {
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: dashboardSpacing.sm,
    paddingHorizontal: dashboardSpacing.sm,
  },
  done: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    borderRadius: dashboardRadii.pill,
    height: 36,
    justifyContent: 'center',
    width: 52,
  },
  step: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 34,
  },
  time: {
    ...dashboardTypography.button,
    minWidth: 72,
    textAlign: 'center',
  },
});
