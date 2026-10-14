import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { dashboardColors } from '../../dashboardTheme';
import { useCareCopy } from '../../lib/careCopy';
import { PressableScale } from '../PressableScale';
import { careFonts } from './careStyles';

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};
const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// A date for a form: shows the date in words, opens the phone's own
// calendar (Android dialog, iOS inline). The web preview types YYYY-MM-DD.
export function CareDateField({
  label,
  max,
  min,
  onChange,
  optional = false,
  value,
}: {
  label: string;
  max?: string;
  min?: string;
  onChange: (value: string | null) => void;
  optional?: boolean;
  value: string | null;
}) {
  const { c, date } = useCareCopy();
  const [showIos, setShowIos] = useState(false);
  const current = value ?? max ?? toIso(new Date());

  const open = () => {
    if (process.env.EXPO_OS === 'android') {
      DateTimePickerAndroid.open({
        maximumDate: max ? toDate(max) : undefined,
        minimumDate: min ? toDate(min) : undefined,
        mode: 'date',
        onValueChange: (_event, picked) => onChange(toIso(picked)),
        value: toDate(current),
      });
    } else {
      setShowIos((shown) => !shown);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {process.env.EXPO_OS === 'web' ? (
        <TextInput
          accessibilityLabel={label}
          onChangeText={(text) => onChange(/^\d{4}-\d{2}-\d{2}$/.test(text) ? text : optional && !text ? null : value)}
          placeholder="YYYY-MM-DD"
          style={styles.field}
          defaultValue={value ?? ''}
        />
      ) : (
        <PressableScale accessibilityHint={c('chooseDate')} accessibilityLabel={`${label}, ${value ? date(value) : c('chooseDate')}`} onPress={open} style={styles.field}>
          <Ionicons color={dashboardColors.primary} name="calendar-outline" size={20} />
          <Text style={[styles.value, !value && styles.placeholder]}>{value ? date(value) : c('chooseDate')}</Text>
          {optional && value ? (
            <PressableScale accessibilityLabel={c('close')} hitSlop={10} onPress={() => onChange(null)}>
              <Ionicons color={dashboardColors.textMuted} name="close-circle" size={20} />
            </PressableScale>
          ) : null}
        </PressableScale>
      )}
      {process.env.EXPO_OS === 'ios' && showIos ? (
        <View style={styles.iosPicker}>
          <DateTimePicker
            accentColor={dashboardColors.primary}
            display="inline"
            maximumDate={max ? toDate(max) : undefined}
            minimumDate={min ? toDate(min) : undefined}
            mode="date"
            onValueChange={(_event, picked) => onChange(toIso(picked))}
            themeVariant="light"
            value={toDate(current)}
          />
          <PressableScale accessibilityRole="button" onPress={() => setShowIos(false)} style={styles.done}>
            <Text style={styles.doneText}>{c('doneButton')}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  done: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  doneText: {
    color: dashboardColors.primary,
    fontFamily: careFonts.bold,
    fontSize: 16,
  },
  field: {
    alignItems: 'center',
    backgroundColor: dashboardColors.card,
    borderColor: dashboardColors.track,
    borderCurve: 'continuous',
    borderRadius: 16,
    borderWidth: 1.5,
    color: dashboardColors.text,
    flexDirection: 'row',
    fontFamily: careFonts.semiBold,
    fontSize: 17,
    gap: 10,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  iosPicker: {
    backgroundColor: dashboardColors.card,
    borderRadius: 16,
    padding: 8,
  },
  label: {
    color: dashboardColors.textMuted,
    fontFamily: careFonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  placeholder: {
    color: dashboardColors.textFaint,
  },
  value: {
    color: dashboardColors.text,
    flex: 1,
    fontFamily: careFonts.semiBold,
    fontSize: 17,
    lineHeight: 23,
  },
  wrap: {
    gap: 8,
  },
});
