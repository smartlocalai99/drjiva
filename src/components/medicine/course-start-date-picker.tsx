import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  dashboardColors,
  dashboardRadii,
  dashboardSpacing,
  dashboardTypography,
} from '../../dashboardTheme';
import {
  addCalendarDays,
  formatDateOnly,
  parseDateOnly,
} from '../../lib/medicineCalendar';
import { PressableScale } from '../PressableScale';

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CourseStartDatePicker({
  changeLabel,
  label,
  onChange,
  value,
}: {
  changeLabel: string;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const [showIosPicker, setShowIosPicker] = useState(false);
  const minimumDate = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const maximumDate = useMemo(
    () => parseDateOnly(addCalendarDays(formatDateOnly(minimumDate), 365))!,
    [minimumDate],
  );
  const pickerValue = parseDateOnly(value) ?? minimumDate;

  const setSelectedDate = (date: Date) => {
    onChange(formatDateOnly(date));
  };

  const openPicker = () => {
    if (process.env.EXPO_OS === 'android') {
      DateTimePickerAndroid.open({
        design: 'material',
        initialInputMode: 'default',
        maximumDate,
        minimumDate,
        mode: 'date',
        onValueChange: (_event, date) => setSelectedDate(date),
        title: label,
        value: pickerValue,
      });
      return;
    }
    if (process.env.EXPO_OS === 'ios') {
      setShowIosPicker((current) => !current);
    }
  };

  return (
    <View style={styles.wrap}>
      <PressableScale
        accessibilityHint={changeLabel}
        accessibilityLabel={`${label}, ${formatDisplayDate(pickerValue)}`}
        onPress={openPicker}
        style={styles.card}
      >
        <View style={styles.icon}>
          <Ionicons
            color={dashboardColors.primary}
            name="calendar-outline"
            size={21}
          />
        </View>
        <View style={styles.copy}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.date}>{formatDisplayDate(pickerValue)}</Text>
        </View>
        <View style={styles.change}>
          <Text style={styles.changeText}>{changeLabel}</Text>
          <Ionicons
            color={dashboardColors.primary}
            name={showIosPicker ? 'chevron-up' : 'chevron-down'}
            size={16}
          />
        </View>
      </PressableScale>

      {process.env.EXPO_OS === 'ios' && showIosPicker ? (
        <View style={styles.iosPicker}>
          <DateTimePicker
            accentColor={dashboardColors.primary}
            accessibilityLabel={label}
            display="inline"
            maximumDate={maximumDate}
            minimumDate={minimumDate}
            mode="date"
            onValueChange={(_event, date) => setSelectedDate(date)}
            themeVariant="light"
            value={pickerValue}
          />
          <PressableScale
            accessibilityLabel={`Finish choosing ${label}`}
            onPress={() => setShowIosPicker(false)}
            style={styles.done}
          >
            <Ionicons color="#FFFFFF" name="checkmark" size={18} />
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
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    flexDirection: 'row',
    gap: dashboardSpacing.sm,
    minHeight: 68,
    padding: dashboardSpacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: dashboardColors.primaryTint,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...dashboardTypography.caption,
    color: dashboardColors.textMuted,
  },
  date: {
    ...dashboardTypography.body,
    color: dashboardColors.text,
    fontFamily: 'Inter_700Bold',
  },
  change: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 3,
  },
  changeText: {
    ...dashboardTypography.caption,
    color: dashboardColors.primary,
    fontFamily: 'Inter_700Bold',
  },
  iosPicker: {
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderRadius: dashboardRadii.card,
    borderWidth: 1,
    overflow: 'hidden',
    padding: dashboardSpacing.sm,
  },
  done: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: dashboardColors.primary,
    borderRadius: dashboardRadii.pill,
    height: 36,
    justifyContent: 'center',
    width: 52,
  },
});
